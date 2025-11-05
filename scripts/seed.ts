import { PrismaClient } from "@prisma/client";
import { generate } from "./generateSynthetic";
const prisma = new PrismaClient();
async function main() {
  // Clear existing data (delete in correct order due to foreign key constraints)
  console.log("Clearing existing data...");
  await prisma.amlLabel.deleteMany();
  await prisma.reviewItem.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.liability.deleteMany();
  await prisma.account.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.user.deleteMany();
  console.log("Cleared existing data");
  
  // Generate synthetic data
  await generate();
  console.log("Seed complete.");
}
main().finally(() => prisma.$disconnect());

