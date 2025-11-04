import { describe, it, expect } from "vitest";
import { THRESHOLDS } from "@/lib/rules";

describe("signals", () => {
  it("has sensible thresholds", () => {
    expect(THRESHOLDS.utilFlags).toEqual([0.3,0.5,0.8]);
  });
});

