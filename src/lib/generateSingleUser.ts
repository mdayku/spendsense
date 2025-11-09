import { prisma } from "@/lib/zz_prisma";
import { AccountType, Channel, PFCPrimary, LiabilityType, ConsentStatus } from "@prisma/client";
import dayjs from "dayjs";
import { analyzeAmlPatterns } from "./amlPatterns";

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function amount(n: number) {
  return Math.round(n * 100) / 100;
}

export async function generateSingleUserData(userId: string, includeAmlPatterns: boolean = false) {
  // Create consent
  await prisma.consent.upsert({
    where: { userId },
    create: { userId, status: ConsentStatus.OPTED_IN },
    update: { status: ConsentStatus.OPTED_IN },
  });

  // Get or create accounts
  let checking = await prisma.account.findFirst({
    where: { userId, type: AccountType.checking },
  });
  let savings = await prisma.account.findFirst({
    where: { userId, type: AccountType.savings },
  });
  let credit = await prisma.account.findFirst({
    where: { userId, type: AccountType.credit },
  });

  if (!checking) {
    const checkingId = `checking_${userId}_${Date.now()}`;
    checking = await prisma.account.create({
      data: {
        id: checkingId,
        userId,
        type: AccountType.checking,
        subtype: "checking",
        numberMasked: `****${Math.floor(Math.random() * 10000)}`,
        isoCurrencyCode: "USD",
        balanceCurrent: amount(1000 + Math.random() * 4000),
      },
    });
  }

  if (!savings) {
    const savingsId = `savings_${userId}_${Date.now()}`;
    savings = await prisma.account.create({
      data: {
        id: savingsId,
        userId,
        type: AccountType.savings,
        subtype: "savings",
        numberMasked: `****${Math.floor(Math.random() * 10000)}`,
        isoCurrencyCode: "USD",
        balanceCurrent: amount(500 + Math.random() * 8000),
      },
    });
  }

  if (!credit) {
    const creditId = `credit_${userId}_${Date.now()}`;
    credit = await prisma.account.create({
      data: {
        id: creditId,
        userId,
        type: AccountType.credit,
        subtype: "visa",
        numberMasked: `****${Math.floor(Math.random() * 10000)}`,
        isoCurrencyCode: "USD",
        balanceCurrent: amount(Math.random() * 5000),
        creditLimit: 5000,
      },
    });
  }

  const checkingId = checking.id;
  const savingsId = savings.id;
  const creditId = credit.id;

  // Create or update liability
  const existingLiability = await prisma.liability.findFirst({
    where: { userId, accountId: creditId },
  });

  if (!existingLiability) {
    await prisma.liability.create({
      data: {
        userId,
        accountId: creditId,
        type: LiabilityType.credit_card,
        aprType: "variable",
        aprPercent: amount(15 + Math.random() * 10),
        minPayment: amount(50 + Math.random() * 100),
        lastStmtBal: amount(Math.random() * 5000),
      },
    });
  }

  // Generate transactions (last 90 days)
  const transactions = [];
  const today = dayjs();
  const accounts = [checkingId, savingsId, creditId];
  
  // Regular merchants (one-time purchases)
  const regularMerchants = [
    "Amazon",
    "Starbucks",
    "Whole Foods",
    "Shell",
    "Target",
    "Walmart",
    "CVS",
    "Home Depot",
    "Best Buy",
    "Costco",
  ];
  
  // Subscription merchants (will be recurring)
  const subscriptionMerchants = [
    { name: "Netflix", amount: 15.99, category: PFCPrimary.subscription },
    { name: "Spotify", amount: 9.99, category: PFCPrimary.subscription },
    { name: "Apple", amount: 9.99, category: PFCPrimary.subscription },
    { name: "Disney+", amount: 10.99, category: PFCPrimary.subscription },
    { name: "Adobe", amount: 22.99, category: PFCPrimary.subscription },
  ];

  // Generate recurring subscription transactions (monthly, ~30 days apart)
  // Pick 2-4 random subscriptions to create
  const selectedSubs = subscriptionMerchants.slice(0, Math.floor(Math.random() * 3) + 2);
  
  for (const sub of selectedSubs) {
    // Create 3-4 subscription payments over 90 days with ~30 day intervals
    const numPayments = Math.floor(Math.random() * 2) + 3; // 3-4 payments
    const startDaysAgo = Math.floor(Math.random() * 30) + 60; // Start 60-90 days ago
    const accountId = Math.random() > 0.5 ? creditId : checkingId; // Mix of credit and checking
    
    for (let p = 0; p < numPayments; p++) {
      // Space payments ~28-32 days apart (monthly subscription pattern)
      const daysAgo = startDaysAgo - (p * 30) + Math.floor(Math.random() * 5) - 2; // ~30 days ±2 days
      if (daysAgo >= 0 && daysAgo <= 90) {
        const date = today.subtract(daysAgo, "day");
        
        transactions.push({
          userId,
          accountId,
          date: date.toDate(),
          amount: -sub.amount, // Negative for expenses
          merchant: sub.name,
          paymentChannel: Channel.online,
          pfcPrimary: sub.category,
          pending: false,
        });
      }
    }
  }

  // Generate income transactions (bi-weekly paychecks)
  const monthlyIncome = amount(3000 + Math.random() * 4000); // $3000-$7000/month
  const biweeklyIncome = monthlyIncome / 2;
  for (let i = 0; i < 6; i++) { // ~6 paychecks in 90 days
    const daysAgo = i * 14 + Math.floor(Math.random() * 3); // Every ~14 days with some variance
    if (daysAgo < 90) {
      transactions.push({
        userId,
        accountId: checkingId,
        date: today.subtract(daysAgo, "day").toDate(),
        amount: biweeklyIncome, // Positive for income
        merchant: "Payroll Direct Deposit",
        paymentChannel: Channel.online,
        pfcPrimary: PFCPrimary.income,
        pending: false,
      });
    }
  }

  // Generate regular expense transactions
  for (let i = 0; i < 90; i++) {
    const date = today.subtract(i, "day");
    const numTx = Math.floor(Math.random() * 3) + 1; // 1-3 transactions per day

    for (let j = 0; j < numTx; j++) {
      const accountId = pick(accounts);
      const txAmount = -amount(Math.random() * 200 + 10); // Negative for expenses
      const merchant = pick(regularMerchants);
      
      // Random category, but avoid income for expenses
      const categories = Object.values(PFCPrimary).filter(c => c !== PFCPrimary.income);
      const category = pick(categories);

      transactions.push({
        userId,
        accountId,
        date: date.toDate(),
        amount: txAmount,
        merchant,
        paymentChannel: pick(Object.values(Channel)),
        pfcPrimary: category,
        pending: Math.random() < 0.1,
      });
    }
  }

  // Generate some savings account deposits (positive amounts to savings)
  for (let i = 0; i < 4; i++) {
    const daysAgo = Math.floor(Math.random() * 90);
    transactions.push({
      userId,
      accountId: savingsId,
      date: today.subtract(daysAgo, "day").toDate(),
      amount: amount(200 + Math.random() * 800), // $200-$1000 deposits
      merchant: "Savings Transfer",
      paymentChannel: Channel.online,
      pfcPrimary: PFCPrimary.transfer,
      pending: false,
    });
  }

  // Generate AML-like patterns if requested
  if (includeAmlPatterns) {
    const amlPatterns = await analyzeAmlPatterns();
    if (amlPatterns) {
      await generateAmlPatternTransactions(userId, checkingId, transactions, today, amlPatterns);
    } else {
      // Fallback: Generate basic AML patterns even without imported data
      await generateBasicAmlPatterns(userId, checkingId, transactions, today);
    }
  }

  // Sanity check: Ensure there's at least some income (realistic minimum)
  // Expenses can exceed income (showing up as credit utilization, negative cash flow, etc.)
  // But we need at least some income to make the profile realistic
  const totalIncome = transactions
    .filter((t: { amount: number; pfcPrimary?: string }) => t.amount > 0 && t.pfcPrimary === "income")
    .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);
  
  // Minimum income threshold: at least $2000/month ($1000 per bi-weekly paycheck)
  // If AML patterns drove expenses way up but there's no income, add minimal income
  const minMonthlyIncome = 2000;
  const minTotalIncome = (minMonthlyIncome / 2) * 6; // 6 bi-weekly paychecks over 90 days = ~$6000 minimum
  
  if (totalIncome < minTotalIncome) {
    // Add enough income to meet minimum threshold
    const incomeNeeded = minTotalIncome - totalIncome;
    const numAdditionalPaychecks = Math.ceil(incomeNeeded / (minMonthlyIncome / 2));
    const additionalBiweeklyAmount = incomeNeeded / numAdditionalPaychecks;
    
    for (let i = 0; i < numAdditionalPaychecks; i++) {
      const daysAgo = Math.floor(Math.random() * 90);
      transactions.push({
        userId,
        accountId: checkingId,
        date: today.subtract(daysAgo, "day").toDate(),
        amount: amount(additionalBiweeklyAmount),
        merchant: "Payroll Direct Deposit",
        paymentChannel: Channel.online,
        pfcPrimary: PFCPrimary.income,
        pending: false,
      });
    }
  }

  // Insert transactions in chunks
  const chunkSize = 1000;
  for (let i = 0; i < transactions.length; i += chunkSize) {
    const chunk = transactions.slice(i, i + chunkSize);
    await prisma.transaction.createMany({ data: chunk });
  }
}

