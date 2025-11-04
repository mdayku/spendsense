import { describe, it, expect } from "vitest";
import { recommendationsFor } from "@/lib/recommend";

describe("recommendations", () => {
  it("includes standard disclosure", () => {
    const items = recommendationsFor("savings_builder", { netSavingsInflow:250, savingsGrowthRate:0.03, emergencyMonths:0.8 }, { last4: "1234" } as any);
    expect(items.some(i=>/not financial advice/i.test(i.rationale))).toBe(true);
  });
});

