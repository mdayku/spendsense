import type { RecommendationItem } from "@/lib/types";
import { standardDisclosure, toneCheck } from "@/lib/guardrails";
export function recommendationsFor(persona: string, s: any, ctx: { last4: string; aprMonthlyUSD?: number }) {
  const because = (msg: string) => `${msg}. ${standardDisclosure}`;
  const items: RecommendationItem[] = [];
  const cardStr = ctx.last4 ? `card ••••${ctx.last4}` : "your card";
  if (persona === "high_utilization") {
    items.push(
      { id: "edu-debt-snowball", kind: "education", title: "How to cut utilization under 30% fast", rationale: because(`We noticed ${cardStr} is at ${(s.utilMax*100).toFixed(0)}% utilization`) },
      { id: "offer-bt-card", kind: "offer", title: "0% balance transfer (eligibility check)", rationale: because(`Utilization is ${(s.utilMax*100).toFixed(0)}% and interest charges present: ${s.interestCharges}`) },
      { id: "edu-autopay", kind: "education", title: "Autopay to avoid interest & fees", rationale: because(`Minimum-payment-only=${s.minPayOnly}`) },
    );
  }
  if (persona === "variable_income") {
    items.push(
      { id: "edu-percent-budget", kind: "education", title: "Percent-based budgeting for uneven pay", rationale: because(`Median pay gap is ${s.incomeMedianGap} days`) },
      { id: "tool-buffer-calc", kind: "education", title: "Emergency fund calculator (1–3 months)", rationale: because(`Cash buffer is ${s.cashBufferMonths.toFixed(2)} months`) },
      { id: "offer-budget-app", kind: "offer", title: "Budgeting app trial (eligibility)", rationale: because(`Irregular income pattern detected`) },
    );
  }
  if (persona === "subscription_heavy") {
    items.push(
      { id: "edu-sub-audit", kind: "education", title: "Monthly subscription audit checklist", rationale: because(`Found ${s.subscriptionCount} recurring merchants; monthly recurring ≈ $${s.monthlyRecurring.toFixed(0)}`) },
      { id: "offer-sub-manager", kind: "offer", title: "Subscription manager (alerts & cancels)", rationale: because(`Subscription share is ${(s.subscriptionShare*100).toFixed(1)}% of spend`) },
    );
  }
  if (persona === "savings_builder") {
    items.push(
      { id: "edu-apy", kind: "education", title: "Pick a high-yield savings account", rationale: because(`Savings inflow $${s.netSavingsInflow.toFixed(0)}/mo; growth ${(s.savingsGrowthRate*100).toFixed(1)}%`) },
      { id: "offer-hysa", kind: "offer", title: "HYSA (eligibility)", rationale: because(`Building emergency fund with no high utilization`) },
      { id: "edu-automation", kind: "education", title: "Automation: pay-yourself-first", rationale: because(`Emergency coverage is ${s.emergencyMonths.toFixed(2)} months`) },
    );
  }
  if (persona === "low_cushion_optimizer") {
    items.push(
      { id: "edu-cushion-1mo", kind: "education", title: "Fast path to 1 month cushion", rationale: because(`Emergency coverage is ${s.emergencyMonths.toFixed(2)} months (<0.5)`) },
      { id: "edu-expense-triage", kind: "education", title: "Cut 3 expenses this week", rationale: because(`Subscription share ${(s.subscriptionShare*100).toFixed(1)}%`) },
      { id: "offer-roundup", kind: "offer", title: "Round‑up autosave (eligibility)", rationale: because(`Net inflow currently $${s.netSavingsInflow.toFixed(0)}/mo`) },
    );
  }
  items.forEach(toneCheck);
  return items;
}

