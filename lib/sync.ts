import type { Transaction as PlaidTransaction } from "plaid";

import { buildCategoryResolver } from "@/lib/categories";
import { decryptToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { plaid } from "@/lib/plaid";
import { isItemLoginRequired, markItemLoginRequired } from "@/lib/plaid-errors";

// Cursor-based transaction sync for one Item (spec §5: /transactions/sync).
// Idempotent: upserts on plaidTxnId, so re-runs never double-count, and a
// reset cursor replays the same rows into the same records.
export async function syncItemTransactions(itemDbId: string) {
  const item = await db.item.findUniqueOrThrow({ where: { id: itemDbId } });
  const accessToken = decryptToken(item.accessToken);
  const resolveCategory = await buildCategoryResolver(item.userId);

  // Map Plaid account ids -> our BankAccount ids once up front.
  const accounts = await db.bankAccount.findMany({
    where: { itemId: item.id },
    select: { id: true, plaidAccountId: true },
  });
  const accountIdByPlaidId = new Map(
    accounts.map((a) => [a.plaidAccountId, a.id])
  );

  let cursor = item.syncCursor ?? undefined;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let hasMore = true;

  while (hasMore) {
    let data;
    try {
      const resp = await plaid.transactionsSync({
        access_token: accessToken,
        cursor,
        count: 500,
      });
      data = resp.data;
    } catch (error) {
      if (isItemLoginRequired(error)) {
        // Expired credentials (Wealthsimple ~30-day re-auth). Flag the
        // Item; the UI surfaces a reconnect banner (spec §9).
        await markItemLoginRequired(item.id);
      }
      throw error;
    }

    for (const txn of data.added) {
      const accountId = accountIdByPlaidId.get(txn.account_id);
      if (!accountId) continue; // account type we didn't store
      const fields = txnFields(txn);
      await db.transaction.upsert({
        where: { plaidTxnId: txn.transaction_id },
        create: {
          accountId,
          ...fields,
          plaidTxnId: txn.transaction_id,
          categoryId: resolveCategory(fields),
        },
        // Never touch categoryId on update — manual overrides win.
        update: fields,
      });
      added++;
    }

    for (const txn of data.modified) {
      const accountId = accountIdByPlaidId.get(txn.account_id);
      if (!accountId) continue;
      const fields = txnFields(txn);
      await db.transaction.upsert({
        where: { plaidTxnId: txn.transaction_id },
        create: {
          accountId,
          ...fields,
          plaidTxnId: txn.transaction_id,
          categoryId: resolveCategory(fields),
        },
        update: fields,
      });
      modified++;
    }

    if (data.removed.length > 0) {
      await db.transaction.deleteMany({
        where: {
          plaidTxnId: { in: data.removed.map((r) => r.transaction_id) },
        },
      });
      removed += data.removed.length;
    }

    cursor = data.next_cursor;
    hasMore = data.has_more;
  }

  await db.item.update({
    where: { id: item.id },
    data: { syncCursor: cursor, status: "ACTIVE" },
  });

  await refreshBalances(item.id, accessToken);
  await backfillCategories(item.userId, resolveCategory);

  return { added, modified, removed };
}

// Categorize rows that predate the rules/mapping (or were synced before
// iteration 4). Only touches categoryId=null rows, so manual choices stay.
async function backfillCategories(
  userId: string,
  resolveCategory: (txn: {
    name: string;
    merchantName: string | null;
    plaidCategory: string | null;
  }) => string | null
) {
  const uncategorized = await db.transaction.findMany({
    where: { categoryId: null, account: { item: { userId } } },
    select: {
      id: true,
      name: true,
      merchantName: true,
      plaidCategory: true,
    },
  });

  for (const txn of uncategorized) {
    const categoryId = resolveCategory(txn);
    if (categoryId) {
      await db.transaction.update({
        where: { id: txn.id },
        data: { categoryId },
      });
    }
  }
}

/** Sync every Item belonging to a user (manual "Sync now"). */
export async function syncAllItems(userId: string) {
  const items = await db.item.findMany({
    // Manual (CSV-only) items have no Plaid connection to sync.
    where: { userId, NOT: { plaidItemId: { startsWith: "manual-" } } },
    select: { id: true },
  });
  const totals = { added: 0, modified: 0, removed: 0 };
  for (const item of items) {
    // One expired Item must not block the others from syncing; it is
    // already flagged LOGIN_REQUIRED for the reconnect banner.
    try {
      const r = await syncItemTransactions(item.id);
      totals.added += r.added;
      totals.modified += r.modified;
      totals.removed += r.removed;
    } catch (error) {
      if (!isItemLoginRequired(error)) throw error;
    }
  }
  return totals;
}

function txnFields(txn: PlaidTransaction) {
  return {
    date: new Date(txn.date),
    amountCents: Math.round(txn.amount * 100), // Plaid: positive = money out
    name: txn.name,
    merchantName: txn.merchant_name ?? null,
    pending: txn.pending,
    // Detailed code when present (FOOD_AND_DRINK_GROCERIES) — it prefixes
    // the primary, so mapping can fall back to the primary match.
    plaidCategory:
      txn.personal_finance_category?.detailed ??
      txn.personal_finance_category?.primary ??
      null,
  };
}

async function refreshBalances(itemDbId: string, accessToken: string) {
  const resp = await plaid.accountsGet({ access_token: accessToken });
  for (const acct of resp.data.accounts) {
    await db.bankAccount.updateMany({
      where: { itemId: itemDbId, plaidAccountId: acct.account_id },
      data: {
        currentBalanceCents: Math.round((acct.balances.current ?? 0) * 100),
      },
    });
  }
}
