import { NextResponse } from "next/server";
import { prisma } from "@/lib/zz_prisma";
import { amlEducationalAlerts } from "@/lib/alerts";

export async function GET(_: Request, { params }: { params: { userId: string } }) {
  const { userId } = params;
  const tx = await prisma.transaction.findMany({ where: { userId } });
  const alerts30 = amlEducationalAlerts(tx as any, 30);
  const alerts180 = amlEducationalAlerts(tx as any, 180);
  return NextResponse.json({ alerts30, alerts180 });
}

