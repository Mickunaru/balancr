import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText } from "lucide-react";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SyncNowButton } from "@/components/sync-now-button";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/format";

import { CategoryPicker } from "./category-picker";

export const metadata: Metadata = {
  title: "Transactions — Balancr",
};

const PAGE_SIZE = 25;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const where = {
    account: { item: { userId: session!.user.id } },
  };

  const [transactions, total, categories] = await Promise.all([
    db.transaction.findMany({
      where,
      include: { account: { select: { name: true, currencyCode: true } } },
      orderBy: [{ date: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.transaction.count({ where }),
    db.category.findMany({
      where: { userId: session!.user.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Transactions
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} transaction{total === 1 ? "" : "s"} across your accounts.
          </p>
        </div>
        <SyncNowButton />
      </div>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ReceiptText className="size-8 text-muted-foreground" />
            <p className="font-medium">No transactions yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Link a bank on the accounts page, then sync.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="divide-y p-0">
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {txn.merchantName ?? txn.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {txn.date.toISOString().slice(0, 10)} ·{" "}
                      {txn.account.name}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {txn.pending && (
                      <Badge variant="outline">Pending</Badge>
                    )}
                    <CategoryPicker
                      transactionId={txn.id}
                      merchantLabel={txn.merchantName ?? txn.name}
                      categoryId={txn.categoryId}
                      categories={categories}
                    />
                    <p
                      className={
                        txn.amountCents < 0
                          ? "w-24 text-right font-heading tabular-nums text-emerald-600 dark:text-emerald-400"
                          : "w-24 text-right font-heading tabular-nums"
                      }
                    >
                      {/* Plaid: positive = money out, negative = money in */}
                      {formatCents(-txn.amountCents, txn.account.currencyCode)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              {page > 1 ? (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link href={`/dashboard/transactions?page=${page - 1}`} />
                  }
                >
                  Previous
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              )}
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              {page < totalPages ? (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link href={`/dashboard/transactions?page=${page + 1}`} />
                  }
                >
                  Next
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
