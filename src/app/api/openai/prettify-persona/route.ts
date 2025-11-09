import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  try {
    const { persona, signals } = await req.json();

    const client = getOpenAIClient();
    if (!client) {
      return NextResponse.json({ prettified: null, error: "OpenAI API key not configured" });
    }

    const prompt = `Convert this technical persona assignment into natural, readable language:

Persona: ${persona}
Signals: ${signals}

Write 1-2 sentences explaining why this persona was assigned based on these signals. Use plain language that a non-technical person can understand. Focus on the key financial behaviors that led to this classification.

Example:
Input: Persona: high_utilization, Signals: utilMax=39%, interest=true, minPayOnly=true
Output: This user was classified as "high utilization" because they're using 39% of their available credit, paying interest charges, and making only minimum payments. This pattern suggests they may be carrying a balance and could benefit from debt reduction strategies.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that converts technical financial data into clear, natural language explanations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const prettified = response.choices[0]?.message?.content?.trim();
    
    return NextResponse.json({ prettified: prettified || null });
  } catch (error: any) {
    console.error("Error prettifying persona:", error);
    return NextResponse.json({ prettified: null, error: error.message }, { status: 500 });
  }
}

