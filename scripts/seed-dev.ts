// Dev-only demo data so the UI can be built/verified without Plaid keys.
// Run: npx tsx scripts/seed-dev.ts   (or: npm run seed)
// Safe to re-run — it clears and recreates the demo item.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_ITEM = "demo-item";

// [detailed, primary, isIncome, monthlyAmount]
const RECURRING: Array<[string, string, boolean, number]> = [
  ["INCOME_WAGES", "INCOME", true, 5200],
  ["INCOME_OTHER_INCOME", "INCOME", true, 1400],
  ["INCOME_INTEREST_EARNED", "INCOME", true, 42],
  ["LOAN_PAYMENTS_MORTGAGE_PAYMENT", "LOAN_PAYMENTS", false, 2450],
  ["RENT_AND_UTILITIES_GAS_AND_ELECTRICITY", "RENT_AND_UTILITIES", false, 165],
  ["RENT_AND_UTILITIES_INTERNET_AND_CABLE", "RENT_AND_UTILITIES", false, 89],
  ["RENT_AND_UTILITIES_TELEPHONE", "RENT_AND_UTILITIES", false, 95],
  ["GENERAL_SERVICES_INSURANCE", "GENERAL_SERVICES", false, 210],
];

// Categories that get several randomized transactions per month.
const VARIABLE: Array<[string, string, string, number, number]> = [
  // detailed, primary, merchant, min, max
  ["FOOD_AND_DRINK_GROCERIES", "FOOD_AND_DRINK", "Trader Joe's", 40, 160],
  ["FOOD_AND_DRINK_RESTAURANT", "FOOD_AND_DRINK", "Local Bistro", 22, 90],
  ["FOOD_AND_DRINK_COFFEE", "FOOD_AND_DRINK", "Blue Bottle", 4, 12],
  ["TRANSPORTATION_GAS", "TRANSPORTATION", "Shell", 35, 70],
  ["TRANSPORTATION_TAXIS_AND_RIDE_SHARES", "TRANSPORTATION", "Uber", 9, 34],
  ["GENERAL_MERCHANDISE_ONLINE_MARKETPLACES", "GENERAL_MERCHANDISE", "Amazon", 15, 120],
  ["GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES", "GENERAL_MERCHANDISE", "Nordstrom", 30, 180],
  ["ENTERTAINMENT_TV_AND_MOVIES", "ENTERTAINMENT", "Netflix", 16, 16],
  ["PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS", "PERSONAL_CARE", "Equinox", 60, 60],
  ["TRAVEL_LODGING", "TRAVEL", "Marriott", 120, 420],
];

function rand(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

async function main() {
  // Reset demo data (cascade removes accounts + transactions).
  await prisma.item.deleteMany({ where: { itemId: DEMO_ITEM } });

  const item = await prisma.item.create({
    data: {
      itemId: DEMO_ITEM,
      accessToken: "demo",
      institution: "Demo Bank",
    },
  });
  const account = await prisma.account.create({
    data: {
      accountId: "demo-checking",
      itemId: item.id,
      name: "Demo Checking",
      type: "depository",
      currentBalance: 8241.55,
    },
  });

  const now = new Date();
  const rows: Array<{
    transactionId: string;
    accountId: string;
    date: Date;
    amount: number;
    merchantName: string | null;
    name: string;
    pfPrimary: string;
    pfDetailed: string;
    isIncome: boolean;
    pending: boolean;
  }> = [];

  let n = 0;
  const push = (
    date: Date,
    amount: number,
    merchant: string,
    detailed: string,
    primary: string,
    isIncome: boolean
  ) =>
    rows.push({
      transactionId: `demo-${n++}`,
      accountId: account.accountId,
      date,
      amount,
      merchantName: merchant,
      name: merchant,
      pfPrimary: primary,
      pfDetailed: detailed,
      isIncome,
      pending: false,
    });

  // 6 months back through current month.
  for (let m = 5; m >= 0; m--) {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1));
    const y = monthDate.getUTCFullYear();
    const mo = monthDate.getUTCMonth();

    for (const [detailed, primary, isIncome, amt] of RECURRING) {
      const jitter = isIncome ? 1 : 0.9 + Math.random() * 0.2;
      push(
        new Date(Date.UTC(y, mo, isIncome ? 1 : 3)),
        Math.round(amt * jitter * 100) / 100,
        detailed.startsWith("INCOME") ? "Payroll" : detailed.split("_").slice(-1)[0],
        detailed,
        primary,
        isIncome
      );
    }

    for (const [detailed, primary, merchant, min, max] of VARIABLE) {
      const count = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const day = 2 + Math.floor(Math.random() * 26);
        push(new Date(Date.UTC(y, mo, day)), rand(min, max), merchant, detailed, primary, false);
      }
    }
  }

  await prisma.transaction.createMany({ data: rows });
  console.log(`Seeded ${rows.length} demo transactions across 6 months.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
