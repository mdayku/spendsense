import type { RecommendationItem } from "@/lib/types";
import { standardDisclosure, toneCheck } from "@/lib/guardrails";
import { generateRecommendationCopy, type RecommendationContext } from "@/lib/openai";

export async function recommendationsFor(
  persona: string, 
  s: any, 
  ctx: { last4: string; aprMonthlyUSD?: number; hasAmlAlerts?: boolean },
  useAI: boolean = false
): Promise<RecommendationItem[]> {
  const because = (msg: string) => `${msg}. ${standardDisclosure}`;
  const items: RecommendationItem[] = [];
  const cardStr = ctx.last4 ? `card ••••${ctx.last4}` : "your card";
  
  // Build context for AI generation
  const aiContext: RecommendationContext = {
    persona,
    utilMax: s.utilMax || 0,
    subscriptionCount: s.subscriptionCount || 0,
    monthlyRecurring: s.monthlyRecurring || 0,
    subscriptionShare: s.subscriptionShare || 0,
    netSavingsInflow: s.netSavingsInflow || 0,
    savingsGrowthRate: s.savingsGrowthRate || 0,
    emergencyMonths: s.emergencyMonths || 0,
    minPayOnly: s.minPayOnly || false,
    interestCharges: s.interestCharges || false,
    overdue: s.overdue || false,
    incomeMedianGap: s.incomeMedianGap || 0,
    cashBufferMonths: s.cashBufferMonths || 0,
    last4: ctx.last4,
    hasAmlAlerts: ctx.hasAmlAlerts || false,
  };
  // Helper function to create recommendation with optional AI copy
  const createRecommendation = async (
    id: string,
    kind: "education" | "offer",
    defaultTitle: string,
    defaultRationale: string
  ): Promise<RecommendationItem> => {
    if (useAI) {
      try {
        const aiCopy = await generateRecommendationCopy(id, aiContext);
        console.log(`[Recommendations] AI-generated copy for ${id}:`, { title: aiCopy.title, rationale: aiCopy.rationale.substring(0, 50) + '...' });
        return { id, kind, title: aiCopy.title, rationale: aiCopy.rationale, aiGenerated: true };
      } catch (error) {
        console.error(`[Recommendations] AI generation failed for ${id}, using fallback:`, error);
        return { id, kind, title: defaultTitle, rationale: defaultRationale, aiGenerated: false };
      }
    }
    return { id, kind, title: defaultTitle, rationale: defaultRationale, aiGenerated: false };
  };

  if (persona === "high_utilization") {
    items.push(
      await createRecommendation("edu-debt-snowball", "education", "How to cut utilization under 30% fast", because(`We noticed ${cardStr} is at ${(s.utilMax*100).toFixed(0)}% utilization`)),
      await createRecommendation("offer-bt-card", "offer", "0% balance transfer (eligibility check)", because(`Utilization is ${(s.utilMax*100).toFixed(0)}% and interest charges present: ${s.interestCharges}`)),
      await createRecommendation("edu-autopay", "education", "Autopay to avoid interest & fees", because(`Minimum-payment-only=${s.minPayOnly}`)),
    );
  }
  if (persona === "variable_income") {
    items.push(
      await createRecommendation("edu-percent-budget", "education", "Percent-based budgeting for uneven pay", because(`Median pay gap is ${s.incomeMedianGap} days`)),
      await createRecommendation("tool-buffer-calc", "education", "Emergency fund calculator (1–3 months)", because(`Cash buffer is ${s.cashBufferMonths.toFixed(2)} months`)),
      await createRecommendation("offer-budget-app", "offer", "Budgeting app trial (eligibility)", because(`Irregular income pattern detected`)),
    );
  }
  if (persona === "subscription_heavy") {
    items.push(
      await createRecommendation("edu-sub-audit", "education", "Monthly subscription audit checklist", because(`Found ${s.subscriptionCount} recurring merchants; monthly recurring ≈ $${s.monthlyRecurring.toFixed(0)}`)),
      await createRecommendation("offer-sub-manager", "offer", "Subscription manager (alerts & cancels)", because(`Subscription share is ${(s.subscriptionShare*100).toFixed(1)}% of spend`)),
    );
  }
  if (persona === "savings_builder") {
    items.push(
      await createRecommendation("edu-apy", "education", "Pick a high-yield savings account", because(`Savings inflow $${s.netSavingsInflow.toFixed(0)}/mo; growth ${(s.savingsGrowthRate*100).toFixed(1)}%`)),
      await createRecommendation("offer-hysa", "offer", "HYSA (eligibility)", because(`Building emergency fund with no high utilization`)),
      await createRecommendation("edu-automation", "education", "Automation: pay-yourself-first", because(`Emergency coverage is ${s.emergencyMonths.toFixed(2)} months`)),
    );
  }
  if (persona === "low_cushion_optimizer") {
    items.push(
      await createRecommendation("edu-cushion-1mo", "education", "Fast path to 1 month cushion", because(`Emergency coverage is ${s.emergencyMonths.toFixed(2)} months (<0.5)`)),
      await createRecommendation("edu-expense-triage", "education", "Cut 3 expenses this week", because(`Subscription share ${(s.subscriptionShare*100).toFixed(1)}%`)),
      await createRecommendation("offer-roundup", "offer", "Round‑up autosave (eligibility)", because(`Net inflow currently $${s.netSavingsInflow.toFixed(0)}/mo`)),
    );
  }
  items.forEach(toneCheck);
  return items;
}

