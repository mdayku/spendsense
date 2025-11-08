import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse";
import { PrismaClient } from "@prisma/client";
import dayjs from "dayjs";

const prisma = new PrismaClient();
const DATA_DIR = path.join(process.cwd(), "data", "ibm_aml");

// Header mapping - flexible column detection
const H = {
  txId: ["transaction_id", "tx_id", "id"],
  ts: ["timestamp", "datetime", "date", "time"],
  src: ["originator", "src", "payer", "from", "source", "sender"],
  dst: ["beneficiary", "dst", "payee", "to", "destination", "receiver"],
  amount: ["amount", "amt", "value"],
  currency: ["currency", "ccy"],
  laundering: ["is_laundering", "laundering", "label", "is_sar", "is_illicit"]
} as const;

type HeaderMap = Record<keyof typeof H, string>;

function resolveHeaders(headers: string[]): HeaderMap {
  const lower = headers.map((h) => h.toLowerCase());
  const map = {} as HeaderMap;
  (Object.keys(H) as (keyof typeof H)[]).forEach((k) => {
    const found = H[k]
      .map((x) => x.toLowerCase())
      .find((n) => lower.includes(n));
    if (!found) {
      throw new Error(`Missing required column for ${k}. Headers: ${headers.join(", ")}`);
    }
    map[k] = headers[lower.indexOf(found)];
  });
  return map;
}

interface AmlPatterns {
  highVolumeTransfers: {
    enabled: boolean;
    avgTransfersPerCounterparty: number;
    avgAmountRange: { min: number; max: number };
    commonCounterparties: string[];
    typicalFrequency: number; // transfers per day
  };
  rapidInOut: {
    enabled: boolean;
    avgSameDayCount: number;
    avgInflowAmount: number;
    avgOutflowAmount: number;
    typicalTimeGapHours: number;
  };
  structuring: {
    enabled: boolean;
    commonThresholds: number[];
    avgAmountJustBelow: number;
    typicalAmountRange: { min: number; max: number };
  };
  frequentSmallTransfers: {
    enabled: boolean;
    avgFrequency: number; // transfers per day
    avgAmount: number;
    amountRange: { min: number; max: number };
  };
  generalStats: {
    totalTransactions: number;
    uniqueEntities: number;
    dateRange: { start: string; end: string };
    avgTransactionAmount: number;
    flaggedTransactionRate: number; // % with laundering=true
  };
}

