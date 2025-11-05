import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/zz_prisma";
import { enforceConsent, eligible } from "@/lib/guardrails";
import { recommendationsFor } from "@/lib/recommend";
import { verifyAccess } from "@/lib/auth-helpers";

export async function GET(_: NextRequest, { params }: { params: { userId: string } }) {
  const { userId } = params;
  
  try {
    await verifyAccess(userId);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: error.message === "Forbidden" ? 403 : 401 });
  }
  
  const consent = await prisma.consent.findUnique({ where: { userId } });
  enforceConsent(consent);
  const latest = await prisma.profile.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (!latest) return NextResponse.json({ items: [] });
  const acct = await prisma.account.findFirst({ where: { userId, type: "credit" }});
  const last4 = (acct?.numberMasked || "").slice(-4);
  
  // Pass useAI flag and full context for AI generation
  const items = await recommendationsFor(latest.persona, latest, { last4 }, true);
  
  const ctx = { hasSavingsAccount: !!(await prisma.account.findFirst({ where: { userId, type: "savings" } })), incomeMonthly: 0, maxUtilization: latest.utilMax, overdue: latest.overdue };
  const filtered = items.filter(i => eligible(i, ctx));
  return NextResponse.json({ items: filtered });
}

