"use server";

import crypto from "node:crypto";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { encryptToken } from "@/lib/crypto";
import { importCsvRows, type CsvRow } from "@/lib/csv-import";
import { db } from "@/lib/db";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

/** Create a manual (non-Plaid) account to import CSVs into. */
export async function createManualAccount(name: string, type: string) {
  const userId = await requireUserId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name required");
  const accountType = ["credit", "loan"].includes(type) ? type : "depository";

  const item = await db.item.create({
    data: {
      userId,
      plaidItemId: `manual-${crypto.randomUUID()}`,
      accessToken: encryptToken("manual"), // placeholder; never used
      institutionName: "Manual import",
      accounts: {
        create: {
          plaidAccountId: `manual-${crypto.randomUUID()}`,
          name: trimmed,
          type: accountType,
        },
      },
    },
    include: { accounts: true },
  });

  revalidatePath("/dashboard/import");
  return { accountId: item.accounts[0].id };
}

export async function importCsv(accountId: string, rows: CsvRow[]) {
  const userId = await requireUserId();

  const account = await db.bankAccount.findFirst({
    where: { id: accountId, item: { userId } },
    select: { id: true },
  });
  if (!account) throw new Error("Not found");

  // Basic server-side validation; client already normalized.
  const valid = rows.filter(
    (r) =>
      /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
      Number.isInteger(r.amountCents) &&
      r.name.trim().length > 0
  );

  const result = await importCsvRows(userId, account.id, valid);
  revalidatePath("/dashboard", "layout");
  return { ...result, invalid: rows.length - valid.length };
}
