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
  // Pattern 1: High-volume transfers to single counterparty
  if (patterns.highVolumeTransfers.enabled && Math.random() > 0.5) {
    const counterparty = pick(patterns.highVolumeTransfers.commonCounterparties) || `Entity-${Math.floor(Math.random() * 10000)}`;
    const numTransfers = Math.floor(patterns.highVolumeTransfers.avgTransfersPerCounterparty * 0.8 + Math.random() * patterns.highVolumeTransfers.avgTransfersPerCounterparty * 0.4);
    
    for (let i = 0; i < numTransfers; i++) {
      const daysAgo = Math.floor(Math.random() * 30); // Within last 30 days
      const txAmount = amount(
        patterns.highVolumeTransfers.avgAmountRange.min + 
        Math.random() * (patterns.highVolumeTransfers.avgAmountRange.max - patterns.highVolumeTransfers.avgAmountRange.min)
      );
      
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

  // Pattern 2: Rapid in/out (smurfing-like)
  if (patterns.rapidInOut.enabled && Math.random() > 0.5) {
    const numDays = Math.floor(patterns.rapidInOut.avgSameDayCount * 0.8 + Math.random() * patterns.rapidInOut.avgSameDayCount * 0.4);
    
    for (let i = 0; i < numDays; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const date = today.subtract(daysAgo, "day");
      
      // Inflow in the morning
      transactions.push({
        userId,
        accountId,
        date: date.hour(10).minute(Math.floor(Math.random() * 60)).toDate(),
        amount: amount(patterns.rapidInOut.avgInflowAmount * (0.8 + Math.random() * 0.4)),
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
        amount: -amount(patterns.rapidInOut.avgOutflowAmount * (0.8 + Math.random() * 0.4)),
        merchant: `Transfer-${Math.floor(Math.random() * 1000)}`,
        merchantEntityId: `Entity-${Math.floor(Math.random() * 1000)}`,
        paymentChannel: Channel.online,
        pfcPrimary: PFCPrimary.transfer,
        pending: false,
      });
    }
  }

  // Pattern 3: Structuring (amounts just under thresholds)
  if (patterns.structuring.enabled && Math.random() > 0.5) {
    const threshold = pick(patterns.structuring.commonThresholds) as number;
    if (!threshold) return; // Safety check
    const numStructured = Math.floor(5 + Math.random() * 10);
    
    for (let i = 0; i < numStructured; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      // Amount between 90-99% of threshold
      const structuredAmount = amount(threshold * (0.90 + Math.random() * 0.09));
      
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

  // Pattern 4: Frequent small transfers
  if (patterns.frequentSmallTransfers.enabled && Math.random() > 0.5) {
    const numDays = Math.floor(10 + Math.random() * 20);
    
    for (let i = 0; i < numDays; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const transfersPerDay = Math.floor(patterns.frequentSmallTransfers.avgFrequency * (0.8 + Math.random() * 0.4));
      
      for (let j = 0; j < transfersPerDay; j++) {
        const date = today.subtract(daysAgo, "day");
        const txAmount = amount(patterns.frequentSmallTransfers.avgAmount * (0.7 + Math.random() * 0.6));
        
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
 */
async function generateBasicAmlPatterns(
  userId: string,
  accountId: string,
  transactions: any[],
  today: dayjs.Dayjs
) {
  // Pattern 1: High-volume transfers to single counterparty (10+ transfers)
  if (Math.random() > 0.6) {
    const counterparty = `Entity-${Math.floor(Math.random() * 1000)}`;
    const numTransfers = Math.floor(10 + Math.random() * 15); // 10-25 transfers
    
    for (let i = 0; i < numTransfers; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
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

  // Pattern 2: Rapid in/out (8+ days with same-day flows)
  if (Math.random() > 0.6) {
    const numDays = Math.floor(8 + Math.random() * 7); // 8-15 days
    
    for (let i = 0; i < numDays; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
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

  // Pattern 3: Structuring (amounts just under $10k)
  if (Math.random() > 0.7) {
    const numStructured = Math.floor(5 + Math.random() * 10);
    
    for (let i = 0; i < numStructured; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
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

