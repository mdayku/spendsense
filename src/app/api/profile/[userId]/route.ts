import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/zz_prisma";
import { computeSignals } from "@/lib/signals";
import { assignPersona, shape } from "@/lib/personas";
import { amlEducationalAlerts } from "@/lib/alerts";
import { verifyAccess } from "@/lib/auth-helpers";

export async function GET(_: NextRequest, { params }: { params: { userId: string } }) {
  const { userId } = params;
  
  try {
    await verifyAccess(userId);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: error.message === "Forbidden" ? 403 : 401 });
  }
  
  try {
    // Run queries in parallel for better performance
    const [user, consent, existingProfiles] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.consent.findUnique({ where: { userId } }).catch(() => null), // Consent is optional
      prisma.profile.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 4, // Get latest 2 of each window (30d and 180d)
      }).catch(() => []), // Profiles might not exist yet
    ]);
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Get the most recent profile for each window
    const profile30 = existingProfiles?.find((p: { windowDays: number }) => p.windowDays === 30);
    const profile180 = existingProfiles?.find((p: { windowDays: number }) => p.windowDays === 180);
    
    const profiles = [profile30, profile180].filter(Boolean);
    
    // Serialize dates and ensure clean JSON response
    const cleanProfiles = profiles.map(p => ({
      ...p,
      createdAt: p?.createdAt?.toISOString(),
    }));
    
    const cleanConsent = consent ? {
      ...consent,
      timestamp: consent.timestamp?.toISOString(),
    } : null;
    
    return NextResponse.json({ 
      user: { id: user.id, name: user.name, email: user.email },
      consent: cleanConsent, 
      profiles: cleanProfiles 
    });
  } catch (error: any) {
    console.error("Error fetching profile:", {
      code: error.code,
      message: error.message,
      userId,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
    
    // Handle Prisma connection errors with specific error codes
    if (error.code === 'P1001' || error.message?.includes('Can\'t reach database server')) {
      return NextResponse.json({ 
        error: "Database connection failed",
        details: error.message,
        code: error.code
      }, { status: 503 });
    }
    
    // Handle Prisma query errors
    if (error.code?.startsWith('P')) {
      return NextResponse.json({ 
        error: "Database query failed",
        details: error.message,
        code: error.code
      }, { status: 500 });
    }
    
    // Handle other errors
    return NextResponse.json({ 
      error: error.message || "Failed to fetch profile",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined
    }, { status: 500 });
  }
}

// POST endpoint to compute NEW profiles (called manually when needed)
export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  const { userId } = params;
  
  try {
    await verifyAccess(userId);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: error.message === "Forbidden" ? 403 : 401 });
  }
  
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    
    const windows: (30|180)[] = [30, 180];
    const profiles = [] as any[];
    
    for (const w of windows) {
      const s = await computeSignals(userId, w);
      const persona = assignPersona(shape(s));
      
      // Create clean decision trace with only serializable primitive values
      const decisionTrace = {
        persona: String(persona.key),
        personaReason: String(persona.reason),
        signals: {
          subscriptionCount: Number(s.subscriptionCount) || 0,
          monthlyRecurring: Number(s.monthlyRecurring) || 0,
          subscriptionShare: Number(s.subscriptionShare) || 0,
          netSavingsInflow: Number(s.netSavingsInflow) || 0,
          savingsGrowthRate: Number(s.savingsGrowthRate) || 0,
          emergencyMonths: Number(s.emergencyMonths) || 0,
          utilMax: Number(s.utilMax) || 0,
          utilFlags: String(s.utilFlags || ""),
          incomeMedianGap: Number(s.incomeMedianGap) || 0,
          cashBufferMonths: Number(s.cashBufferMonths) || 0,
        }
      };
      
      let decisionTraceString = "{}";
      try {
        decisionTraceString = JSON.stringify(decisionTrace);
      } catch (e) {
        console.error("Failed to stringify decision trace:", e);
        decisionTraceString = JSON.stringify({ error: "Failed to serialize", persona: persona.key });
      }
      
      const profile = await prisma.profile.create({ data: {
        userId, windowDays: w, subscriptionCount: s.subscriptionCount, monthlyRecurring: s.monthlyRecurring, subscriptionShare: s.subscriptionShare,
        netSavingsInflow: s.netSavingsInflow, savingsGrowthRate: s.savingsGrowthRate, emergencyMonths: s.emergencyMonths,
        utilMax: s.utilMax, utilFlags: s.utilFlags, minPayOnly: s.minPayOnly, interestCharges: s.interestCharges, overdue: s.overdue,
        incomeMedianGap: s.incomeMedianGap, cashBufferMonths: s.cashBufferMonths, persona: persona.key, 
        decisionTrace: decisionTraceString
      }});
      profiles.push(profile);
      
      // Enqueue review if persona changed or AML alerts present
      const prev = await prisma.profile.findFirst({ 
        where: { userId, windowDays: w, createdAt: { lt: profile.createdAt } }, 
        orderBy: { createdAt: "desc" } 
      });
      const personaChanged = prev && prev.persona !== profile.persona;
      
      const userTx = await prisma.transaction.findMany({ where: { userId } });
      const eduAlerts = amlEducationalAlerts(userTx, w);
      
      if (personaChanged || eduAlerts.length) {
        await prisma.reviewItem.create({
          data: {
            userId,
            profileId: profile.id,
            reason: eduAlerts.length ? `aml_alerts: ${eduAlerts.join(" | ")}` : "persona_change",
          }
        });
      }
    }
    
    return NextResponse.json({ success: true, profilesCreated: profiles.length });
  } catch (error: any) {
    console.error("Error computing profile:", error);
    // Handle Prisma connection errors
    if (error.code === 'P1001' || error.message?.includes('Can\'t reach database server')) {
      return NextResponse.json({ 
        error: "Database connection failed. Please check your Supabase connection and ensure the database is active.",
        details: error.message 
      }, { status: 503 });
    }
    // Handle other errors
    return NextResponse.json({ 
      error: error.message || "Failed to compute profile",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined
    }, { status: 500 });
  }
}

