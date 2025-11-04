import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/zz_prisma";
import { computeSignals } from "@/lib/signals";
import { assignPersona, shape } from "@/lib/personas";
import { amlEducationalAlerts } from "@/lib/alerts";

export async function GET(_: NextRequest, { params }: { params: { userId: string } }) {
  const { userId } = params;
  const consent = await prisma.consent.findUnique({ where: { userId } });
  const windows: (30|180)[] = [30, 180];
  const profiles = [] as any[];
  for (const w of windows) {
    const s = await computeSignals(userId, w);
    const persona = assignPersona(shape(s));
    const profile = await prisma.profile.create({ data: {
      userId, windowDays: w, subscriptionCount: s.subscriptionCount, monthlyRecurring: s.monthlyRecurring, subscriptionShare: s.subscriptionShare,
      netSavingsInflow: s.netSavingsInflow, savingsGrowthRate: s.savingsGrowthRate, emergencyMonths: s.emergencyMonths,
      utilMax: s.utilMax, utilFlags: s.utilFlags, minPayOnly: s.minPayOnly, interestCharges: s.interestCharges, overdue: s.overdue,
      incomeMedianGap: s.incomeMedianGap, cashBufferMonths: s.cashBufferMonths, persona: persona.key, decisionTrace: JSON.stringify({ persona, s }) }});
    profiles.push(profile);
    
    // Enqueue review if persona changed or AML alerts present
    const prev = await prisma.profile.findFirst({ where: { userId, createdAt: { lt: profile.createdAt } }, orderBy: { createdAt: "desc" } });
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
  return NextResponse.json({ consent, profiles });
}

