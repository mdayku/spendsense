import dayjs from "dayjs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const SEED = Number(process.env.SEED_USERS || 75);
function pick<T>(arr: T[]) { return arr[Math.floor(Math.random()*arr.length)]; }
function amount(n:number){ return Math.round(n*100)/100; }
export async function generate() {
  for (let i=0;i<SEED;i++) {
    const user = await prisma.user.create({ data: { name: `User ${i+1}`, email: `user${i+1}@example.test` }});
    await prisma.consent.create({ data: { userId: user.id, status: Math.random()<0.8?"OPTED_IN":"OPTED_OUT" }});
    const checking = await prisma.account.create({ data: { userId: user.id, type: "checking", subtype: "checking", numberMasked: `****${1000+i}`, isoCurrencyCode: "USD", balanceCurrent: amount(1000+Math.random()*4000) }});
    const savings = Math.random()<0.7 ? await prisma.account.create({ data: { userId: user.id, type: "savings", subtype: "savings", numberMasked: `****${2000+i}`, isoCurrencyCode: "USD", balanceCurrent: amount(500+Math.random()*8000) } }): null;
    const credit = await prisma.account.create({ data: { userId: user.id, type: "credit", subtype: "visa", numberMasked: `****${3000+i}`, isoCurrencyCode: "USD", balanceCurrent: amount(Math.random()*5000), creditLimit: 5000 }});
    await prisma.liability.create({ data: { userId: user.id, accountId: credit.id, type: "credit_card", aprType: "variable", aprPercent: 0.22, minPayment: 35, lastPayment: Math.random()<0.5?35:120, isOverdue: Math.random()<0.1, nextDueDate: dayjs().add(10, "day").toDate(), lastStmtBal: amount(credit.balanceCurrent) }});
    const start = dayjs().subtract(180, "day");
    for (let d=0; d<180; d++) {
      const date = start.add(d, "day").toDate();
      if (Math.random()<0.08) await prisma.transaction.create({ data: { userId: user.id, accountId: checking.id, date, amount: amount(1200+Math.random()*800), merchant: "Payroll ACH", paymentChannel: "online", pfcPrimary: "income" }});
      if (Math.random()<0.6) await prisma.transaction.create({ data: { userId: user.id, accountId: checking.id, date, amount: -amount(5+Math.random()*60), merchant: pick(["CoffeeCo","Grocer","Deli","Transit"]), paymentChannel: pick(["online","in_store"]), pfcPrimary: pick(["groceries","dining","other"]) as any }});
      if (d%30===0) for (const m of ["Netflux","Spootify","GymClub"]) await prisma.transaction.create({ data: { userId: user.id, accountId: checking.id, date, amount: -amount(5+Math.random()*20), merchant: m, paymentChannel: "online", pfcPrimary: "subscription" }});
      if (savings && Math.random()<0.15) await prisma.transaction.create({ data: { userId: user.id, accountId: savings.id, date, amount: amount(10+Math.random()*150), merchant: "Transfer In", paymentChannel: "online", pfcPrimary: "transfer" }});
    }
  }
}
if (require.main === module) { generate().then(()=>console.log(`Generated ${SEED} users`)).finally(()=>prisma.$disconnect()); }

