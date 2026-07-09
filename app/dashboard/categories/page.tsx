import type { Metadata } from "next";
import { Tags, Trash2 } from "lucide-react";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ensureDefaultCategories } from "@/lib/categories";
import { db } from "@/lib/db";

import {
  createCategory,
  deleteCategory,
  deleteRule,
  renameCategory,
} from "./actions";

export const metadata: Metadata = {
  title: "Categories — Balancr",
};

export default async function CategoriesPage() {
  const session = await auth();
  const userId = session!.user.id;

  await ensureDefaultCategories(userId);

  const [categories, rules] = await Promise.all([
    db.category.findMany({
      where: { userId },
      include: { _count: { select: { transactions: true } } },
      orderBy: { name: "asc" },
    }),
    db.rule.findMany({
      where: { userId },
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const roots = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) =>
    categories.filter((c) => c.parentId === id);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Categories
        </h1>
        <p className="text-sm text-muted-foreground">
          Your taxonomy and auto-categorization rules.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tags className="size-4" /> Taxonomy
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form action={createCategory} className="flex gap-2">
              <Input
                name="name"
                placeholder="New category name"
                required
                className="max-w-56"
              />
              <select
                name="parentId"
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                defaultValue=""
              >
                <option value="">No parent</option>
                {roots.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline">
                Add
              </Button>
            </form>

            <form action={renameCategory} className="flex gap-2">
              <select
                name="id"
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                required
              >
                <option value="">Rename…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Input
                name="name"
                placeholder="New name"
                required
                className="max-w-56"
              />
              <Button type="submit" variant="outline">
                Rename
              </Button>
            </form>

            <div className="divide-y">
              {roots.map((cat) => (
                <div key={cat.id} className="py-2">
                  <CategoryRow
                    id={cat.id}
                    name={cat.name}
                    count={cat._count.transactions}
                  />
                  {childrenOf(cat.id).map((child) => (
                    <div key={child.id} className="mt-1 ml-6">
                      <CategoryRow
                        id={child.id}
                        name={child.name}
                        count={child._count.transactions}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rules</CardTitle>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No rules yet. Re-categorize a transaction and choose
                “Always” to create one.
              </p>
            ) : (
              <div className="divide-y">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between py-2"
                  >
                    <p className="text-sm">
                      “{rule.matchPattern}” →{" "}
                      <span className="font-medium">{rule.category.name}</span>
                    </p>
                    <form action={deleteRule}>
                      <input type="hidden" name="id" value={rule.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete rule ${rule.matchPattern}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CategoryRow({
  id,
  name,
  count,
}: {
  id: string;
  name: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm">
        {name}{" "}
        <span className="text-xs text-muted-foreground">({count})</span>
      </p>
      <form action={deleteCategory}>
        <input type="hidden" name="id" value={id} />
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${name}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}
