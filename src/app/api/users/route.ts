import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/zz_prisma";
import { amlEducationalAlerts } from "@/lib/alerts";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const users = await prisma.user.findMany({
    take: 50,
    where: q ? { OR: [ { name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } } ] } : undefined,
    orderBy: { createdAt: "desc" },
  });

  // Add AML alert information for each user
  const usersWithAlerts = await Promise.all(users.map(async (user: { id: string; name: string | null; email: string; createdAt: Date }) => {
    // Check for AML labels (from imported datasets)
    const amlLabels = await prisma.amlLabel.count({
      where: { userId: user.id, label: true }
    });

    // Check for AML educational alerts
    const transactions = await prisma.transaction.findMany({ where: { userId: user.id } });
    const alerts30 = amlEducationalAlerts(transactions as any, 30);
    const alerts180 = amlEducationalAlerts(transactions as any, 180);
    const totalAlerts = alerts30.length + alerts180.length;

    // Check for pending review items with AML alerts
    const pendingAmlReviews = await prisma.reviewItem.count({
      where: {
        userId: user.id,
        status: "pending",
        reason: { contains: "aml_alerts" }
      }
    });

    // Determine severity
    let severity: "none" | "yellow" | "red" = "none";
    let warningText = "";

    if (amlLabels > 0) {
      severity = "red";
      warningText = `⚠️ ${amlLabels} flagged transaction${amlLabels !== 1 ? 's' : ''} from AML dataset`;
    } else if (pendingAmlReviews > 0) {
      severity = "red";
      warningText = `🔴 ${pendingAmlReviews} pending review${pendingAmlReviews !== 1 ? 's' : ''} with AML alerts`;
    } else if (totalAlerts >= 3) {
      severity = "red";
      warningText = `🔴 ${totalAlerts} AML pattern alerts detected`;
    } else if (totalAlerts >= 1) {
      severity = "yellow";
      warningText = `⚠️ ${totalAlerts} AML pattern alert${totalAlerts !== 1 ? 's' : ''} detected`;
    }

    return {
      ...user,
      amlSeverity: severity,
      amlWarning: warningText,
      amlAlertCount: totalAlerts,
      amlLabelCount: amlLabels,
      pendingAmlReviews,
    };
  }));

  return NextResponse.json({ users: usersWithAlerts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const user = await prisma.user.create({ data: body });
  return NextResponse.json(user);
}

