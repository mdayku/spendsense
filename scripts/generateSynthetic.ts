import dayjs from "dayjs";
import { PrismaClient, AccountType, Channel, PFCPrimary, LiabilityType, ConsentStatus } from "@prisma/client";
const prisma = new PrismaClient();
const SEED = Number(process.env.SEED_USERS || 75);
function pick<T>(arr: T[]) { return arr[Math.floor(Math.random()*arr.length)]; }
function amount(n:number){ return Math.round(n*100)/100; }

export async function generate() {
  console.log(`Generating ${SEED} users with batch inserts (much faster!)...`);
  
  const users = [];
  const consents = [];
  const accounts = [];
  const liabilities = [];
  const transactions = [];
  
  // Build all the data in memory first
  for (let i=0;i<SEED;i++) {
    if (i % 10 === 0) console.log(`Preparing user ${i+1}/${SEED}...`);
    
    const userId = `user_${i}_${Date.now()}`;
    users.push({ id: userId, name: `User ${i+1}`, email: `user${i+1}@example.test` });
    consents.push({ userId, status: Math.random()<0.8 ? ConsentStatus.OPTED_IN : ConsentStatus.OPTED_OUT });
    
    const checkingId = `checking_${i}_${Date.now()}`;
    const savingsId = `savings_${i}_${Date.now()}`;
    const creditId = `credit_${i}_${Date.now()}`;
    
    accounts.push({ 
      id: checkingId, userId, type: AccountType.checking, subtype: "checking", 
      numberMasked: `****${1000+i}`, isoCurrencyCode: "USD", 
      balanceCurrent: amount(1000+Math.random()*4000) 
    });
    
    if (Math.random()<0.7) {
      accounts.push({ 
        id: savingsId, userId, type: AccountType.savings, subtype: "savings", 
        numberMasked: `****${2000+i}`, isoCurrencyCode: "USD", 
        balanceCurrent: amount(500+Math.random()*8000) 
      });
    }
    
    accounts.push({ 
      id: creditId, userId, type: AccountType.credit, subtype: "visa", 
      numberMasked: `****${3000+i}`, isoCurrencyCode: "USD", 
      balanceCurrent: amount(Math.random()*5000), creditLimit: 5000 
    });
    
    liabilities.push({ 
      userId, accountId: creditId, type: LiabilityType.credit_card, aprType: "variable", 
      aprPercent: 0.22, minPayment: 35, lastPayment: Math.random()<0.5?35:120, 
      isOverdue: Math.random()<0.1, nextDueDate: dayjs().add(10, "day").toDate(), 
      lastStmtBal: amount(Math.random()*5000) 
    });
    
    const start = dayjs().subtract(180, "day");
    for (let d=0; d<180; d++) {
      const date = start.add(d, "day").toDate();
      if (Math.random()<0.08) {
        transactions.push({ 
          userId, accountId: checkingId, date, 
          amount: amount(1200+Math.random()*800), merchant: "Payroll ACH", 
          paymentChannel: Channel.online, pfcPrimary: PFCPrimary.income 
        });
      }
      if (Math.random()<0.6) {
        transactions.push({ 
          userId, accountId: checkingId, date, 
          amount: -amount(5+Math.random()*60), 
          merchant: pick(["CoffeeCo","Grocer","Deli","Transit"]), 
          paymentChannel: pick([Channel.online, Channel.in_store]), 
          pfcPrimary: pick([PFCPrimary.groceries, PFCPrimary.dining, PFCPrimary.other]) 
        });
      }
      if (d%30===0) {
        for (const m of ["Netflux","Spootify","GymClub"]) {
          transactions.push({ 
            userId, accountId: checkingId, date, 
            amount: -amount(5+Math.random()*20), merchant: m, 
            paymentChannel: Channel.online, pfcPrimary: PFCPrimary.subscription 
          });
        }
      }
      if (accounts.find(a => a.id === savingsId) && Math.random()<0.15) {
        transactions.push({ 
          userId, accountId: savingsId, date, 
          amount: amount(10+Math.random()*150), merchant: "Transfer In", 
          paymentChannel: Channel.online, pfcPrimary: PFCPrimary.transfer 
        });
      }
    }
  }
  
  // Now do batch inserts - MUCH faster!
  console.log(`Inserting ${users.length} users...`);
  await prisma.user.createMany({ data: users });
  
  console.log(`Inserting ${consents.length} consents...`);
  await prisma.consent.createMany({ data: consents });
  
  console.log(`Inserting ${accounts.length} accounts...`);
  await prisma.account.createMany({ data: accounts });
  
  console.log(`Inserting ${liabilities.length} liabilities...`);
  await prisma.liability.createMany({ data: liabilities });
  
  console.log(`Inserting ${transactions.length} transactions in batches...`);
  // Insert transactions in chunks of 1000 to avoid memory issues
  const chunkSize = 1000;
  for (let i = 0; i < transactions.length; i += chunkSize) {
    const chunk = transactions.slice(i, i + chunkSize);
    await prisma.transaction.createMany({ data: chunk });
    console.log(`  Inserted ${Math.min(i + chunkSize, transactions.length)}/${transactions.length} transactions`);
  }
  
  console.log(`Generated ${SEED} users with ${transactions.length} transactions!`);
}

if (require.main === module) { 
  generate().then(()=>console.log(`Generated ${SEED} users`)).finally(()=>prisma.$disconnect()); 
}
