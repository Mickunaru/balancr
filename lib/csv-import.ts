import crypto from "node:crypto";

import { buildCategoryResolver } from "@/lib/categories";
import { db } from "@/lib/db";

export type CsvRow = {
  date: string; // ISO YYYY-MM-DD
  amountCents: number; // Plaid convention: positive = money out
  name: string;
};

// Deterministic id for a CSV row, stored in plaidTxnId ("csv-" prefix keeps
// it out of Plaid's namespace). The unique constraint makes re-importing the
// same file a no-op — same de-dup mechanism as the Plaid sync. `occurrence`
// distinguishes legitimate identical rows within one file (two same-price
// coffees on the same day) while staying stable across re-imports.
export function csvRowId(
  accountId: string,
  row: CsvRow,
  occurrence: number
): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${accountId}|${row.date}|${row.amountCents}|${row.name}|${occurrence}`)
    .digest("hex")
    .slice(0, 40);
  return `csv-${hash}`;
}

export async function importCsvRows(
  userId: string,
  accountId: string,
  rows: CsvRow[]
) {
  const resolveCategory = await buildCategoryResolver(userId);

  const seen = new Map<string, number>();
  const data = rows.map((row) => {
    const key = `${row.date}|${row.amountCents}|${row.name}`;
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    return {
      accountId,
      plaidTxnId: csvRowId(accountId, row, occurrence),
      date: new Date(row.date),
      amountCents: row.amountCents,
      name: row.name,
      pending: false,
      categoryId: resolveCategory({
        name: row.name,
        merchantName: null,
        plaidCategory: null,
      }),
    };
  });

  const result = await db.transaction.createMany({
    data,
    skipDuplicates: true, // unique plaidTxnId de-dups re-imports
  });

  return { imported: result.count, skipped: rows.length - result.count };
}
