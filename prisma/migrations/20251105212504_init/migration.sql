-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('OPTED_IN', 'OPTED_OUT');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('checking', 'savings', 'credit', 'money_market', 'hsa');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('online', 'in_store', 'atm', 'other');

-- CreateEnum
CREATE TYPE "PFCPrimary" AS ENUM ('income', 'transfer', 'subscription', 'groceries', 'dining', 'bills', 'entertainment', 'travel', 'other');

-- CreateEnum
CREATE TYPE "LiabilityType" AS ENUM ('credit_card', 'mortgage', 'student_loan');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'overridden');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'OPERATOR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "subtype" TEXT NOT NULL,
    "numberMasked" TEXT NOT NULL,
    "isoCurrencyCode" TEXT NOT NULL,
    "balanceAvailable" DOUBLE PRECISION,
    "balanceCurrent" DOUBLE PRECISION NOT NULL,
    "creditLimit" DOUBLE PRECISION,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "merchant" TEXT,
    "merchantEntityId" TEXT,
    "paymentChannel" "Channel" NOT NULL,
    "pfcPrimary" "PFCPrimary" NOT NULL,
    "pfcDetailed" TEXT,
    "pending" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "type" "LiabilityType" NOT NULL,
    "aprType" TEXT,
    "aprPercent" DOUBLE PRECISION,
    "minPayment" DOUBLE PRECISION,
    "lastPayment" DOUBLE PRECISION,
    "isOverdue" BOOLEAN DEFAULT false,
    "nextDueDate" TIMESTAMP(3),
    "lastStmtBal" DOUBLE PRECISION,
    "interestRate" DOUBLE PRECISION,

    CONSTRAINT "Liability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "subscriptionCount" INTEGER NOT NULL,
    "monthlyRecurring" DOUBLE PRECISION NOT NULL,
    "subscriptionShare" DOUBLE PRECISION NOT NULL,
    "netSavingsInflow" DOUBLE PRECISION NOT NULL,
    "savingsGrowthRate" DOUBLE PRECISION NOT NULL,
    "emergencyMonths" DOUBLE PRECISION NOT NULL,
    "utilMax" DOUBLE PRECISION NOT NULL,
    "utilFlags" TEXT NOT NULL,
    "minPayOnly" BOOLEAN NOT NULL,
    "interestCharges" BOOLEAN NOT NULL,
    "overdue" BOOLEAN NOT NULL,
    "incomeMedianGap" INTEGER NOT NULL,
    "cashBufferMonths" DOUBLE PRECISION NOT NULL,
    "persona" TEXT NOT NULL,
    "decisionTrace" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmlLabel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "extTxId" TEXT,
    "label" BOOLEAN NOT NULL,
    "amount" DOUBLE PRECISION,
    "counterparty" TEXT,
    "date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmlLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountAuth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "AccountAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Consent_userId_key" ON "Consent"("userId");

-- CreateIndex
CREATE INDEX "ReviewItem_status_createdAt_idx" ON "ReviewItem"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewItem_userId_idx" ON "ReviewItem"("userId");

-- CreateIndex
CREATE INDEX "AmlLabel_userId_idx" ON "AmlLabel"("userId");

-- CreateIndex
CREATE INDEX "AccountAuth_userId_idx" ON "AccountAuth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountAuth_provider_providerAccountId_key" ON "AccountAuth"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liability" ADD CONSTRAINT "Liability_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liability" ADD CONSTRAINT "Liability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmlLabel" ADD CONSTRAINT "AmlLabel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountAuth" ADD CONSTRAINT "AccountAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
