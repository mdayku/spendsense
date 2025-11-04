import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/zz_prisma";
export async function POST(req: NextRequest) {
  const { userId, status } = await req.json();
  const upsert = await prisma.consent.upsert({ where: { userId }, update: { status }, create: { userId, status } });
  return NextResponse.json(upsert);
}

