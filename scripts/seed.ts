import { PrismaClient } from "@prisma/client";
import { generate } from "./generateSynthetic";
const prisma = new PrismaClient();
async function main() {
  // Clear existing data
  await prisma.user.deleteMany();
  console.log("Cleared existing data");
  
  // Generate synthetic data
  await generate();
  console.log("Seed complete.");
}
main().finally(() => prisma.$disconnect());

