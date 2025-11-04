import { describe, it, expect } from "vitest";
import { assignPersona, shape } from "@/lib/personas";

describe("personas", () => {
  it("picks high utilization first", () => {
    const s = shape({
      subscriptionCount: 0, monthlyRecurring: 0, subscriptionShare: 0,
      netSavingsInflow: 0, savingsGrowthRate: 0, emergencyMonths: 0,
      utilMax: 0.68, utilFlags: "30,50", minPayOnly: false, interestCharges: true, overdue: false,
      incomeMedianGap: 14, cashBufferMonths: 0.2
    });
    const p = assignPersona(s as any);
    expect(p.key).toBe("high_utilization");
  });
});