async function analyzeFile(filePath: string, limit = 0): Promise<AmlPatterns> {
  console.log(`Analyzing ${path.basename(filePath)}...`);
  
  const patterns: AmlPatterns = {
    highVolumeTransfers: {
      enabled: false,
      avgTransfersPerCounterparty: 0,
      avgAmountRange: { min: 0, max: 0 },
      commonCounterparties: [],
      typicalFrequency: 0,
    },
    rapidInOut: {
      enabled: false,
      avgSameDayCount: 0,
      avgInflowAmount: 0,
      avgOutflowAmount: 0,
      typicalTimeGapHours: 0,
    },
    structuring: {
      enabled: false,
      commonThresholds: [],
      avgAmountJustBelow: 0,
      typicalAmountRange: { min: 0, max: 0 },
    },
    frequentSmallTransfers: {
      enabled: false,
      avgFrequency: 0,
      avgAmount: 0,
      amountRange: { min: 0, max: 0 },
    },
    generalStats: {
      totalTransactions: 0,
      uniqueEntities: 0,
      dateRange: { start: "", end: "" },
      avgTransactionAmount: 0,
      flaggedTransactionRate: 0,
    },
  };

  const transactions: Array<{
    src: string;
    dst: string;
    amount: number;
    date: Date;
    laundering: boolean;
  }> = [];

  // Read file line by line to handle header issues
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const lines = fileContent.split("\n").filter((line) => line.trim());
  
  // Skip first line if it's not a CSV header (e.g., "BEGIN LAUNDERING ATTEMPT - STACK")
  let startIndex = 0;
  if (lines.length > 0) {
    const firstLine = lines[0].toLowerCase();
    if (!firstLine.includes(",") || firstLine.includes("begin") || firstLine.includes("laundering attempt")) {
      startIndex = 1;
      console.log("Skipping non-header first line");
    }
  }

  // Try to detect headers from first data line or use manual mapping
  let headers: string[] | null = null;
  let map: HeaderMap | null = null;
  let useManualMapping = false;

  // Check if first line looks like headers
  if (startIndex < lines.length) {
    const firstDataLine = lines[startIndex];
    const firstCols = firstDataLine.split(",");
    
    // Try to parse as headers
    try {
      const testParser = parse({ columns: true });
      // If first line has column names that match our expected headers, use them
      const lowerFirst = firstCols.map((c) => c.toLowerCase().trim());
      const hasExpectedHeaders = H.ts.some((h) => lowerFirst.includes(h.toLowerCase())) ||
                                 H.src.some((h) => lowerFirst.includes(h.toLowerCase()));
      
      if (hasExpectedHeaders) {
        headers = firstCols.map((c) => c.trim());
        map = resolveHeaders(headers);
        console.log("Detected headers:", map);
        startIndex++; // Skip header line
      } else {
        useManualMapping = true;
        console.log("No headers detected, using manual column mapping");
      }
    } catch {
      useManualMapping = true;
    }
  }

  // Manual mapping for IBM AML format: timestamp, originator_id, originator_account, beneficiary_id, beneficiary_account, amount, currency, amount2, currency2, channel, is_laundering
  if (useManualMapping) {
    map = {
      txId: "0", // Not used
      ts: "0", // Column 0
      src: "1", // Column 1 (originator_id)
      dst: "3", // Column 3 (beneficiary_id)
      amount: "5", // Column 5
      currency: "6", // Column 6
      laundering: "10", // Column 10
    } as any;
  }

  let n = 0;
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    n++;
    if (limit && n > limit) break;

    const cols = line.split(",").map((c) => c.trim());
    
    let srcEntity: string;
    let dstEntity: string;
    let ts: string;
    let amount: number;
    let launderingRaw: string | undefined;

    if (useManualMapping) {
      // Manual mapping: timestamp, originator_id, originator_account, beneficiary_id, beneficiary_account, amount, currency, ...
      ts = cols[0] || "";
      srcEntity = cols[1] || "";
      dstEntity = cols[3] || "";
      amount = Number(cols[5] || 0);
      launderingRaw = cols[10];
    } else {
      // Use header mapping - find column index by header name
      const headerArray = headers || [];
      const srcColIdx = headerArray.indexOf(map!.src);
      const dstColIdx = headerArray.indexOf(map!.dst);
      const tsColIdx = headerArray.indexOf(map!.ts);
      const amountColIdx = headerArray.indexOf(map!.amount);
      const launderingColIdx = headerArray.indexOf(map!.laundering);
      
      srcEntity = String(cols[srcColIdx] || "");
      dstEntity = String(cols[dstColIdx] || "");
      ts = String(cols[tsColIdx] || "");
      amount = Number(cols[amountColIdx] || 0);
      launderingRaw = cols[launderingColIdx];
    }

    const laundering =
      launderingRaw !== undefined &&
      String(launderingRaw).toLowerCase() !== "false" &&
      launderingRaw !== "0" &&
      launderingRaw !== "";

    const date = dayjs(ts).isValid() ? dayjs(ts).toDate() : new Date();

    if (srcEntity && dstEntity && amount > 0) {
      transactions.push({
        src: srcEntity,
        dst: dstEntity,
        amount: Math.abs(amount),
        date,
        laundering,
      });
    }
  }

  patterns.generalStats.totalTransactions = transactions.length;
  patterns.generalStats.flaggedTransactionRate =
    transactions.filter((t) => t.laundering).length / transactions.length;

  const uniqueEntities = new Set(transactions.map((t) => t.src));
  patterns.generalStats.uniqueEntities = uniqueEntities.size;

  const dates = transactions.map((t) => t.date).sort((a, b) => a.getTime() - b.getTime());
  if (dates.length > 0) {
    patterns.generalStats.dateRange = {
      start: dates[0].toISOString(),
      end: dates[dates.length - 1].toISOString(),
    };
  }

  const amounts = transactions.map((t) => t.amount);
  patterns.generalStats.avgTransactionAmount =
    amounts.reduce((a, b) => a + b, 0) / amounts.length;

  // Pattern 1: High-volume transfers to single counterparty
  const byCounterparty: Record<string, { count: number; amounts: number[]; dates: Date[] }> = {};
  transactions.forEach((t) => {
    if (!byCounterparty[t.dst]) {
      byCounterparty[t.dst] = { count: 0, amounts: [], dates: [] };
    }
    byCounterparty[t.dst].count++;
    byCounterparty[t.dst].amounts.push(t.amount);
    byCounterparty[t.dst].dates.push(t.date);
  });

  const counterpartyStats = Object.values(byCounterparty);
  if (counterpartyStats.length > 0) {
    const highVolume = counterpartyStats.filter((stat) => stat.count >= 10);
    if (highVolume.length > 0) {
      patterns.highVolumeTransfers.enabled = true;
      patterns.highVolumeTransfers.avgTransfersPerCounterparty =
        highVolume.reduce((sum, stat) => sum + stat.count, 0) / highVolume.length;

      const allAmounts = highVolume.flatMap((stat) => stat.amounts);
      patterns.highVolumeTransfers.avgAmountRange = {
        min: allAmounts.length > 0 ? allAmounts.reduce((a, b) => Math.min(a, b)) : 0,
        max: allAmounts.length > 0 ? allAmounts.reduce((a, b) => Math.max(a, b)) : 0,
      };

      // Calculate typical frequency (transfers per day)
      const totalDays = highVolume.reduce((sum, stat) => {
        const sorted = stat.dates.sort((a, b) => a.getTime() - b.getTime());
        const days = (sorted[sorted.length - 1].getTime() - sorted[0].getTime()) / (1000 * 60 * 60 * 24);
        return sum + Math.max(1, days);
      }, 0);
      patterns.highVolumeTransfers.typicalFrequency =
        highVolume.reduce((sum, stat) => sum + stat.count, 0) / totalDays;

      // Get top 20 most common counterparties
      const sorted = Object.entries(byCounterparty)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 20);
      patterns.highVolumeTransfers.commonCounterparties = sorted.map(([name]) => name);
    }
  }

  // Pattern 2: Rapid in/out (same-day inflows and outflows)
  const inflowsByDay = new Map<string, number[]>();
  const outflowsByDay = new Map<string, number[]>();
  const inflowsByEntityDay = new Map<string, { amount: number; date: Date }[]>();
  const outflowsByEntityDay = new Map<string, { amount: number; date: Date }[]>();

  transactions.forEach((t) => {
    const d = dayjs(t.date).format("YYYY-MM-DD");
    const entityDayKey = `${t.src}-${d}`;

    // For rapid in/out, we need to track by entity
    if (!inflowsByEntityDay.has(entityDayKey)) {
      inflowsByEntityDay.set(entityDayKey, []);
    }
    if (!outflowsByEntityDay.has(entityDayKey)) {
      outflowsByEntityDay.set(entityDayKey, []);
    }

    // Assume negative amounts are outflows, positive are inflows
    // But IBM data might have all positive, so we'll check both directions
    inflowsByEntityDay.get(entityDayKey)!.push({ amount: t.amount, date: t.date });
    outflowsByEntityDay.get(entityDayKey)!.push({ amount: t.amount, date: t.date });
  });

  let sameDayCount = 0;
  let totalInflow = 0;
  let totalOutflow = 0;
  const timeGaps: number[] = [];

  inflowsByEntityDay.forEach((inflows, key) => {
    const outflows = outflowsByEntityDay.get(key) || [];
    if (inflows.length > 0 && outflows.length > 0) {
      sameDayCount++;
      totalInflow += inflows.reduce((sum, t) => sum + t.amount, 0);
      totalOutflow += outflows.reduce((sum, t) => sum + t.amount, 0);

      // Calculate time gaps between inflows and outflows
      inflows.forEach((inflow) => {
        outflows.forEach((outflow) => {
          const gapHours = Math.abs(outflow.date.getTime() - inflow.date.getTime()) / (1000 * 60 * 60);
          if (gapHours < 24) {
            timeGaps.push(gapHours);
          }
        });
      });
    }
  });

  if (sameDayCount > 0) {
    patterns.rapidInOut.enabled = true;
    patterns.rapidInOut.avgSameDayCount = sameDayCount / uniqueEntities.size;
    patterns.rapidInOut.avgInflowAmount = totalInflow / sameDayCount;
    patterns.rapidInOut.avgOutflowAmount = totalOutflow / sameDayCount;
    if (timeGaps.length > 0) {
      patterns.rapidInOut.typicalTimeGapHours =
        timeGaps.reduce((a, b) => a + b, 0) / timeGaps.length;
    }
  }

  // Pattern 3: Structuring (amounts just under thresholds)
  const structuringThresholds = [10000, 5000, 3000, 1000];
  const amountsNearThreshold: number[] = [];

  transactions.forEach((t) => {
    for (const threshold of structuringThresholds) {
      if (t.amount >= threshold * 0.9 && t.amount < threshold) {
        amountsNearThreshold.push(t.amount);
        break;
      }
    }
  });

  if (amountsNearThreshold.length > 0) {
    patterns.structuring.enabled = true;
    patterns.structuring.commonThresholds = structuringThresholds.filter((threshold) => {
      return amountsNearThreshold.some((amt) => amt >= threshold * 0.9 && amt < threshold);
    });
    patterns.structuring.avgAmountJustBelow =
      amountsNearThreshold.reduce((a, b) => a + b, 0) / amountsNearThreshold.length;
    patterns.structuring.typicalAmountRange = {
      min: amountsNearThreshold.length > 0 ? amountsNearThreshold.reduce((a, b) => Math.min(a, b)) : 0,
      max: amountsNearThreshold.length > 0 ? amountsNearThreshold.reduce((a, b) => Math.max(a, b)) : 0,
    };
  }

  // Pattern 4: Frequent small transfers
  const smallTransfers = transactions.filter((t) => t.amount < 1000 && t.amount > 0);

  if (smallTransfers.length > 0) {
    // Count transfers per entity per day
    const transfersByEntityDay = new Map<string, number>();
    smallTransfers.forEach((t) => {
      const key = `${t.src}-${dayjs(t.date).format("YYYY-MM-DD")}`;
      transfersByEntityDay.set(key, (transfersByEntityDay.get(key) || 0) + 1);
    });

    const dailyFrequencies = Array.from(transfersByEntityDay.values());
    if (dailyFrequencies.length > 0) {
      patterns.frequentSmallTransfers.enabled = true;
      patterns.frequentSmallTransfers.avgFrequency =
        dailyFrequencies.reduce((a, b) => a + b, 0) / dailyFrequencies.length;
      patterns.frequentSmallTransfers.avgAmount =
        smallTransfers.reduce((sum, t) => sum + t.amount, 0) / smallTransfers.length;
      const smallAmounts = smallTransfers.map((t) => t.amount);
      patterns.frequentSmallTransfers.amountRange = {
        min: smallAmounts.length > 0 ? smallAmounts.reduce((a, b) => Math.min(a, b)) : 0,
        max: smallAmounts.length > 0 ? smallAmounts.reduce((a, b) => Math.max(a, b)) : 0,
      };
    }
  }

  console.log(`Analyzed ${n} transactions`);
  return patterns;
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Missing data dir: ${DATA_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".csv") || f.endsWith(".txt"));
  if (!files.length) {
    console.error("No CSV or TXT files found in data/ibm_aml");
    process.exit(1);
  }

  console.log(`Found ${files.length} file(s) to analyze: ${files.join(", ")}\n`);

  const limit = Number(process.env.IMPORT_LIMIT || 0);
  if (limit > 0) {
    console.log(`Limiting analysis to ${limit} rows per file\n`);
  }

  const allPatterns: AmlPatterns[] = [];
  for (const f of files) {
    const patterns = await analyzeFile(path.join(DATA_DIR, f), limit);
    allPatterns.push(patterns);
  }

  // Aggregate patterns across all files
  const aggregated: AmlPatterns = {
    highVolumeTransfers: {
      enabled: allPatterns.some((p) => p.highVolumeTransfers.enabled),
      avgTransfersPerCounterparty:
        allPatterns
          .filter((p) => p.highVolumeTransfers.enabled)
          .reduce((sum, p) => sum + p.highVolumeTransfers.avgTransfersPerCounterparty, 0) /
        Math.max(1, allPatterns.filter((p) => p.highVolumeTransfers.enabled).length),
      avgAmountRange: {
        min: (() => {
          const mins = allPatterns.map((p) => p.highVolumeTransfers.avgAmountRange.min).filter((v) => v > 0);
          return mins.length > 0 ? mins.reduce((a, b) => Math.min(a, b)) : 0;
        })(),
        max: (() => {
          const maxs = allPatterns.map((p) => p.highVolumeTransfers.avgAmountRange.max);
          return maxs.length > 0 ? maxs.reduce((a, b) => Math.max(a, b)) : 0;
        })(),
      },
      commonCounterparties: Array.from(
        new Set(allPatterns.flatMap((p) => p.highVolumeTransfers.commonCounterparties))
      ).slice(0, 20),
      typicalFrequency:
        allPatterns
          .filter((p) => p.highVolumeTransfers.enabled)
          .reduce((sum, p) => sum + p.highVolumeTransfers.typicalFrequency, 0) /
        Math.max(1, allPatterns.filter((p) => p.highVolumeTransfers.enabled).length),
    },
    rapidInOut: {
      enabled: allPatterns.some((p) => p.rapidInOut.enabled),
      avgSameDayCount:
        allPatterns
          .filter((p) => p.rapidInOut.enabled)
          .reduce((sum, p) => sum + p.rapidInOut.avgSameDayCount, 0) /
        Math.max(1, allPatterns.filter((p) => p.rapidInOut.enabled).length),
      avgInflowAmount:
        allPatterns
          .filter((p) => p.rapidInOut.enabled)
          .reduce((sum, p) => sum + p.rapidInOut.avgInflowAmount, 0) /
        Math.max(1, allPatterns.filter((p) => p.rapidInOut.enabled).length),
      avgOutflowAmount:
        allPatterns
          .filter((p) => p.rapidInOut.enabled)
          .reduce((sum, p) => sum + p.rapidInOut.avgOutflowAmount, 0) /
        Math.max(1, allPatterns.filter((p) => p.rapidInOut.enabled).length),
      typicalTimeGapHours:
        allPatterns
          .filter((p) => p.rapidInOut.enabled && p.rapidInOut.typicalTimeGapHours > 0)
          .reduce((sum, p) => sum + p.rapidInOut.typicalTimeGapHours, 0) /
        Math.max(1, allPatterns.filter((p) => p.rapidInOut.enabled && p.rapidInOut.typicalTimeGapHours > 0).length),
    },
    structuring: {
      enabled: allPatterns.some((p) => p.structuring.enabled),
      commonThresholds: Array.from(
        new Set(allPatterns.flatMap((p) => p.structuring.commonThresholds))
      ),
      avgAmountJustBelow:
        allPatterns
          .filter((p) => p.structuring.enabled)
          .reduce((sum, p) => sum + p.structuring.avgAmountJustBelow, 0) /
        Math.max(1, allPatterns.filter((p) => p.structuring.enabled).length),
      typicalAmountRange: {
        min: (() => {
          const mins = allPatterns.map((p) => p.structuring.typicalAmountRange.min).filter((v) => v > 0);
          return mins.length > 0 ? mins.reduce((a, b) => Math.min(a, b)) : 0;
        })(),
        max: (() => {
          const maxs = allPatterns.map((p) => p.structuring.typicalAmountRange.max);
          return maxs.length > 0 ? maxs.reduce((a, b) => Math.max(a, b)) : 0;
        })(),
      },
    },
    frequentSmallTransfers: {
      enabled: allPatterns.some((p) => p.frequentSmallTransfers.enabled),
      avgFrequency:
        allPatterns
          .filter((p) => p.frequentSmallTransfers.enabled)
          .reduce((sum, p) => sum + p.frequentSmallTransfers.avgFrequency, 0) /
        Math.max(1, allPatterns.filter((p) => p.frequentSmallTransfers.enabled).length),
      avgAmount:
        allPatterns
          .filter((p) => p.frequentSmallTransfers.enabled)
          .reduce((sum, p) => sum + p.frequentSmallTransfers.avgAmount, 0) /
        Math.max(1, allPatterns.filter((p) => p.frequentSmallTransfers.enabled).length),
      amountRange: {
        min: (() => {
          const mins = allPatterns.map((p) => p.frequentSmallTransfers.amountRange.min).filter((v) => v > 0);
          return mins.length > 0 ? mins.reduce((a, b) => Math.min(a, b)) : 0;
        })(),
        max: (() => {
          const maxs = allPatterns.map((p) => p.frequentSmallTransfers.amountRange.max);
          return maxs.length > 0 ? maxs.reduce((a, b) => Math.max(a, b)) : 0;
        })(),
      },
    },
    generalStats: {
      totalTransactions: allPatterns.reduce((sum, p) => sum + p.generalStats.totalTransactions, 0),
      uniqueEntities: (() => {
        const entities = allPatterns.map((p) => p.generalStats.uniqueEntities);
        return entities.length > 0 ? entities.reduce((a, b) => Math.max(a, b)) : 0;
      })(),
      dateRange: {
        start: allPatterns
          .map((p) => p.generalStats.dateRange.start)
          .sort()[0] || "",
        end: allPatterns
          .map((p) => p.generalStats.dateRange.end)
          .sort()
          .reverse()[0] || "",
      },
      avgTransactionAmount:
        allPatterns.reduce((sum, p) => sum + p.generalStats.avgTransactionAmount, 0) /
        allPatterns.length,
      flaggedTransactionRate:
        allPatterns.reduce((sum, p) => sum + p.generalStats.flaggedTransactionRate, 0) /
        allPatterns.length,
    },
  };

  // Save patterns to a JSON file for the synthetic generator to use
  const patternsFile = path.join(process.cwd(), "data", "aml-patterns.json");
  fs.writeFileSync(patternsFile, JSON.stringify(aggregated, null, 2));

  console.log("\n" + "=".repeat(60));
  console.log("AML PATTERN ANALYSIS COMPLETE");
  console.log("=".repeat(60));
  console.log("\nGeneral Statistics:");
  console.log(`  Total transactions analyzed: ${aggregated.generalStats.totalTransactions.toLocaleString()}`);
  console.log(`  Unique entities: ${aggregated.generalStats.uniqueEntities.toLocaleString()}`);
  console.log(`  Average transaction amount: $${aggregated.generalStats.avgTransactionAmount.toFixed(2)}`);
  console.log(`  Flagged transaction rate: ${(aggregated.generalStats.flaggedTransactionRate * 100).toFixed(2)}%`);

  console.log("\nDetected Patterns:");
  console.log(`  High-volume transfers: ${aggregated.highVolumeTransfers.enabled ? "✅" : "❌"}`);
  if (aggregated.highVolumeTransfers.enabled) {
    console.log(`    - Avg transfers per counterparty: ${aggregated.highVolumeTransfers.avgTransfersPerCounterparty.toFixed(1)}`);
    console.log(`    - Amount range: $${aggregated.highVolumeTransfers.avgAmountRange.min.toFixed(2)} - $${aggregated.highVolumeTransfers.avgAmountRange.max.toFixed(2)}`);
    console.log(`    - Typical frequency: ${aggregated.highVolumeTransfers.typicalFrequency.toFixed(2)} transfers/day`);
  }

  console.log(`  Rapid in/out flows: ${aggregated.rapidInOut.enabled ? "✅" : "❌"}`);
  if (aggregated.rapidInOut.enabled) {
    console.log(`    - Avg same-day count: ${aggregated.rapidInOut.avgSameDayCount.toFixed(1)}`);
    console.log(`    - Avg inflow: $${aggregated.rapidInOut.avgInflowAmount.toFixed(2)}`);
    console.log(`    - Avg outflow: $${aggregated.rapidInOut.avgOutflowAmount.toFixed(2)}`);
    console.log(`    - Typical time gap: ${aggregated.rapidInOut.typicalTimeGapHours.toFixed(1)} hours`);
  }

  console.log(`  Structuring: ${aggregated.structuring.enabled ? "✅" : "❌"}`);
  if (aggregated.structuring.enabled) {
    console.log(`    - Common thresholds: $${aggregated.structuring.commonThresholds.join(", $")}`);
    console.log(`    - Avg amount just below: $${aggregated.structuring.avgAmountJustBelow.toFixed(2)}`);
  }

  console.log(`  Frequent small transfers: ${aggregated.frequentSmallTransfers.enabled ? "✅" : "❌"}`);
  if (aggregated.frequentSmallTransfers.enabled) {
    console.log(`    - Avg frequency: ${aggregated.frequentSmallTransfers.avgFrequency.toFixed(2)} transfers/day`);
    console.log(`    - Avg amount: $${aggregated.frequentSmallTransfers.avgAmount.toFixed(2)}`);
    console.log(`    - Amount range: $${aggregated.frequentSmallTransfers.amountRange.min.toFixed(2)} - $${aggregated.frequentSmallTransfers.amountRange.max.toFixed(2)}`);
  }

  console.log(`\n✅ Patterns saved to: ${patternsFile}`);
  console.log("\nThese patterns will be used when generating synthetic data with AML patterns enabled.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

