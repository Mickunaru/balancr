// Seeds the sandbox DB with realistic demo data for README screenshots.
// Run: npx dotenv -e .env -- npx tsx seed-demo.ts   (from project root)
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const EMAIL = "test@balancr.dev";

// Plaid convention: positive cents = money OUT, negative = money IN.
type Txn = {
  acct: string;
  date: string;
  amount: number; // dollars, sign per Plaid convention
  name: string;
  merchant?: string;
  cat: string | null;
  pending?: boolean;
};

function monthsBack(n: number): string[] {
  // Returns ["2026-02", ..., "2026-07"] for n=6 ending current month.
  const out: string[] = [];
  const now = new Date(Date.UTC(2026, 6, 16));
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

async function main() {
  const user = await db.user.findUnique({ where: { email: EMAIL } });
  if (!user) throw new Error(`user ${EMAIL} not found`);
  const userId = user.id;

  // Clean slate: items cascade to accounts + transactions.
  await db.item.deleteMany({ where: { userId } });

  const categories = await db.category.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const catId = new Map(categories.map((c) => [c.name, c.id]));
  const cat = (name: string | null) =>
    name ? (catId.get(name) ?? null) : null;

  const rbc = await db.item.create({
    data: {
      userId,
      plaidItemId: "demo-item-rbc",
      accessToken: "demo.demo.demo",
      institutionId: "ins_demo_rbc",
      institutionName: "RBC Royal Bank",
      accounts: {
        create: [
          {
            plaidAccountId: "demo-rbc-chequing",
            name: "Chequing",
            officialName: "RBC Day to Day Banking",
            type: "depository",
            subtype: "checking",
            currentBalanceCents: 483217,
            currencyCode: "CAD",
          },
          {
            plaidAccountId: "demo-rbc-savings",
            name: "Savings",
            officialName: "RBC High Interest eSavings",
            type: "depository",
            subtype: "savings",
            currentBalanceCents: 1245000,
            currencyCode: "CAD",
          },
          {
            plaidAccountId: "demo-rbc-credit",
            name: "Cash Back Mastercard",
            type: "credit",
            subtype: "credit card",
            currentBalanceCents: 124355,
            currencyCode: "CAD",
          },
        ],
      },
    },
    include: { accounts: true },
  });

  const ws = await db.item.create({
    data: {
      userId,
      plaidItemId: "demo-item-wealthsimple",
      accessToken: "demo.demo.demo",
      institutionId: "ins_demo_ws",
      institutionName: "Wealthsimple",
      accounts: {
        create: [
          {
            plaidAccountId: "demo-ws-tfsa",
            name: "TFSA",
            officialName: "Wealthsimple Invest TFSA",
            type: "investment",
            subtype: "tfsa",
            currentBalanceCents: 1832040,
            currencyCode: "CAD",
          },
        ],
      },
    },
    include: { accounts: true },
  });

  const acctId = new Map<string, string>();
  for (const a of [...rbc.accounts, ...ws.accounts]) {
    acctId.set(a.plaidAccountId, a.id);
  }

  const txns: Txn[] = [];
  const months = monthsBack(6);
  let n = 0;

  for (const m of months) {
    const isCurrent = m === "2026-07";
    const day = (d: number) => `${m}-${String(d).padStart(2, "0")}`;
    const inMonth = (d: number) => !isCurrent || d <= 16;

    // Income: biweekly paycheque into chequing.
    for (const d of [1, 15]) {
      if (!inMonth(d)) continue;
      txns.push({
        acct: "demo-rbc-chequing",
        date: day(d),
        amount: -2450,
        name: "PAYROLL DEPOSIT - ACME STUDIO",
        cat: "Income",
      });
    }

    // Housing + utilities from chequing.
    if (inMonth(1))
      txns.push({ acct: "demo-rbc-chequing", date: day(1), amount: 1650, name: "E-TRANSFER RENT", cat: "Housing" });
    if (inMonth(5))
      txns.push({ acct: "demo-rbc-chequing", date: day(5), amount: 86.4 + n * 0.7, name: "HYDRO-QUEBEC", merchant: "Hydro-Québec", cat: "Services" });
    if (inMonth(8))
      txns.push({ acct: "demo-rbc-chequing", date: day(8), amount: 45, name: "FIZZ MOBILE", merchant: "Fizz", cat: "Services" });

    // Transit pass.
    if (inMonth(3))
      txns.push({ acct: "demo-rbc-chequing", date: day(3), amount: 97, name: "STM OPUS MENSUEL", merchant: "STM", cat: "Transport" });

    // Savings transfer pair.
    if (inMonth(2)) {
      txns.push({ acct: "demo-rbc-chequing", date: day(2), amount: 300, name: "TRANSFER TO SAVINGS", cat: "Transfers" });
      txns.push({ acct: "demo-rbc-savings", date: day(2), amount: -300, name: "TRANSFER FROM CHEQUING", cat: "Transfers" });
    }

    // Credit-card payment pair.
    if (inMonth(11)) {
      txns.push({ acct: "demo-rbc-chequing", date: day(11), amount: 950, name: "MASTERCARD PAYMENT", cat: "Debt Payments" });
      txns.push({ acct: "demo-rbc-credit", date: day(11), amount: -950, name: "AUTOMATIC PAYMENT - THANK YOU", cat: "Debt Payments" });
    }

    // Subscriptions on the credit card (regular → recurring detection).
    if (inMonth(4))
      txns.push({ acct: "demo-rbc-credit", date: day(4), amount: 16.99, name: "NETFLIX.COM", merchant: "Netflix", cat: "Subscriptions" });
    if (inMonth(9))
      txns.push({ acct: "demo-rbc-credit", date: day(9), amount: 11.99, name: "SPOTIFY", merchant: "Spotify", cat: "Subscriptions" });
    if (inMonth(12))
      txns.push({ acct: "demo-rbc-credit", date: day(12), amount: 24.99, name: "CRUNCHYROLL", merchant: "Crunchyroll", cat: "Subscriptions" });

    // Groceries: weekly-ish on credit card.
    const groceryStops: [number, string, number][] = [
      [6, "IGA EXTRA", 92.35],
      [13, "METRO PLUS", 74.1],
      [20, "COSTCO WHOLESALE", 158.6],
      [27, "IGA EXTRA", 88.75],
    ];
    for (const [d, store, amt] of groceryStops) {
      if (!inMonth(d)) continue;
      txns.push({ acct: "demo-rbc-credit", date: day(d), amount: amt + (n % 3) * 4.5, name: store, merchant: store, cat: "Groceries" });
    }

    // Dining + coffee.
    if (inMonth(7))
      txns.push({ acct: "demo-rbc-credit", date: day(7), amount: 48.2, name: "RESTO SUSHI ST-DENIS", cat: "Dining" });
    if (inMonth(18))
      txns.push({ acct: "demo-rbc-credit", date: day(18), amount: 32.6, name: "LA BANQUISE", merchant: "La Banquise", cat: "Dining" });
    if (inMonth(10))
      txns.push({ acct: "demo-rbc-credit", date: day(10), amount: 6.75, name: "CAFE OLIMPICO", merchant: "Café Olimpico", cat: "Coffee" });
    if (inMonth(21))
      txns.push({ acct: "demo-rbc-credit", date: day(21), amount: 5.9, name: "TIM HORTONS", merchant: "Tim Hortons", cat: "Coffee" });

    // Occasional shopping / entertainment / transport.
    if (inMonth(14))
      txns.push({ acct: "demo-rbc-credit", date: day(14), amount: 64.3 + n * 3, name: "AMAZON.CA", merchant: "Amazon", cat: "Shopping" });
    if (inMonth(19))
      txns.push({ acct: "demo-rbc-credit", date: day(19), amount: 28.5, name: "CINEMA BANQUE SCOTIA", cat: "Entertainment" });
    if (inMonth(23))
      txns.push({ acct: "demo-rbc-credit", date: day(23), amount: 14.2, name: "UBER TRIP", merchant: "Uber", cat: "Transport" });

    n++;
  }

  // One-off purchases so the net-worth curve has believable dips.
  const oneOffs: Txn[] = [
    { acct: "demo-rbc-credit", date: "2026-03-15", amount: 312.4, name: "IKEA MONTREAL", merchant: "IKEA", cat: "Home" },
    { acct: "demo-rbc-credit", date: "2026-04-08", amount: 438.19, name: "AIR CANADA", merchant: "Air Canada", cat: "Travel" },
    { acct: "demo-rbc-credit", date: "2026-04-22", amount: 96.3, name: "SAQ SELECTION", merchant: "SAQ", cat: "Shopping" },
    { acct: "demo-rbc-chequing", date: "2026-05-13", amount: 180, name: "CLINIQUE DENTAIRE MILE-END", cat: "Health" },
    { acct: "demo-rbc-credit", date: "2026-06-06", amount: 124.5, name: "TICKETMASTER - OSHEAGA", merchant: "Ticketmaster", cat: "Entertainment" },
    { acct: "demo-rbc-credit", date: "2026-06-27", amount: 89.99, name: "DECATHLON", merchant: "Decathlon", cat: "Shopping" },
    { acct: "demo-rbc-chequing", date: "2026-02-20", amount: 145, name: "SAAQ IMMATRICULATION", cat: "Services" },
  ];
  txns.push(...oneOffs);

  // A couple of pending transactions dated "today".
  txns.push({ acct: "demo-rbc-credit", date: "2026-07-16", amount: 41.87, name: "IGA EXTRA", merchant: "IGA", cat: "Groceries", pending: true });
  txns.push({ acct: "demo-rbc-chequing", date: "2026-07-16", amount: 6.75, name: "CAFE OLIMPICO", merchant: "Café Olimpico", cat: "Coffee", pending: true });

  let i = 0;
  await db.transaction.createMany({
    data: txns.map((t) => ({
      accountId: acctId.get(t.acct)!,
      plaidTxnId: `demo-txn-${i++}`,
      date: new Date(t.date),
      amountCents: Math.round(t.amount * 100),
      name: t.name,
      merchantName: t.merchant ?? null,
      pending: t.pending ?? false,
      categoryId: cat(t.cat),
    })),
  });

  // Budgets for the current month.
  const budgets: [string, number][] = [
    ["Groceries", 600],
    ["Dining", 200],
    ["Subscriptions", 60],
    ["Transport", 150],
    ["Entertainment", 100],
    ["Shopping", 250],
  ];
  for (const [name, dollars] of budgets) {
    const id = cat(name);
    if (!id) continue;
    await db.budget.upsert({
      where: { userId_categoryId_month: { userId, categoryId: id, month: "2026-07" } },
      create: { userId, categoryId: id, month: "2026-07", limitCents: dollars * 100 },
      update: { limitCents: dollars * 100 },
    });
  }

  // A couple of auto-categorization rules for the Categories page.
  await db.rule.deleteMany({ where: { userId } });
  for (const [pattern, name] of [
    ["NETFLIX", "Subscriptions"],
    ["OLIMPICO", "Coffee"],
    ["IGA", "Groceries"],
  ] as const) {
    const id = cat(name);
    if (!id) continue;
    await db.rule.create({ data: { userId, matchPattern: pattern, categoryId: id } });
  }

  console.log(`seeded ${txns.length} transactions, ${budgets.length} budgets for ${EMAIL}`);
}

main().finally(() => db.$disconnect());
