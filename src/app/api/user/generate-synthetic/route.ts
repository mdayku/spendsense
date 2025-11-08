import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/zz_prisma";
import { generateSingleUserData } from "@/lib/generateSingleUser";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check for force and includeAmlPatterns parameters in query string or request body
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    const includeAml = url.searchParams.get("includeAml") === "true";
    
    let body: { force?: boolean; includeAmlPatterns?: boolean } = {};
    try {
      body = await req.json() as { force?: boolean; includeAmlPatterns?: boolean };
    } catch {
      // Body might be empty, that's fine
    }
    
    const forceRegenerate = force || body.force === true;
    const includeAmlPatterns = includeAml || body.includeAmlPatterns === true;

    // Check if user already has transactions (with retry logic)
    const { retryDbOperation } = await import("@/lib/zz_prisma");
    const existingTransactions = await retryDbOperation(() =>
      prisma.transaction.findMany({
        where: { userId },
        take: 1,
      })
    ) as Array<{ id: string }>;

    // Check if profiles exist (with retry logic)
    const existingProfiles = await retryDbOperation(() =>
      prisma.profile.findMany({
        where: { userId },
        take: 1,
      })
    ) as Array<{ id: string }>;

    // If force regenerate is requested, delete all existing data
    if (forceRegenerate && existingTransactions.length > 0) {
      // Delete in correct order to respect foreign key constraints
      await prisma.transaction.deleteMany({ where: { userId } });
      await prisma.reviewItem.deleteMany({ where: { userId } });
      await prisma.profile.deleteMany({ where: { userId } });
      await prisma.liability.deleteMany({ where: { userId } });
      await prisma.account.deleteMany({ where: { userId } });
    } else if (existingTransactions.length > 0 && existingProfiles.length === 0) {
      // If transactions exist but no profiles, allow regeneration (delete old transactions)
      await prisma.transaction.deleteMany({ where: { userId } });
      await prisma.liability.deleteMany({ where: { userId } });
      await prisma.account.deleteMany({ where: { userId } });
    } else if (existingTransactions.length > 0) {
      return NextResponse.json(
        { error: "User already has transaction data. Delete existing data first or upload new data." },
        { status: 400 }
      );
    }

    // Generate synthetic transaction data for this user
    // This will create accounts if they don't exist, or use existing ones
    await generateSingleUserData(userId, includeAmlPatterns);

    // Automatically compute profiles from the generated data
    const { computeSignals } = await import("@/lib/signals");
    const { assignPersona, shape } = await import("@/lib/personas");
    const { amlEducationalAlerts } = await import("@/lib/alerts");

    const windows: (30 | 180)[] = [30, 180];
    const profiles = [];

    for (const w of windows) {
      const s = await computeSignals(userId, w);
      const persona = assignPersona(shape(s));

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
        },
      };

      const decisionTraceString = JSON.stringify(decisionTrace);

      const profile = await prisma.profile.create({
        data: {
          userId,
          windowDays: w,
          subscriptionCount: s.subscriptionCount,
          monthlyRecurring: s.monthlyRecurring,
          subscriptionShare: s.subscriptionShare,
          netSavingsInflow: s.netSavingsInflow,
          savingsGrowthRate: s.savingsGrowthRate,
          emergencyMonths: s.emergencyMonths,
          utilMax: s.utilMax,
          utilFlags: s.utilFlags,
          minPayOnly: s.minPayOnly,
          interestCharges: s.interestCharges,
          overdue: s.overdue,
          incomeMedianGap: s.incomeMedianGap,
          cashBufferMonths: s.cashBufferMonths,
          persona: persona.key,
          decisionTrace: decisionTraceString,
        },
      });
      profiles.push(profile);

      // Enqueue review if AML alerts present
      const userTx = await prisma.transaction.findMany({ where: { userId } });
      const eduAlerts = amlEducationalAlerts(userTx, w);

      if (eduAlerts.length) {
        await prisma.reviewItem.create({
          data: {
            userId,
            profileId: profile.id,
            reason: `aml_alerts: ${eduAlerts.join(" | ")}`,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Synthetic transaction data and profiles generated successfully",
      profilesCreated: profiles.length,
    });
  } catch (error: unknown) {
    // Safely extract error message without circular references
    let errorMessage = "Failed to generate synthetic data";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }
    
    // Check if it's a database connection error
    if (errorMessage.includes("Can't reach database server") || errorMessage.includes("database server")) {
      errorMessage = "Database connection issue. Your Supabase database may be paused. Please wait a moment and try again, or check your Supabase dashboard.";
    }
    
    console.error("Error generating synthetic data:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

