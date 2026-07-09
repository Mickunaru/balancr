import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, PiggyBank, Trash2 } from "lucide-react";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ensureDefaultCategories } from "@/lib/categories";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/format";
import { currentMonth, isValidMonth, addMonths, monthLabel, monthRange } from "@/lib/month";

import { copyLastMonth, deleteBudget, upsertBudget } from "./actions";

export const metadata: Metadata = {
  title: "Budgets — Balancr",
};

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const params = await searchParams;
  const month =
    params.month && isValidMonth(params.month) ? params.month : currentMonth();
  const { start, end } = monthRange(month);

  await ensureDefaultCategories(userId);

  const [budgets, categories, spendRows] = await Promise.all([
    db.budget.findMany({
      where: { userId, month },
      include: { category: { select: { name: true } } },
      orderBy: { category: { name: "asc" } },
    }),
    db.category.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.transaction.groupBy({
      by: ["categoryId"],
      where: {
        account: { item: { userId } },
        date: { gte: start, lt: end },
      },
      _sum: { amountCents: true },
    }),
  ]);

  // Plaid: positive = money out. Net spend per category, floored at 0.
  const spendByCategory = new Map(
    spendRows.map((r) => [r.categoryId, Math.max(0, r._sum.amountCents ?? 0)])
  );

  const budgetedIds = new Set(budgets.map((b) => b.categoryId));
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const unbudgeted = [...spendByCategory.entries()]
    .filter(([id, spent]) => id && !budgetedIds.has(id) && spent > 0)
    .map(([id, spent]) => ({ name: nameById.get(id!) ?? "Uncategorized", spent }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Budgets
          </h1>
          <p className="text-sm text-muted-foreground">
            Monthly limits vs. actual spending.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            aria-label="Previous month"
            render={<Link href={`/dashboard/budgets?month=${addMonths(month, -1)}`} />}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="w-36 text-center text-sm font-medium">
            {monthLabel(month)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            aria-label="Next month"
            render={<Link href={`/dashboard/budgets?month=${addMonths(month, 1)}`} />}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-2">
            <form action={upsertBudget} className="flex flex-wrap gap-2">
              <input type="hidden" name="month" value={month} />
              <select
                name="categoryId"
                required
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
              >
                <option value="">Category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Input
                name="limit"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Limit ($)"
                required
                className="w-28"
              />
              <Button type="submit" variant="outline">
                Set budget
              </Button>
            </form>
            <form action={copyLastMonth}>
              <input type="hidden" name="month" value={month} />
              <Button type="submit" variant="ghost" className="text-muted-foreground">
                Copy last month
              </Button>
            </form>
          </CardContent>
        </Card>

        {budgets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <PiggyBank className="size-8 text-muted-foreground" />
              <p className="font-medium">No budgets for {monthLabel(month)}</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Set a monthly limit per category above, or copy last month.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-5">
              {budgets.map((budget) => {
                const spent = spendByCategory.get(budget.categoryId) ?? 0;
                const ratio = spent / budget.limitCents;
                const over = ratio > 1;
                const near = ratio > 0.8 && ratio <= 1;
                return (
                  <div key={budget.id}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {budget.category.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <p
                          className={
                            over
                              ? "text-sm font-medium text-destructive tabular-nums"
                              : "text-sm text-muted-foreground tabular-nums"
                          }
                        >
                          {formatCents(spent)} / {formatCents(budget.limitCents)}
                          {over && " — over budget"}
                        </p>
                        <form action={deleteBudget}>
                          <input type="hidden" name="id" value={budget.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Delete ${budget.category.name} budget`}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </form>
                      </div>
                    </div>
                    <Progress
                      value={Math.min(100, ratio * 100)}
                      className={
                        over
                          ? "[&_[data-slot=progress-indicator]]:bg-destructive"
                          : near
                            ? "[&_[data-slot=progress-indicator]]:bg-amber-500"
                            : ""
                      }
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {unbudgeted.length > 0 && (
          <Card>
            <CardContent>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Spending without a budget
              </p>
              <div className="divide-y">
                {unbudgeted.map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between py-1.5"
                  >
                    <p className="text-sm">{row.name}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {formatCents(row.spent)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
