import { prisma } from "@/lib/zz_prisma";
import { AccountType, Channel, PFCPrimary, LiabilityType, ConsentStatus } from "@prisma/client";
import dayjs from "dayjs";

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function amount(n: number) {
  return Math.round(n * 100) / 100;
}

export async function generateSingleUserData(userId: string) {
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
  const merchants = [
    "Amazon",
    "Starbucks",
    "Whole Foods",
    "Shell",
    "Netflix",
    "Spotify",
    "Apple",
    "Target",
    "Walmart",
    "CVS",
  ];

  for (let i = 0; i < 90; i++) {
    const date = today.subtract(i, "day");
    const numTx = Math.floor(Math.random() * 3) + 1; // 1-3 transactions per day

    for (let j = 0; j < numTx; j++) {
      const accountId = pick(accounts);
      const txAmount = amount(Math.random() * 200 + 10);
      const merchant = pick(merchants);

      transactions.push({
        userId,
        accountId,
        date: date.toDate(),
        amount: txAmount,
        merchant,
        paymentChannel: pick(Object.values(Channel)),
        pfcPrimary: pick(Object.values(PFCPrimary)),
        pending: Math.random() < 0.1,
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

