import { NextResponse } from "next/server";
import { prisma } from "@/lib/zz_prisma";

export async function GET(_: Request, { params }: { params: { userId: string } }) {
  const { userId } = params;
  const count = await prisma.amlLabel.count({ where: { userId } });
  return NextResponse.json({ count });
}

