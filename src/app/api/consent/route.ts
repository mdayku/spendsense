import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/zz_prisma";
import { verifyAccess } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  const { userId, status } = await req.json();
  
  try {
    await verifyAccess(userId);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: error.message === "Forbidden" ? 403 : 401 });
  }
  
  const upsert = await prisma.consent.upsert({ where: { userId }, update: { status }, create: { userId, status } });
  return NextResponse.json(upsert);
}