/**
 * Generate AML-like transaction patterns based on learned patterns from IBM dataset
 */
async function generateAmlPatternTransactions(
  userId: string,
  accountId: string,
  transactions: any[],
  today: dayjs.Dayjs,
  patterns: any
) {
  // Generate AML patterns more subtly - only 1-2 patterns per user, reduced volume
  // Spread over 90 days to mix with normal transactions, not concentrated in 30 days
  const patternRoll = Math.random();
  
  // Pattern 1: High-volume transfers to single counterparty (10-15 transfers over 90 days)
  if (patterns.highVolumeTransfers.enabled && patternRoll < 0.4) {
    const counterparty = pick(patterns.highVolumeTransfers.commonCounterparties) || `Entity-${Math.floor(Math.random() * 10000)}`;
    const numTransfers = Math.floor(10 + Math.random() * 5); // Reduced: 10-15 instead of potentially 50+
    
    for (let i = 0; i < numTransfers; i++) {
      const daysAgo = Math.floor(Math.random() * 90); // Spread over 90 days
      // Small-time activity: $200-$800 transfers
      const txAmount = amount(200 + Math.random() * 600); // $200-$800 range
      
      transactions.push({
        userId,
        accountId,
        date: today.subtract(daysAgo, "day").toDate(),
        amount: -txAmount,
        merchant: counterparty,
        merchantEntityId: counterparty,
        paymentChannel: Channel.online,
        pfcPrimary: PFCPrimary.transfer,
        pending: false,
      });
    }
  }

  // Pattern 2: Rapid in/out (smurfing-like) - 5-8 days over 90 days
  if (patterns.rapidInOut.enabled && patternRoll >= 0.4 && patternRoll < 0.7) {
    const numDays = Math.floor(5 + Math.random() * 3); // Reduced: 5-8 days
    
    for (let i = 0; i < numDays; i++) {
      const daysAgo = Math.floor(Math.random() * 90); // Spread over 90 days
      const date = today.subtract(daysAgo, "day");
      
      // Small-time in/out: $400-$1200
      const inflowAmount = amount(400 + Math.random() * 800);
      const outflowAmount = amount(inflowAmount * (0.85 + Math.random() * 0.15)); // 85-100% of inflow
      
      // Inflow in the morning
      transactions.push({
        userId,
        accountId,
        date: date.hour(10).minute(Math.floor(Math.random() * 60)).toDate(),
        amount: inflowAmount,
        merchant: "Incoming Transfer",
        paymentChannel: Channel.online,
        pfcPrimary: PFCPrimary.transfer,
        pending: false,
      });
      
      // Outflow later same day
      transactions.push({
        userId,
        accountId,
        date: date.hour(14 + Math.floor(Math.random() * 6)).minute(Math.floor(Math.random() * 60)).toDate(),
        amount: -outflowAmount,
        merchant: `Transfer-${Math.floor(Math.random() * 1000)}`,
        merchantEntityId: `Entity-${Math.floor(Math.random() * 1000)}`,
        paymentChannel: Channel.online,
        pfcPrimary: PFCPrimary.transfer,
        pending: false,
      });
    }
  }

  // Pattern 3: Structuring (amounts just under thresholds) - 3-6 transactions over 90 days
  if (patterns.structuring.enabled && patternRoll >= 0.7 && patternRoll < 0.85) {
    const threshold = pick(patterns.structuring.commonThresholds) as number;
    if (threshold) {
      const numStructured = Math.floor(3 + Math.random() * 3); // Reduced: 3-6 instead of 5-15
      
      for (let i = 0; i < numStructured; i++) {
        const daysAgo = Math.floor(Math.random() * 90); // Spread over 90 days
        // Small-time structuring: staying under smaller thresholds
        // Amounts between $700-$1900 (avoiding round $2k/$3k that might trigger internal reviews)
        const structuredAmount = amount(700 + Math.random() * 1200);
        
        transactions.push({
          userId,
          accountId,
          date: today.subtract(daysAgo, "day").toDate(),
          amount: -structuredAmount,
          merchant: `Transfer-${Math.floor(Math.random() * 1000)}`,
          merchantEntityId: `Entity-${Math.floor(Math.random() * 1000)}`,
          paymentChannel: Channel.online,
          pfcPrimary: PFCPrimary.transfer,
          pending: false,
        });
      }
    }
  }

  // Pattern 4: Frequent small transfers - 5-10 days with 2-3 transfers per day over 90 days
  if (patterns.frequentSmallTransfers.enabled && patternRoll >= 0.85) {
    const numDays = Math.floor(5 + Math.random() * 5); // Reduced: 5-10 days
    
    for (let i = 0; i < numDays; i++) {
      const daysAgo = Math.floor(Math.random() * 90); // Spread over 90 days
      const transfersPerDay = Math.floor(2 + Math.random() * 2); // Reduced: 2-3 per day instead of potentially 10+
      
      for (let j = 0; j < transfersPerDay; j++) {
        const date = today.subtract(daysAgo, "day");
        // Small frequent transfers: $50-$400
        const txAmount = amount(50 + Math.random() * 350);
        
        transactions.push({
          userId,
          accountId,
          date: date.hour(Math.floor(Math.random() * 24)).minute(Math.floor(Math.random() * 60)).toDate(),
          amount: -txAmount,
          merchant: `Transfer-${Math.floor(Math.random() * 10000)}`,
          merchantEntityId: `Entity-${Math.floor(Math.random() * 10000)}`,
          paymentChannel: Channel.online,
          pfcPrimary: PFCPrimary.transfer,
          pending: false,
        });
      }
    }
  }
}

