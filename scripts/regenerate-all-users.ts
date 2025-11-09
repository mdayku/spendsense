import { prisma } from "../src/lib/zz_prisma";
import { generateSingleUserData } from "../src/lib/generateSingleUser";
import { computeSignals } from "../src/lib/signals";
import { assignPersona, shape } from "../src/lib/personas";
import { amlEducationalAlerts } from "../src/lib/alerts";

async function main() {
  console.log("Fetching all users...");
  const users = await prisma.user.findMany({
    where: {
      email: { not: { contains: "@aml.local" } }, // Exclude AML-imported users
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${users.length} users to regenerate`);

  // Select 10 users to include AML patterns (random selection)
  const usersWithAml = users.slice(0, 10);
  const usersWithoutAml = users.slice(10);

  console.log(`\n${usersWithAml.length} users will include AML patterns`);
  console.log(`${usersWithoutAml.length} users will have standard synthetic data`);

  // Delete existing data for all users (order matters due to foreign keys)
  // Use bulk deletes for better performance
  console.log("\nDeleting existing transactions and profiles...");
  const userIds = users.map((u: { id: string }) => u.id);
  
  try {
    console.log("  Deleting review items...");
    await prisma.reviewItem.deleteMany({ where: { userId: { in: userIds } } });
    
    console.log("  Deleting profiles...");
    await prisma.profile.deleteMany({ where: { userId: { in: userIds } } });
    
    console.log("  Deleting transactions...");
    await prisma.transaction.deleteMany({ where: { userId: { in: userIds } } });
    
    console.log("  Deleting AML labels...");
    await prisma.amlLabel.deleteMany({ where: { userId: { in: userIds } } });
    
    console.log("  ✅ Deletion complete");
  } catch (error: any) {
    console.error(`  ❌ Error during bulk deletion: ${error.message}`);
    throw error;
  }

  // Helper function to compute profiles for a user
  async function computeProfilesForUser(userId: string) {
    const windows: (30 | 180)[] = [30, 180];
    for (const w of windows) {
      const s = await computeSignals(userId, w);
      const persona = assignPersona(shape(s));

      const decisionTrace = {
        persona: String(persona.key),
        personaReason: String(persona.reason),
        signals: {
          subscriptionCount: Number(s.subscriptionCount) || 0,
          monthlyRecurring: Number(s.monthlyRecurring) || 0,
          subscriptionShare: Number(s.subscriptionShare) || 0,
          netSavingsInflow: Number(s.netSavingsInflow) || 0,
          savingsGrowthRate: Number(s.savingsGrowthRate) || 0,
          emergencyMonths: Number(s.emergencyMonths) || 0,
          utilMax: Number(s.utilMax) || 0,
          utilFlags: String(s.utilFlags || ""),
          incomeMedianGap: Number(s.incomeMedianGap) || 0,
          cashBufferMonths: Number(s.cashBufferMonths) || 0,
        },
      };

      const decisionTraceString = JSON.stringify(decisionTrace);

      await prisma.profile.create({
        data: {
          userId,
          windowDays: w,
          subscriptionCount: s.subscriptionCount,
          monthlyRecurring: s.monthlyRecurring,
          subscriptionShare: s.subscriptionShare,
          netSavingsInflow: s.netSavingsInflow,
          savingsGrowthRate: s.savingsGrowthRate,
          emergencyMonths: s.emergencyMonths,
          utilMax: s.utilMax,
          utilFlags: s.utilFlags,
          minPayOnly: s.minPayOnly,
          interestCharges: s.interestCharges,
          overdue: s.overdue,
          incomeMedianGap: s.incomeMedianGap,
          cashBufferMonths: s.cashBufferMonths,
          persona: persona.key,
          decisionTrace: decisionTraceString,
        },
      });

      // Enqueue review if AML alerts present
      const userTx = await prisma.transaction.findMany({ where: { userId } });
      const eduAlerts = amlEducationalAlerts(userTx, w);
      if (eduAlerts.length > 0) {
        const profile = await prisma.profile.findFirst({
          where: { userId, windowDays: w },
          orderBy: { createdAt: "desc" },
        });
        if (profile) {
          await prisma.reviewItem.create({
            data: {
              userId,
              profileId: profile.id,
              reason: `aml_alerts: ${eduAlerts.join(" | ")}`,
            },
          });
        }
      }
    }
  }

  // Regenerate with AML patterns for first 10 users
  console.log("\nGenerating synthetic data with AML patterns...");
  for (let i = 0; i < usersWithAml.length; i++) {
    const user = usersWithAml[i];
    console.log(`[${i + 1}/${usersWithAml.length}] Generating data for ${user.email} (with AML patterns)...`);
    try {
      await generateSingleUserData(user.id, true); // includeAmlPatterns = true
      console.log(`  Computing profiles...`);
      await computeProfilesForUser(user.id);
      console.log(`  ✅ Completed`);
    } catch (error) {
      console.error(`  ❌ Error: ${error}`);
    }
  }

  // Regenerate standard data for remaining users
  console.log("\nGenerating standard synthetic data...");
  for (let i = 0; i < usersWithoutAml.length; i++) {
    const user = usersWithoutAml[i];
    console.log(`[${i + 1}/${usersWithoutAml.length}] Generating data for ${user.email}...`);
    try {
      await generateSingleUserData(user.id, false); // includeAmlPatterns = false
      console.log(`  Computing profiles...`);
      await computeProfilesForUser(user.id);
      console.log(`  ✅ Completed`);
    } catch (error) {
      console.error(`  ❌ Error: ${error}`);
    }
  }

  console.log("\n✅ Regeneration complete!");
  console.log(`\nSummary:`);
  console.log(`  - ${usersWithAml.length} users with AML patterns`);
  console.log(`  - ${usersWithoutAml.length} users with standard patterns`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

