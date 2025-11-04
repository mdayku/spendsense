export type WindowSize = 30 | 180;
export type PersonaKey =
  | "high_utilization"
  | "variable_income"
  | "subscription_heavy"
  | "savings_builder"
  | "low_cushion_optimizer";

export interface RecommendationItem {
  id: string;
  kind: "education" | "offer";
  title: string;
  url?: string;
  rationale: string; // plain-language "because" with concrete data
  disclosure?: string; // standard disclaimer
}

export interface EligibilityContext {
  hasSavingsAccount: boolean;
  incomeMonthly: number;
  maxUtilization: number;
  overdue: boolean;
}

