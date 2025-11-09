import { prisma } from "@/lib/zz_prisma";
import { THRESHOLDS } from "@/lib/rules";
import dayjs from "dayjs";

export async function computeSignals(userId: string, windowDays: 30 | 180) {
  const since = dayjs().subtract(windowDays, "day").toDate();
  const [tx, accts, liabs] = await Promise.all([
    prisma.transaction.findMany({ where: { userId, date: { gte: since } } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.liability.findMany({ where: { userId } }),
  ]);

  const expenses = tx.filter((t: { amount: number }) => t.amount < 0);
  const totalSpend = Math.abs(expenses.reduce((s: number, t: { amount: number }) => s + t.amount, 0));

  // Count subscriptions in two ways:
  // 1. Pattern-based: recurring transactions to same merchant (strict)
  // 2. Category-based: transactions explicitly marked as "subscription"
  
  // For pattern-based, we need to track transactions (not just dates) to identify recurring amounts
  const byMerchant = new Map<string, Array<{ date: Date; amount: number; pfcPrimary?: string }>>();
  for (const t of expenses) {
    // Skip transfer category transactions - they're not subscriptions
    if (t.pfcPrimary === "transfer") continue;
    const key = t.merchant || t.merchantEntityId || "unknown";
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push({ date: t.date, amount: Math.abs(t.amount), pfcPrimary: t.pfcPrimary });
  }
  
  let recurringCount = 0;
  let monthlyRecurringUSD = 0;
  const patternBasedMerchants = new Set<string>();
  
  for (const [m, transactions] of byMerchant) {
    // Sort by date
    const sorted = transactions.slice().sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Calculate gaps between consecutive transactions
    const gaps = sorted.slice(1).map((t, i) => (t.date.getTime() - sorted[i].date.getTime()) / (1000*3600*24));
    const avgGap = gaps.length ? gaps.reduce((s: number, g: number) => s + g, 0) / gaps.length : Infinity;
    
    // Check if pattern matches subscription frequency (monthly or weekly)
    if (sorted.length >= 3 && (avgGap > 20 && avgGap < 40 || avgGap > 6 && avgGap < 9)) {
      // Find the most common amount (the subscription amount)
      // Group transactions by similar amounts (within 10% tolerance)
      const amountGroups = new Map<number, number>();
      for (const t of sorted) {
        let foundGroup = false;
        for (const [groupAmount, count] of amountGroups) {
          if (Math.abs(t.amount - groupAmount) / groupAmount < 0.1) {
            amountGroups.set(groupAmount, count + 1);
            foundGroup = true;
            break;
          }
        }
        if (!foundGroup) {
          amountGroups.set(t.amount, 1);
        }
      }
      
      // Find the amount group with the most occurrences (likely the subscription)
      let maxCount = 0;
      let subscriptionAmount = 0;
      for (const [amount, count] of amountGroups) {
        if (count > maxCount) {
          maxCount = count;
          subscriptionAmount = amount;
        }
      }
      
      // Only count as subscription if the recurring amount appears at least 3 times
      if (maxCount >= 3) {
        recurringCount++;
        patternBasedMerchants.add(m);
        
        // Calculate monthly recurring based on pattern frequency
        let monthlyAmount = 0;
        if (avgGap > 20 && avgGap < 40) {
          // Monthly subscription
          monthlyAmount = subscriptionAmount;
        } else if (avgGap > 6 && avgGap < 9) {
          // Weekly subscription
          monthlyAmount = subscriptionAmount * 4;
        }
        
        monthlyRecurringUSD += monthlyAmount;
      }
    }
  }
  
  // Also count transactions explicitly categorized as "subscription"
  // Count ALL subscription transactions, not just ones not already counted
  // (pattern-based might have missed some, or category is more accurate)
  const allSubscriptionTx = expenses.filter((t: { pfcPrimary?: string }) => t.pfcPrimary === "subscription");
  
  // Count unique subscription merchants (category-based)
  const categoryBasedMerchants = new Set<string>();
  allSubscriptionTx.forEach((t: { merchant?: string; merchantEntityId?: string }) => {
    const key = t.merchant || t.merchantEntityId || "unknown";
    // Only add merchants that weren't already counted via pattern detection
    if (!patternBasedMerchants.has(key)) {
      categoryBasedMerchants.add(key);
    }
  });
  
  // Add category-based subscriptions to count (only new ones)
  recurringCount += categoryBasedMerchants.size;
  
  // For spending calculation, use ALL subscription transactions to get accurate share
  // But avoid double-counting: if merchant was pattern-detected, use pattern amount; otherwise use category amount
  const categoryBasedSpending = allSubscriptionTx
    .filter((t: { merchant?: string; merchantEntityId?: string }) => {
      const key = t.merchant || t.merchantEntityId || "unknown";
      return !patternBasedMerchants.has(key); // Only count if not already counted via pattern
    })
    .reduce((s: number, t: { amount: number }) => s + Math.abs(t.amount), 0);
  monthlyRecurringUSD += categoryBasedSpending / Math.max(1, windowDays/30);
  
  // Calculate subscription share: monthly recurring / monthly total spend
  const monthlyTotalSpend = totalSpend / Math.max(1, windowDays/30);
  const subscriptionShare = monthlyTotalSpend > 0 ? monthlyRecurringUSD / monthlyTotalSpend : 0;

  const savingsAcctIds = accts.filter((a: { type: string }) => ["savings","money_market","hsa"].includes(a.type))
                              .map((a: { id: string }) => a.id);
  const savingsTx = tx.filter((t: { accountId: string }) => savingsAcctIds.includes(t.accountId));
  const netSavingsInflow = savingsTx.reduce((s: number, t: { amount: number }) => s + t.amount, 0) / Math.max(1, windowDays/30);
  const prevWindowSince = dayjs(since).subtract(windowDays, "day").toDate();
  const prevSavingsTx = await prisma.transaction.findMany({ where: { userId, date: { gte: prevWindowSince, lt: since } }});
  const prevNet = prevSavingsTx.filter((t: { accountId: string }) => savingsAcctIds.includes(t.accountId)).reduce((s: number, t: { amount: number }) => s + t.amount, 0);
  const currNet = savingsTx.reduce((s: number, t: { amount: number }) => s + t.amount, 0);
  const savingsGrowthRate = prevNet === 0 ? (currNet>0?1:0) : (currNet - prevNet) / Math.abs(prevNet);

  const savingsBalance = (await prisma.account.findMany({ where: { id: { in: savingsAcctIds }}}))
      .reduce((s: number, a: { balanceCurrent?: number }) => s + (a.balanceCurrent || 0), 0);
  const avgMonthlyExpenses = totalSpend / Math.max(1, windowDays/30);
  const emergencyMonths = avgMonthlyExpenses > 0 ? savingsBalance / avgMonthlyExpenses : 0;
  
  // Cash Flow Buffer includes checking accounts too (cash + savings)
  const checkingAcctIds = accts.filter((a: { type: string }) => a.type === "checking")
                                .map((a: { id: string }) => a.id);
  const checkingBalance = (await prisma.account.findMany({ where: { id: { in: checkingAcctIds }}}))
      .reduce((s: number, a: { balanceCurrent?: number }) => s + (a.balanceCurrent || 0), 0);
  const totalCashAndSavings = savingsBalance + checkingBalance;
  const cashBufferMonths = avgMonthlyExpenses > 0 ? totalCashAndSavings / avgMonthlyExpenses : 0;

  const creditAccts = accts.filter((a: { type: string }) => a.type === "credit");
  const utils = creditAccts.map((a: { balanceCurrent?: number; creditLimit?: number }) => (a.balanceCurrent||0) / Math.max(1, a.creditLimit||0));
  const utilMax = utils.length ? Math.max(...utils) : 0;
  const utilFlags = THRESHOLDS.utilFlags.filter((f: number) => utilMax >= f).map((f: number) => Math.round(f*100)).join(",");
  const minPayOnly = (await prisma.liability.findMany({ where: { userId, type: "credit_card" }}))
    .some((l: { minPayment?: number; lastPayment?: number }) => (l.minPayment||0) > 0 && Math.abs(l.lastPayment||0) <= (l.minPayment||0)+1e-6);
  const interestCharges = (await prisma.liability.findMany({ where: { userId, type: "credit_card" }}))
    .some((l: { aprPercent?: number; lastStmtBal?: number }) => (l.aprPercent||0) > 0 && (l.lastStmtBal||0) > 0);
  const overdue = (await prisma.liability.findMany({ where: { userId, type: "credit_card" }}))
    .some((l: { isOverdue?: boolean }) => !!l.isOverdue);

  const incomes = tx.filter((t: { amount: number; pfcPrimary?: string }) => t.amount > 0 && t.pfcPrimary === "income").map((t: { date: Date }) => t.date).sort((a: Date, b: Date) => a.getTime()-b.getTime());
  const incomeGaps = incomes.slice(1).map((d: Date, i: number) => (d.getTime()-incomes[i].getTime())/(1000*3600*24));
  const incomeMedianGap = incomeGaps.length ? incomeGaps.sort((a: number, b: number) => a-b)[Math.floor(incomeGaps.length/2)] : 999;

  return {
    subscriptionCount: recurringCount,
    monthlyRecurring: monthlyRecurringUSD,
    subscriptionShare,
    netSavingsInflow,
    savingsGrowthRate,
    emergencyMonths,
    utilMax,
    utilFlags,
    minPayOnly,
    interestCharges,
    overdue,
    incomeMedianGap,
    cashBufferMonths,
  };
}

