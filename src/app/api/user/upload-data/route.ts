import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/zz_prisma";
import { parse } from "csv-parse/sync";
import { AccountType, Channel, PFCPrimary, LiabilityType, ConsentStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileContent = await file.text();
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    let transactions: any[] = [];

    if (fileExtension === "csv") {
      // Parse CSV
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
      });

      // Map CSV columns to our transaction format
      // Expected CSV format: date, amount, merchant, accountType, channel, category
      transactions = records.map((record: any) => ({
        date: new Date(record.date || record.Date || record.date),
        amount: parseFloat(record.amount || record.Amount || record.amount),
        merchant: record.merchant || record.Merchant || record.description || "Unknown",
        accountType: record.accountType || record.account_type || "checking",
        channel: record.channel || record.Channel || "other",
        category: record.category || record.Category || record.pfcPrimary || "other",
      }));
    } else if (fileExtension === "json") {
      // Parse JSON
      const jsonData = JSON.parse(fileContent);
      
      // Support both array of transactions or object with transactions array
      const txArray = Array.isArray(jsonData) ? jsonData : jsonData.transactions || [];
      
      transactions = txArray.map((tx: any) => ({
        date: new Date(tx.date || tx.Date),
        amount: parseFloat(tx.amount || tx.Amount),
        merchant: tx.merchant || tx.Merchant || tx.description || "Unknown",
        accountType: tx.accountType || tx.account_type || "checking",
        channel: tx.channel || tx.Channel || "other",
        category: tx.category || tx.Category || tx.pfcPrimary || "other",
      }));
    } else {
      return NextResponse.json(
        { error: "Unsupported file format. Please upload CSV or JSON." },
        { status: 400 }
      );
    }

    if (transactions.length === 0) {
      return NextResponse.json({ error: "No transactions found in file" }, { status: 400 });
    }

    // Create consent if not exists
    await prisma.consent.upsert({
      where: { userId },
      create: { userId, status: ConsentStatus.OPTED_IN },
      update: {},
    });

    // Create default accounts if they don't exist
    const existingAccounts = await prisma.account.findMany({ where: { userId } });
    
    if (existingAccounts.length === 0) {
      const checkingId = `checking_${userId}_${Date.now()}`;
      const savingsId = `savings_${userId}_${Date.now()}`;
      const creditId = `credit_${userId}_${Date.now()}`;

      await prisma.account.createMany({
        data: [
          {
            id: checkingId,
            userId,
            type: AccountType.checking,
            subtype: "checking",
            numberMasked: "****0001",
            isoCurrencyCode: "USD",
            balanceCurrent: 0,
          },
          {
            id: savingsId,
            userId,
            type: AccountType.savings,
            subtype: "savings",
            numberMasked: "****0002",
            isoCurrencyCode: "USD",
            balanceCurrent: 0,
          },
          {
            id: creditId,
            userId,
            type: AccountType.credit,
            subtype: "visa",
            numberMasked: "****0003",
            isoCurrencyCode: "USD",
            balanceCurrent: 0,
            creditLimit: 5000,
          },
        ],
      });

      // Reload accounts to get their IDs
      const accounts = await prisma.account.findMany({ where: { userId } });
      const checking = accounts.find((a: { type: AccountType }) => a.type === AccountType.checking);
      const savings = accounts.find((a: { type: AccountType }) => a.type === AccountType.savings);
      const credit = accounts.find((a: { type: AccountType }) => a.type === AccountType.credit);

      // Map transactions to accounts based on accountType
      const txData = transactions.map((tx) => {
        let accountId = checking?.id;
        if (tx.accountType === "savings" && savings) accountId = savings.id;
        if (tx.accountType === "credit" && credit) accountId = credit.id;

        return {
          userId,
          accountId: accountId!,
          date: tx.date,
          amount: tx.amount,
          merchant: tx.merchant,
          paymentChannel: mapChannel(tx.channel),
          pfcPrimary: mapCategory(tx.category),
          pending: false,
        };
      });

      await prisma.transaction.createMany({ data: txData });
    } else {
      // Use existing accounts
      const checking = existingAccounts.find((a: { type: AccountType }) => a.type === AccountType.checking) || existingAccounts[0];
      
      const txData = transactions.map((tx) => ({
        userId,
        accountId: checking.id,
        date: tx.date,
        amount: tx.amount,
        merchant: tx.merchant,
        paymentChannel: mapChannel(tx.channel),
        pfcPrimary: mapCategory(tx.category),
        pending: false,
      }));

      await prisma.transaction.createMany({ data: txData });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${transactions.length} transactions`,
      count: transactions.length,
    });
  } catch (error: any) {
    console.error("Error uploading data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload data" },
      { status: 500 }
    );
  }
}

function mapChannel(channel: string): Channel {
  const normalized = channel.toLowerCase();
  if (normalized.includes("online") || normalized.includes("web")) return Channel.online;
  if (normalized.includes("store") || normalized.includes("in-store")) return Channel.in_store;
  if (normalized.includes("atm")) return Channel.atm;
  return Channel.other;
}

function mapCategory(category: string): PFCPrimary {
  const normalized = category.toLowerCase();
  if (normalized.includes("income") || normalized.includes("salary")) return PFCPrimary.income;
  if (normalized.includes("transfer")) return PFCPrimary.transfer;
  if (normalized.includes("subscription") || normalized.includes("recurring")) return PFCPrimary.subscription;
  if (normalized.includes("grocery") || normalized.includes("groceries")) return PFCPrimary.groceries;
  if (normalized.includes("dining") || normalized.includes("restaurant") || normalized.includes("food")) return PFCPrimary.dining;
  if (normalized.includes("bill") || normalized.includes("utility")) return PFCPrimary.bills;
  if (normalized.includes("entertainment") || normalized.includes("movie") || normalized.includes("streaming")) return PFCPrimary.entertainment;
  if (normalized.includes("travel") || normalized.includes("flight") || normalized.includes("hotel")) return PFCPrimary.travel;
  return PFCPrimary.other;
}

