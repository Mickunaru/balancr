import { db } from "@/lib/db";

export type Subscription = {
  merchant: string;
  averageCents: number;
  occurrences: number;
  lastDate: string; // YYYY-MM-DD
  nextExpected: string; // YYYY-MM-DD
};

// Flag recurring charges: same merchant, similar amount (±15%), roughly
// monthly cadence (21–40 day median gap), seen at least 3 times.
export async function detectSubscriptions(
  userId: string
): Promise<Subscription[]> {
  const txns = await db.transaction.findMany({
    where: {
      account: { item: { userId } },
      amountCents: { gt: 0 }, // outflows only
      NOT: { category: { name: { in: ["Transfers", "Debt Payments"] } } },
    },
    select: { name: true, merchantName: true, amountCents: true, date: true },
    orderBy: { date: "asc" },
  });

  const groups = new Map<
    string,
    { display: string; charges: { amountCents: number; date: Date }[] }
  >();
  for (const txn of txns) {
    const display = (txn.merchantName ?? txn.name).trim();
    const key = display.toLowerCase();
    const group = groups.get(key) ?? { display, charges: [] };
    group.charges.push({ amountCents: txn.amountCents, date: txn.date });
    groups.set(key, group);
  }

  const found: Subscription[] = [];
  for (const { display, charges } of groups.values()) {
    if (charges.length < 3) continue;

    const amounts = charges.map((c) => c.amountCents).sort((a, b) => a - b);
    const medianAmount = amounts[Math.floor(amounts.length / 2)];
    const similar = charges.filter(
      (c) => Math.abs(c.amountCents - medianAmount) / medianAmount <= 0.15
    );
    if (similar.length < 3) continue;

    const gaps: number[] = [];
    for (let i = 1; i < similar.length; i++) {
      gaps.push(
        (similar[i].date.getTime() - similar[i - 1].date.getTime()) / 86_400_000
      );
    }
    gaps.sort((a, b) => a - b);
    const medianGap = gaps[Math.floor(gaps.length / 2)];
    if (medianGap < 21 || medianGap > 40) continue;

    const last = similar[similar.length - 1];
    const next = new Date(
      last.date.getTime() + Math.round(medianGap) * 86_400_000
    );

    found.push({
      merchant: display,
      averageCents: Math.round(
        similar.reduce((s, c) => s + c.amountCents, 0) / similar.length
      ),
      occurrences: similar.length,
      lastDate: last.date.toISOString().slice(0, 10),
      nextExpected: next.toISOString().slice(0, 10),
    });
  }

  return found.sort((a, b) => b.averageCents - a.averageCents);
}
