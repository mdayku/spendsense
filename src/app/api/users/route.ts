import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/zz_prisma";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const users = await prisma.user.findMany({
    take: 50,
    where: q ? { OR: [ { name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } } ] } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const user = await prisma.user.create({ data: body });
  return NextResponse.json(user);
}

