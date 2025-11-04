import { PrismaClient } from "@prisma/client";
import { generate } from "./generateSynthetic";
const prisma = new PrismaClient();
async function main() {
  // Use queryRawUnsafe for PRAGMA as it returns results
  await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
  await prisma.user.deleteMany();
  await prisma.$disconnect();
  await generate();
  console.log("Seed complete.");
}
main();

