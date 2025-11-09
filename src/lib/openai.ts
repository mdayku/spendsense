import OpenAI from "openai";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export interface RecommendationContext {
  persona: string;
  utilMax: number;
  subscriptionCount: number;
  monthlyRecurring: number;
  subscriptionShare: number;
  netSavingsInflow: number;
  savingsGrowthRate: number;
  emergencyMonths: number;
  minPayOnly: boolean;
  interestCharges: boolean;
  overdue: boolean;
  incomeMedianGap: number;
  cashBufferMonths: number;
  last4?: string;
  hasAmlAlerts?: boolean; // Flag if user has AML educational alerts
}

export async function generateRecommendationCopy(
  recommendationType: string,
  context: RecommendationContext
): Promise<{ title: string; rationale: string }> {
  // Fallback if no API key
  const client = getOpenAIClient();
  if (!client) {
    console.log(`[OpenAI] No API key found, using fallback for: ${recommendationType}`);
    return generateFallbackCopy(recommendationType, context);
  }

  const prompt = buildPrompt(recommendationType, context);

  try {
    console.log(`[OpenAI] Generating recommendation copy for: ${recommendationType}`);
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // Fast and cost-effective
      messages: [
        {
          role: "system",
          content: "You are a helpful financial education assistant. Generate concise, encouraging, and actionable recommendation copy. Keep titles under 60 characters and rationale under 150 characters. Always end rationale with: 'This is educational content, not financial advice. Consult a licensed advisor for personalized guidance.'"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn(`[OpenAI] No content in response for ${recommendationType}, using fallback`);
      return generateFallbackCopy(recommendationType, context);
    }

    // Parse the response (expecting JSON format)
    try {
      const parsed = JSON.parse(content);
      console.log(`[OpenAI] Successfully generated AI copy for ${recommendationType}`);
      return {
        title: parsed.title || "Financial recommendation",
        rationale: parsed.rationale || "This is educational content, not financial advice. Consult a licensed advisor for personalized guidance."
      };
    } catch (parseError) {
      console.error(`[OpenAI] Failed to parse JSON response for ${recommendationType}:`, parseError, "Raw content:", content);
      return generateFallbackCopy(recommendationType, context);
    }
  } catch (error: any) {
    console.error(`[OpenAI] API error for ${recommendationType}:`, {
      message: error.message,
      code: error.code,
      status: error.status,
      type: error.type
    });
    return generateFallbackCopy(recommendationType, context);
  }
}

function buildPrompt(type: string, ctx: RecommendationContext): string {
  // If user has AML alerts, provide cautious guidance
  if (ctx.hasAmlAlerts) {
    return `Generate a cautious financial recommendation for someone whose transaction patterns have been flagged for review.

IMPORTANT CONTEXT: This user's transaction history contains unusual patterns that may be flagged by financial institutions or authorities as potentially suspicious. Your recommendations should focus on transparency, record-keeping, and professional guidance.

Recommendation Type: ${type}

Generate recommendations that emphasize:
- Importance of maintaining clear records and documentation
- Consulting with legal or financial professionals
- Understanding reporting requirements and compliance
- Being transparent with financial institutions
- Reviewing and potentially adjusting transaction patterns

Tone should be educational and cautionary, not accusatory. Acknowledge this is a sensitive situation.

Return ONLY a JSON object with this exact structure:
{
  "title": "Cautious, professional title under 60 characters",
  "rationale": "Professional guidance focused on transparency and seeking expert help. This is educational only. Consult licensed legal and financial advisors."
}`;
  }

  let specificContext = "";

  switch (type) {
    case "edu-debt-snowball":
      specificContext = `User has ${(ctx.utilMax * 100).toFixed(0)}% credit card utilization${ctx.last4 ? ` on card ••••${ctx.last4}` : ""}.`;
      break;
    case "offer-bt-card":
      specificContext = `User has ${(ctx.utilMax * 100).toFixed(0)}% utilization and is paying interest charges.`;
      break;
    case "edu-autopay":
      specificContext = `User is making minimum payments only: ${ctx.minPayOnly}.`;
      break;
    case "edu-percent-budget":
      specificContext = `User has variable income with ${ctx.incomeMedianGap} days between median pay periods.`;
      break;
    case "tool-buffer-calc":
      specificContext = `User has ${ctx.cashBufferMonths.toFixed(1)} months cash buffer.`;
      break;
    case "offer-budget-app":
      specificContext = `User has irregular income pattern.`;
      break;
    case "edu-sub-audit":
      specificContext = `User has ${ctx.subscriptionCount} recurring subscriptions totaling $${ctx.monthlyRecurring.toFixed(0)}/month.`;
      break;
    case "offer-sub-manager":
      specificContext = `Subscriptions represent ${(ctx.subscriptionShare * 100).toFixed(1)}% of total spending.`;
      break;
    case "edu-apy":
      specificContext = `User is saving $${ctx.netSavingsInflow.toFixed(0)}/month with ${(ctx.savingsGrowthRate * 100).toFixed(1)}% growth rate.`;
      break;
    case "offer-hysa":
      specificContext = `User is building emergency fund with positive savings inflow.`;
      break;
    case "edu-automation":
      specificContext = `User has ${ctx.emergencyMonths.toFixed(1)} months emergency coverage.`;
      break;
    case "edu-cushion-1mo":
      specificContext = `User has only ${ctx.emergencyMonths.toFixed(2)} months emergency coverage (less than 0.5).`;
      break;
    case "edu-expense-triage":
      specificContext = `User has ${(ctx.subscriptionShare * 100).toFixed(1)}% of spending on subscriptions.`;
      break;
    case "offer-roundup":
      specificContext = `User has $${ctx.netSavingsInflow.toFixed(0)}/month net savings inflow.`;
      break;
    default:
      specificContext = `User persona: ${ctx.persona}`;
  }

  return `Generate a personalized financial recommendation with the following context:
  
Recommendation Type: ${type}
User Situation: ${specificContext}
Persona: ${ctx.persona}

IMPORTANT: Make this recommendation unique and distinct from other recommendations. Focus on the specific aspect of this recommendation type.
- For "edu-debt-snowball": Focus on debt payoff strategies and the snowball method
- For "offer-bt-card": Focus on balance transfer options and eligibility
- For "edu-autopay": Focus on automation and avoiding missed payments
- For "edu-percent-budget": Focus on percentage-based budgeting for variable income
- For "tool-buffer-calc": Focus on emergency fund calculation tools
- For "offer-budget-app": Focus on budgeting app features
- For "edu-sub-audit": Focus on subscription review and cancellation
- For "offer-sub-manager": Focus on subscription management tools
- For "edu-apy": Focus on high-yield savings account benefits
- For "offer-hysa": Focus on HYSA eligibility and features
- For "edu-automation": Focus on savings automation strategies
- For "edu-cushion-1mo": Focus on building first month emergency fund
- For "edu-expense-triage": Focus on cutting expenses quickly
- For "offer-roundup": Focus on automatic savings through round-ups

Return ONLY a JSON object with this exact structure:
{
  "title": "Action-oriented title under 60 characters that is unique and specific to this recommendation type",
  "rationale": "Specific reason based on user's numbers. This is educational content, not financial advice. Consult a licensed advisor for personalized guidance."
}`;
}

function generateFallbackCopy(type: string, ctx: RecommendationContext): { title: string; rationale: string } {
  const standardDisclosure = "This is educational content, not financial advice. Consult a licensed advisor for personalized guidance.";
  const cardStr = ctx.last4 ? `card ••••${ctx.last4}` : "your card";

  const fallbacks: Record<string, { title: string; rationale: string }> = {
    "edu-debt-snowball": {
      title: "How to cut utilization under 30% fast",
      rationale: `We noticed ${cardStr} is at ${(ctx.utilMax * 100).toFixed(0)}% utilization. ${standardDisclosure}`
    },
    "offer-bt-card": {
      title: "0% balance transfer (eligibility check)",
      rationale: `Utilization is ${(ctx.utilMax * 100).toFixed(0)}% and interest charges present. ${standardDisclosure}`
    },
    "edu-autopay": {
      title: "Autopay to avoid interest & fees",
      rationale: `Minimum-payment-only=${ctx.minPayOnly}. ${standardDisclosure}`
    },
    "edu-percent-budget": {
      title: "Percent-based budgeting for uneven pay",
      rationale: `Median pay gap is ${ctx.incomeMedianGap} days. ${standardDisclosure}`
    },
    "tool-buffer-calc": {
      title: "Emergency fund calculator (1–3 months)",
      rationale: `Cash buffer is ${ctx.cashBufferMonths.toFixed(2)} months. ${standardDisclosure}`
    },
    "offer-budget-app": {
      title: "Budgeting app trial (eligibility)",
      rationale: `Irregular income pattern detected. ${standardDisclosure}`
    },
    "edu-sub-audit": {
      title: "Monthly subscription audit checklist",
      rationale: `Found ${ctx.subscriptionCount} recurring merchants; monthly recurring ≈ $${ctx.monthlyRecurring.toFixed(0)}. ${standardDisclosure}`
    },
    "offer-sub-manager": {
      title: "Subscription manager (alerts & cancels)",
      rationale: `Subscription share is ${(ctx.subscriptionShare * 100).toFixed(1)}% of spend. ${standardDisclosure}`
    },
    "edu-apy": {
      title: "Pick a high-yield savings account",
      rationale: `Savings inflow $${ctx.netSavingsInflow.toFixed(0)}/mo; growth ${(ctx.savingsGrowthRate * 100).toFixed(1)}%. ${standardDisclosure}`
    },
    "offer-hysa": {
      title: "HYSA (eligibility)",
      rationale: `Building emergency fund with no high utilization. ${standardDisclosure}`
    },
    "edu-automation": {
      title: "Automation: pay-yourself-first",
      rationale: `Emergency coverage is ${ctx.emergencyMonths.toFixed(2)} months. ${standardDisclosure}`
    },
    "edu-cushion-1mo": {
      title: "Fast path to 1 month cushion",
      rationale: `Emergency coverage is ${ctx.emergencyMonths.toFixed(2)} months (<0.5). ${standardDisclosure}`
    },
    "edu-expense-triage": {
      title: "Cut 3 expenses this week",
      rationale: `Subscription share ${(ctx.subscriptionShare * 100).toFixed(1)}%. ${standardDisclosure}`
    },
    "offer-roundup": {
      title: "Round‑up autosave (eligibility)",
      rationale: `Net inflow currently $${ctx.netSavingsInflow.toFixed(0)}/mo. ${standardDisclosure}`
    },
  };

  return fallbacks[type] || {
    title: "Financial recommendation",
    rationale: standardDisclosure
  };
}

