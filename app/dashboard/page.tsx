import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/fade-in";
import { ReconnectBanner } from "@/components/reconnect-banner";
import { db } from "@/lib/db";
import {
  getCashFlow,
  getNetWorth,
  getNetWorthSeries,
  getRecentTransactions,
  getSpendingByCategory,
} from "@/lib/dashboard-data";
import { formatCents } from "@/lib/format";

import { CashFlowChart, NetWorthChart, SpendingDonut } from "./charts";

export const metadata: Metadata = {
  title: "Overview — Balancr",
};

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [netWorth, series, cashFlow, spending, recent, erroredItems] =
    await Promise.all([
      getNetWorth(userId),
      getNetWorthSeries(userId),
      getCashFlow(userId),
      getSpendingByCategory(userId),
      getRecentTransactions(userId),
      db.item.findMany({
        where: { userId, status: { not: "ACTIVE" } },
        select: { id: true, institutionName: true },
      }),
    ]);

  const previous = series.at(-2)?.netWorthCents;
  const deltaCents =
    previous !== undefined ? netWorth.netWorthCents - previous : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <ReconnectBanner items={erroredItems} />
      <FadeIn>
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">Net worth</p>
          <p className="font-heading text-5xl font-semibold tracking-tight tabular-nums">
            {formatCents(netWorth.netWorthCents)}
          </p>
          {deltaCents !== null && deltaCents !== 0 && (
            <p className="mt-1 flex items-center gap-1 text-sm">
              {deltaCents > 0 ? (
                <ArrowUpRight className="size-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ArrowDownRight className="size-4 text-destructive" />
              )}
              <span
                className={
                  deltaCents > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }
              >
                {formatCents(Math.abs(deltaCents))}
              </span>
              <span className="text-muted-foreground">vs. last month</span>
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCents(netWorth.assets)} assets ·{" "}
            {formatCents(netWorth.liabilities)} liabilities
          </p>
        </div>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-2">
        <FadeIn delay={0.05}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Net worth over time</CardTitle>
            </CardHeader>
            <CardContent>
              <NetWorthChart data={series} />
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cash flow</CardTitle>
            </CardHeader>
            <CardContent>
              <CashFlowChart data={cashFlow} />
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.15}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spending this month</CardTitle>
            </CardHeader>
            <CardContent>
              {spending.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No spending yet this month.
                </p>
              ) : (
                <SpendingDonut data={spending} />
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.2}>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Recent transactions</CardTitle>
              <Link
                href="/dashboard/transactions"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent className="divide-y p-0 px-6">
              {recent.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Link a bank to see transactions.
                </p>
              ) : (
                recent.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {txn.merchantName ?? txn.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {txn.date.toISOString().slice(0, 10)}
                        {txn.category ? ` · ${txn.category.name}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {txn.pending && <Badge variant="outline">Pending</Badge>}
                      <p
                        className={
                          txn.amountCents < 0
                            ? "text-sm tabular-nums text-emerald-600 dark:text-emerald-400"
                            : "text-sm tabular-nums"
                        }
                      >
                        {formatCents(-txn.amountCents, txn.account.currencyCode)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
