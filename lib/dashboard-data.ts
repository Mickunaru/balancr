import { db } from "@/lib/db";
import { addMonths, currentMonth, monthRange } from "@/lib/month";

// Liability account types per plan.md iteration 6: Plaid reports their
// balances as amount owed (positive). Net worth subtracts them.
const LIABILITY_TYPES = new Set(["credit", "loan"]);

/** Signed contribution of an account to net worth, in cents. */
export function netCents(account: {
  type: string;
  currentBalanceCents: number;
}): number {
  return LIABILITY_TYPES.has(account.type)
    ? -account.currentBalanceCents
    : account.currentBalanceCents;
}

export async function getNetWorth(userId: string) {
  const accounts = await db.bankAccount.findMany({
    where: { item: { userId } },
    select: { type: true, currentBalanceCents: true },
  });
  let assets = 0;
  let liabilities = 0;
  for (const acct of accounts) {
    if (LIABILITY_TYPES.has(acct.type)) {
      liabilities += acct.currentBalanceCents;
    } else {
      assets += acct.currentBalanceCents;
    }
  }
  return { netWorthCents: assets - liabilities, assets, liabilities };
}

/**
 * Monthly net-worth points (last `months` month-ends plus today),
 * reconstructed backward from current balances:
 * netWorth(t) = netWorthNow + Σ txn.amount for txns dated after t.
 * (Plaid: positive amount = money out of the account; the same formula
 * holds for liabilities since purchases raise the amount owed.)
 */
export async function getNetWorthSeries(userId: string, months = 6) {
  const { netWorthCents } = await getNetWorth(userId);
  const txns = await db.transaction.findMany({
    where: { account: { item: { userId } } },
    select: { date: true, amountCents: true },
  });

  const points: { label: string; netWorthCents: number }[] = [];
  const now = currentMonth();
  for (let i = months - 1; i >= 1; i--) {
    const month = addMonths(now, -i);
    const cutoff = monthRange(month).end; // start of following month
    const afterSum = txns
      .filter((t) => t.date >= cutoff)
      .reduce((sum, t) => sum + t.amountCents, 0);
    points.push({
      label: monthShort(month),
      netWorthCents: netWorthCents + afterSum,
    });
  }
  points.push({ label: "Now", netWorthCents });
  return points;
}

/** Money in vs out per month for the last `months` months. Transfers excluded. */
export async function getCashFlow(userId: string, months = 6) {
  const start = monthRange(addMonths(currentMonth(), -(months - 1))).start;
  const txns = await db.transaction.findMany({
    where: {
      account: { item: { userId } },
      date: { gte: start },
      NOT: { category: { name: "Transfers" } },
    },
    select: { date: true, amountCents: true },
  });

  const byMonth = new Map<string, { inCents: number; outCents: number }>();
  for (let i = months - 1; i >= 0; i--) {
    byMonth.set(addMonths(currentMonth(), -i), { inCents: 0, outCents: 0 });
  }
  for (const txn of txns) {
    const key = txn.date.toISOString().slice(0, 7);
    const bucket = byMonth.get(key);
    if (!bucket) continue;
    if (txn.amountCents < 0) bucket.inCents += -txn.amountCents;
    else bucket.outCents += txn.amountCents;
  }
  return [...byMonth.entries()].map(([month, v]) => ({
    label: monthShort(month),
    ...v,
  }));
}

/**
 * Current-month spending per category, top N plus "Other".
 * Transfers and Debt Payments are movement of money, not spending.
 */
export async function getSpendingByCategory(userId: string, top = 5) {
  const { start, end } = monthRange(currentMonth());
  const rows = await db.transaction.groupBy({
    by: ["categoryId"],
    where: {
      account: { item: { userId } },
      date: { gte: start, lt: end },
      amountCents: { gt: 0 },
      category: { isNot: null },
      NOT: { category: { name: { in: ["Transfers", "Debt Payments"] } } },
    },
    _sum: { amountCents: true },
  });

  const categories = await db.category.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  const spend = rows
    .map((r) => ({
      name: nameById.get(r.categoryId!) ?? "Uncategorized",
      cents: r._sum.amountCents ?? 0,
    }))
    .filter((r) => r.cents > 0)
    .sort((a, b) => b.cents - a.cents);

  const head = spend.slice(0, top);
  const tail = spend.slice(top);
  if (tail.length > 0) {
    head.push({
      name: "Other",
      cents: tail.reduce((sum, r) => sum + r.cents, 0),
    });
  }
  return head;
}

export async function getRecentTransactions(userId: string, take = 6) {
  return db.transaction.findMany({
    where: { account: { item: { userId } } },
    include: {
      account: { select: { name: true, currencyCode: true } },
      category: { select: { name: true } },
    },
    orderBy: [{ date: "desc" }, { id: "asc" }],
    take,
  });
}

function monthShort(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-CA", {
    month: "short",
    timeZone: "UTC",
  });
}
