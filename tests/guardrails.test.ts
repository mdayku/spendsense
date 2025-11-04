import { describe, it, expect } from "vitest";
import { eligible, standardDisclosure, toneCheck } from "@/lib/guardrails";

describe("guardrails", () => {
  it("filters HYSA if savings exists", () => {
    const ok = eligible({ id: "offer-hysa", kind: "offer", title: "HYSA", rationale: standardDisclosure } as any, { hasSavingsAccount: true, incomeMonthly: 0, maxUtilization: 0, overdue: false });
    expect(ok).toBe(false);
  });
  it("rejects shaming language", () => {
    expect(()=>toneCheck({ id: "x", kind: "education", title: "Stop overspending!", rationale: standardDisclosure } as any)).toThrow();
  });
});

