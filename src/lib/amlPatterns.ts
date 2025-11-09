import { prisma } from "@/lib/zz_prisma";
import dayjs from "dayjs";
import fs from "fs";
import path from "path";

/**
 * Analyzes patterns from IBM AML dataset (either from imported data or pre-analyzed JSON)
 * Returns patterns that can be used to generate synthetic AML-like users
 */
export async function analyzeAmlPatterns() {
  // First, try to load pre-analyzed patterns from JSON file
  const patternsFile = path.join(process.cwd(), "data", "aml-patterns.json");
  if (fs.existsSync(patternsFile)) {
    try {
      const patternsJson = fs.readFileSync(patternsFile, "utf-8");
      const patterns = JSON.parse(patternsJson);
      console.log("[AML Patterns] Loaded patterns from pre-analyzed JSON file");
      return patterns;
    } catch (error) {
      console.warn("[AML Patterns] Failed to load patterns from JSON, falling back to database analysis");
    }
  }

  // Fallback: Check if we have any imported AML data in database
  const amlUsers = await prisma.user.findMany({
    where: { email: { contains: "@aml.local" } },
    take: 100, // Sample up to 100 AML users
  });

  if (amlUsers.length === 0) {
    return null; // No AML data available
  }

  const patterns = {
    // Pattern 1: High-volume transfers to single counterparty
    highVolumeTransfers: {
      enabled: false,
      avgTransfersPerCounterparty: 0,
      avgAmountRange: { min: 0, max: 0 },
      commonCounterparties: [] as string[],
    },
    // Pattern 2: Rapid in/out (smurfing)
    rapidInOut: {
      enabled: false,
      avgSameDayCount: 0,
      avgInflowAmount: 0,
      avgOutflowAmount: 0,
    },
    // Pattern 3: Structuring (amounts just under thresholds)
    structuring: {
      enabled: false,
      commonThresholds: [] as number[],
      avgAmountJustBelow: 0,
    },
    // Pattern 4: Frequent small transfers
    frequentSmallTransfers: {
      enabled: false,
      avgFrequency: 0,
      avgAmount: 0,
    },
  };

  // Analyze transactions from AML users
  const userIds = amlUsers.map((u: { id: string }) => u.id);
  const transactions = await prisma.transaction.findMany({
    where: { userId: { in: userIds } },
    orderBy: { date: "asc" },
  });

  if (transactions.length === 0) {
    return null;
  }

  // Pattern 1: High-volume transfers to single counterparty
  const transfers = transactions.filter((t: { pfcPrimary: string; amount: number }) => 
    t.pfcPrimary === "transfer" && t.amount < 0
  );
  
  if (transfers.length > 0) {
    const byCounterparty: Record<string, { count: number; amounts: number[] }> = {};
    transfers.forEach((t: { merchantEntityId?: string | null; merchant?: string | null; amount: number }) => {
      const key = t.merchantEntityId || t.merchant || "unknown";
      if (!byCounterparty[key]) {
        byCounterparty[key] = { count: 0, amounts: [] };
      }
      byCounterparty[key].count++;
      byCounterparty[key].amounts.push(Math.abs(t.amount));
    });

    const counterpartyStats = Object.values(byCounterparty);
    if (counterpartyStats.length > 0) {
      const totalTransfers = counterpartyStats.reduce((sum, stat) => sum + stat.count, 0);
      patterns.highVolumeTransfers.enabled = true;
      patterns.highVolumeTransfers.avgTransfersPerCounterparty = totalTransfers / counterpartyStats.length;
      
      const allAmounts = counterpartyStats.flatMap(stat => stat.amounts);
      if (allAmounts.length > 0) {
        patterns.highVolumeTransfers.avgAmountRange = {
          min: Math.min(...allAmounts),
          max: Math.max(...allAmounts),
        };
      }

      // Get top 10 most common counterparties
      const sorted = Object.entries(byCounterparty)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10);
      patterns.highVolumeTransfers.commonCounterparties = sorted.map(([name]) => name);
    }
  }

  // Pattern 2: Rapid in/out (same-day inflows and outflows)
  const inflowsByDay = new Map<string, number[]>();
  const outflowsByDay = new Map<string, number[]>();
  
  transactions.forEach((t: { date: Date; amount: number }) => {
    const d = dayjs(t.date).format("YYYY-MM-DD");
    if (t.amount > 0) {
      if (!inflowsByDay.has(d)) inflowsByDay.set(d, []);
      inflowsByDay.get(d)!.push(t.amount);
    } else {
      if (!outflowsByDay.has(d)) outflowsByDay.set(d, []);
      outflowsByDay.get(d)!.push(Math.abs(t.amount));
    }
  });

  let sameDayCount = 0;
  let totalInflow = 0;
  let totalOutflow = 0;
  inflowsByDay.forEach((amounts, day) => {
    if (outflowsByDay.has(day)) {
      sameDayCount++;
      totalInflow += amounts.reduce((a, b) => a + b, 0);
      totalOutflow += (outflowsByDay.get(day) || []).reduce((a, b) => a + b, 0);
    }
  });

  if (sameDayCount > 0) {
    patterns.rapidInOut.enabled = true;
    patterns.rapidInOut.avgSameDayCount = sameDayCount / amlUsers.length;
    patterns.rapidInOut.avgInflowAmount = totalInflow / sameDayCount;
    patterns.rapidInOut.avgOutflowAmount = totalOutflow / sameDayCount;
  }

  // Pattern 3: Structuring (amounts just under common thresholds like $10k)
  const structuringThresholds = [10000, 5000, 3000, 1000];
  const amountsNearThreshold: number[] = [];
  
  transfers.forEach((t: { amount: number }) => {
    const absAmount = Math.abs(t.amount);
    for (const threshold of structuringThresholds) {
      if (absAmount >= threshold * 0.9 && absAmount < threshold) {
        amountsNearThreshold.push(absAmount);
        break;
      }
    }
  });

  if (amountsNearThreshold.length > 0) {
    patterns.structuring.enabled = true;
    patterns.structuring.commonThresholds = structuringThresholds.filter(threshold => {
      return amountsNearThreshold.some(amt => amt >= threshold * 0.9 && amt < threshold);
    });
    patterns.structuring.avgAmountJustBelow = 
      amountsNearThreshold.reduce((a, b) => a + b, 0) / amountsNearThreshold.length;
  }

  // Pattern 4: Frequent small transfers
  const smallTransfers = transfers.filter((t: { amount: number }) => 
    Math.abs(t.amount) < 1000 && Math.abs(t.amount) > 0
  );
  
  if (smallTransfers.length > 0) {
    // Count transfers per user per day
    const transfersByUserDay = new Map<string, number>();
    smallTransfers.forEach((t: { userId: string; date: Date }) => {
      const key = `${t.userId}-${dayjs(t.date).format("YYYY-MM-DD")}`;
      transfersByUserDay.set(key, (transfersByUserDay.get(key) || 0) + 1);
    });

    const dailyFrequencies = Array.from(transfersByUserDay.values());
    if (dailyFrequencies.length > 0) {
      patterns.frequentSmallTransfers.enabled = true;
      patterns.frequentSmallTransfers.avgFrequency = 
        dailyFrequencies.reduce((a, b) => a + b, 0) / dailyFrequencies.length;
      patterns.frequentSmallTransfers.avgAmount = 
        smallTransfers.reduce((sum: number, t: { amount: number }) => sum + Math.abs(t.amount), 0) / smallTransfers.length;
    }
  }

  return patterns;
}

