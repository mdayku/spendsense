import { THRESHOLDS } from "@/lib/rules";
export type Signals = {
  subscriptionCount: number; monthlyRecurring: number; subscriptionShare: number;
  netSavingsInflow: number; savingsGrowthRate: number; emergencyMonths: number;
  utilMax: number; utilFlags: string; minPayOnly: boolean; interestCharges: boolean; overdue: boolean;
  incomeMedianGap: number; cashBufferMonths: number;
};
export const shape = (x: Signals) => x;

export function assignPersona(s: Signals) {
  const candidates = [
    { key: "high_utilization", match: s.utilMax >= 0.5 || s.interestCharges || s.minPayOnly || s.overdue, reason: `utilMax=${Math.round(s.utilMax*100)}%, interest=${s.interestCharges}, minPayOnly=${s.minPayOnly}, overdue=${s.overdue}`, priority: 1 },
    { key: "low_cushion_optimizer", match: s.cashBufferMonths < THRESHOLDS.bufferVeryLow && !s.overdue, reason: `cashBufferMonths=${s.cashBufferMonths.toFixed(2)} (< ${THRESHOLDS.bufferVeryLow}) and not overdue`, priority: 2 },
    { key: "variable_income", match: s.incomeMedianGap > THRESHOLDS.incomeGapDays && s.cashBufferMonths < THRESHOLDS.bufferMonthLow, reason: `income gap=${s.incomeMedianGap}d and buffer=${s.cashBufferMonths.toFixed(2)}mo`, priority: 3 },
    { key: "subscription_heavy", match: s.subscriptionCount >= THRESHOLDS.subscriptionRecurringMin && (s.monthlyRecurring >= THRESHOLDS.subscriptionMonthlyMinUSD || s.subscriptionShare >= THRESHOLDS.subscriptionShareMin), reason: `subs=${s.subscriptionCount}, monthlyRecurring=$${s.monthlyRecurring.toFixed(0)}, share=${(s.subscriptionShare*100).toFixed(1)}%`, priority: 4 },
    { key: "savings_builder", match: (s.savingsGrowthRate >= THRESHOLDS.savingsGrowthMin || s.netSavingsInflow >= THRESHOLDS.savingsNetInflowMin) && s.utilMax < 0.3, reason: `growth=${(s.savingsGrowthRate*100).toFixed(1)}%, inflow=$${s.netSavingsInflow.toFixed(0)}/mo, utilMax=${(s.utilMax*100).toFixed(0)}%`, priority: 5 },
  ] as const;
  const winner = candidates.filter(c => c.match).sort((a,b)=>a.priority-b.priority)[0] || { key: "savings_builder", reason: "default to education on goals & automation", priority: 99 };
  return { key: winner.key, reason: winner.reason, priority: winner.priority } as const;
}

