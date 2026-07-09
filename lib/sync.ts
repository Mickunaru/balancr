import type { Transaction as PlaidTransaction } from "plaid";

import { decryptToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { plaid } from "@/lib/plaid";

// Cursor-based transaction sync for one Item (spec §5: /transactions/sync).
// Idempotent: upserts on plaidTxnId, so re-runs never double-count, and a
// reset cursor replays the same rows into the same records.
export async function syncItemTransactions(itemDbId: string) {
  const item = await db.item.findUniqueOrThrow({ where: { id: itemDbId } });
  const accessToken = decryptToken(item.accessToken);

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
    const resp = await plaid.transactionsSync({
      access_token: accessToken,
      cursor,
      count: 500,
    });
    const data = resp.data;

    for (const txn of data.added) {
      const accountId = accountIdByPlaidId.get(txn.account_id);
      if (!accountId) continue; // account type we didn't store
      await db.transaction.upsert({
        where: { plaidTxnId: txn.transaction_id },
        create: { accountId, ...txnFields(txn), plaidTxnId: txn.transaction_id },
        update: txnFields(txn),
      });
      added++;
    }

    for (const txn of data.modified) {
      const accountId = accountIdByPlaidId.get(txn.account_id);
      if (!accountId) continue;
      await db.transaction.upsert({
        where: { plaidTxnId: txn.transaction_id },
        create: { accountId, ...txnFields(txn), plaidTxnId: txn.transaction_id },
        update: txnFields(txn),
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

  return { added, modified, removed };
}

/** Sync every Item belonging to a user (manual "Sync now"). */
export async function syncAllItems(userId: string) {
  const items = await db.item.findMany({
    where: { userId },
    select: { id: true },
  });
  const totals = { added: 0, modified: 0, removed: 0 };
  for (const item of items) {
    const r = await syncItemTransactions(item.id);
    totals.added += r.added;
    totals.modified += r.modified;
    totals.removed += r.removed;
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
    plaidCategory: txn.personal_finance_category?.primary ?? null,
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
