import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/zz_prisma";
import { computeSignals } from "@/lib/signals";
import { assignPersona, shape } from "@/lib/personas";
import { amlEducationalAlerts } from "@/lib/alerts";

export async function GET(_: NextRequest, { params }: { params: { userId: string } }) {
  const { userId } = params;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  
  const consent = await prisma.consent.findUnique({ where: { userId } });
  
  // Fetch existing profiles instead of creating new ones on every request
  const existingProfiles = await prisma.profile.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 4, // Get latest 2 of each window (30d and 180d)
  });
  
  // Get the most recent profile for each window
  const profile30 = existingProfiles.find(p => p.windowDays === 30);
  const profile180 = existingProfiles.find(p => p.windowDays === 180);
  
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
}

// POST endpoint to compute NEW profiles (called manually when needed)
export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  const { userId } = params;
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
}

