import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/zz_prisma";
import { enforceConsent, eligible } from "@/lib/guardrails";
import { recommendationsFor } from "@/lib/recommend";
export async function GET(_: NextRequest, { params }: { params: { userId: string } }) {
  const { userId } = params;
  const consent = await prisma.consent.findUnique({ where: { userId } });
  enforceConsent(consent);
  const latest = await prisma.profile.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (!latest) return NextResponse.json({ items: [] });
  const acct = await prisma.account.findFirst({ where: { userId, type: "credit" }});
  const last4 = (acct?.numberMasked || "").slice(-4);
  const items = recommendationsFor(latest.persona, latest, { last4 });
  const ctx = { hasSavingsAccount: !!(await prisma.account.findFirst({ where: { userId, type: "savings" } })), incomeMonthly: 0, maxUtilization: latest.utilMax, overdue: latest.overdue };
  const filtered = items.filter(i => eligible(i, ctx));
  return NextResponse.json({ items: filtered });
}