/**
 * Generate basic AML patterns even without imported IBM data
 * Reduced volume to mix naturally with normal transactions
 */
async function generateBasicAmlPatterns(
  userId: string,
  accountId: string,
  transactions: any[],
  today: dayjs.Dayjs
) {
  // Only generate 1 pattern per user, spread over 90 days
  const patternRoll = Math.random();
  
  // Pattern 1: High-volume transfers to single counterparty (10-15 transfers over 90 days)
  if (patternRoll < 0.4) {
    const counterparty = `Entity-${Math.floor(Math.random() * 1000)}`;
    const numTransfers = Math.floor(10 + Math.random() * 5); // Reduced: 10-15
    
    for (let i = 0; i < numTransfers; i++) {
      const daysAgo = Math.floor(Math.random() * 90); // Spread over 90 days
      transactions.push({
        userId,
        accountId,
        date: today.subtract(daysAgo, "day").toDate(),
        amount: -amount(500 + Math.random() * 2000), // $500-$2500
        merchant: counterparty,
        merchantEntityId: counterparty,
        paymentChannel: Channel.online,
        pfcPrimary: PFCPrimary.transfer,
        pending: false,
      });
    }
  }

  // Pattern 2: Rapid in/out (5-8 days with same-day flows over 90 days)
  if (patternRoll >= 0.4 && patternRoll < 0.7) {
    const numDays = Math.floor(5 + Math.random() * 3); // Reduced: 5-8 days
    
    for (let i = 0; i < numDays; i++) {
      const daysAgo = Math.floor(Math.random() * 90); // Spread over 90 days
      const date = today.subtract(daysAgo, "day");
      
      // Inflow
      transactions.push({
        userId,
        accountId,
        date: date.hour(10).toDate(),
        amount: amount(2000 + Math.random() * 3000), // $2000-$5000
        merchant: "Incoming Transfer",
        paymentChannel: Channel.online,
        pfcPrimary: PFCPrimary.transfer,
        pending: false,
      });
      
      // Outflow same day
      transactions.push({
        userId,
        accountId,
        date: date.hour(15).toDate(),
        amount: -amount(1800 + Math.random() * 2800), // $1800-$4600
        merchant: `Transfer-${Math.floor(Math.random() * 1000)}`,
        merchantEntityId: `Entity-${Math.floor(Math.random() * 1000)}`,
        paymentChannel: Channel.online,
        pfcPrimary: PFCPrimary.transfer,
        pending: false,
      });
    }
  }

  // Pattern 3: Structuring (amounts just under $10k) - 3-6 transactions over 90 days
  if (patternRoll >= 0.7) {
    const numStructured = Math.floor(3 + Math.random() * 3); // Reduced: 3-6
    
    for (let i = 0; i < numStructured; i++) {
      const daysAgo = Math.floor(Math.random() * 90); // Spread over 90 days
      const structuredAmount = amount(9000 + Math.random() * 900); // $9000-$9900
      
      transactions.push({
        userId,
        accountId,
        date: today.subtract(daysAgo, "day").toDate(),
        amount: -structuredAmount,
        merchant: `Transfer-${Math.floor(Math.random() * 1000)}`,
        merchantEntityId: `Entity-${Math.floor(Math.random() * 1000)}`,
        paymentChannel: Channel.online,
        pfcPrimary: PFCPrimary.transfer,
        pending: false,
      });
    }
  }
}

