import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/zz_prisma";

export async function GET() {
  const queue = await prisma.reviewItem.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: { Profile: true, User: true },
  });
  return NextResponse.json({ queue });
}

export async function POST(req: NextRequest) {
  const { id, action, notes } = await req.json(); // action: "approve" | "override"
  const status = action === "approve" ? "approved" : "overridden";
  const updated = await prisma.reviewItem.update({
    where: { id },
    data: { status, notes, decidedAt: new Date() },
  });
  return NextResponse.json({ ok: true, item: updated });
}

