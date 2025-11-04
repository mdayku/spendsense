import type { RecommendationItem } from "@/lib/types";
export const standardDisclosure = "This is educational content, not financial advice. Consult a licensed advisor for personalized guidance.";
export function enforceConsent(consent: { status: string } | null) { if (!consent || consent.status !== "OPTED_IN") throw new Error("ConsentRequired: user has not opted in."); }
export function eligible(item: RecommendationItem, ctx: { hasSavingsAccount: boolean; incomeMonthly: number; maxUtilization: number; overdue: boolean }) {
  if (item.id === "offer-hysa" && ctx.hasSavingsAccount) return false;
  if (item.id === "offer-bt-card" && (ctx.overdue || ctx.maxUtilization < 0.5)) return false;
  return true;
}
const banned = [/overspending/i, /irresponsible/i, /bad with money/i];
export function toneCheck(item: RecommendationItem) { for (const r of banned) { if (r.test(item.title) || r.test(item.rationale)) throw new Error(`ToneViolation in ${item.id}`); } }

