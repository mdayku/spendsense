import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/zz_prisma";
import { verifyAccess } from "@/lib/auth-helpers";

export async function GET(_: NextRequest, { params }: { params: { userId: string } }) {
  const { userId } = params;
  
  try {
    await verifyAccess(userId);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: error.message === "Forbidden" ? 403 : 401 });
  }

  try {
    // Get all transactions for the user
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
      include: {
        Account: {
          select: { type: true }
        }
      }
    });

    if (transactions.length === 0) {
      return NextResponse.json({
        spendingByCategory: [],
        spendingOverTime: [],
        incomeVsExpenses: [],
        paymentChannels: [],
      });
    }

    // 1. Spending by Category (Pie Chart)
    const categoryMap = new Map<string, number>();
    transactions.forEach((tx: any) => {
      if (tx.amount < 0) { // Only expenses (negative amounts)
        const category = tx.pfcPrimary;
        categoryMap.set(category, (categoryMap.get(category) || 0) + Math.abs(tx.amount));
      }
    });
    const spendingByCategory = Array.from(categoryMap.entries()).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
      value: Math.round(value * 100) / 100,
    })).sort((a, b) => b.value - a.value);

    // 2. Spending Over Time (Line Chart) - Group by week
    const timeMap = new Map<string, number>();
    transactions.forEach((tx: any) => {
      if (tx.amount < 0) {
        const date = new Date(tx.date);
        const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;
        timeMap.set(weekKey, (timeMap.get(weekKey) || 0) + Math.abs(tx.amount));
      }
    });
    const spendingOverTime = Array.from(timeMap.entries())
      .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 3. Income vs Expenses Over Time (Area Chart) - Group by week
    const incomeExpenseMap = new Map<string, { income: number; expenses: number }>();
    transactions.forEach((tx: any) => {
      const date = new Date(tx.date);
      const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;
      const current = incomeExpenseMap.get(weekKey) || { income: 0, expenses: 0 };
      if (tx.amount > 0) {
        current.income += tx.amount;
      } else {
        current.expenses += Math.abs(tx.amount);
      }
      incomeExpenseMap.set(weekKey, current);
    });
    const incomeVsExpenses = Array.from(incomeExpenseMap.entries())
      .map(([date, data]) => ({
        date,
        income: Math.round(data.income * 100) / 100,
        expenses: Math.round(data.expenses * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 4. Payment Channels (Pie Chart)
    const channelMap = new Map<string, number>();
    transactions.forEach((tx: any) => {
      if (tx.amount < 0) {
        const channel = tx.paymentChannel;
        channelMap.set(channel, (channelMap.get(channel) || 0) + Math.abs(tx.amount));
      }
    });
    const paymentChannels = Array.from(channelMap.entries()).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
      value: Math.round(value * 100) / 100,
    })).sort((a, b) => b.value - a.value);

    return NextResponse.json({
      spendingByCategory,
      spendingOverTime,
      incomeVsExpenses,
      paymentChannels,
    });
  } catch (error: any) {
    console.error("Error fetching chart data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}

function getWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return String(weekNum).padStart(2, '0');
}

