import { prisma } from "../src/lib/zz_prisma";
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

  console.log(`Found ${users.length} users to recompute profiles for`);

  // Delete existing profiles
  console.log("\nDeleting existing profiles...");
  const userIds = users.map((u: { id: string }) => u.id);
  await prisma.reviewItem.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.profile.deleteMany({ where: { userId: { in: userIds } } });
  console.log("  ✅ Deletion complete");

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
              reason: eduAlerts.join(" | "),
            },
          });
        }
      }
    }
  }

  // Recompute profiles for all users
  console.log("\nRecomputing profiles...");
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    console.log(`[${i + 1}/${users.length}] Computing profiles for ${user.email}...`);
    try {
      await computeProfilesForUser(user.id);
      console.log(`  ✅ Completed`);
    } catch (error) {
      console.error(`  ❌ Error: ${error}`);
    }
  }

  console.log("\n✅ Profile recomputation complete!");
  console.log(`\nSummary:`);
  console.log(`  - ${users.length} users processed`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

