"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { addMonths, isValidMonth } from "@/lib/month";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function upsertBudget(formData: FormData) {
  const userId = await requireUserId();

  const categoryId = String(formData.get("categoryId") ?? "");
  const month = String(formData.get("month") ?? "");
  const limitDollars = Number(formData.get("limit"));
  if (!categoryId || !isValidMonth(month)) return;
  if (!Number.isFinite(limitDollars) || limitDollars <= 0) return;

  const category = await db.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });
  if (!category) throw new Error("Not found");

  const limitCents = Math.round(limitDollars * 100);

  await db.budget.upsert({
    where: { userId_categoryId_month: { userId, categoryId, month } },
    create: { userId, categoryId, month, limitCents },
    update: { limitCents },
  });
  revalidatePath("/dashboard/budgets");
}

export async function deleteBudget(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");

  const budget = await db.budget.findFirst({ where: { id, userId } });
  if (!budget) throw new Error("Not found");

  await db.budget.delete({ where: { id } });
  revalidatePath("/dashboard/budgets");
}

/** Copy the previous month's budgets into `month` (existing ones kept). */
export async function copyLastMonth(formData: FormData) {
  const userId = await requireUserId();
  const month = String(formData.get("month") ?? "");
  if (!isValidMonth(month)) return;

  const previous = await db.budget.findMany({
    where: { userId, month: addMonths(month, -1) },
    select: { categoryId: true, limitCents: true },
  });

  await db.budget.createMany({
    data: previous.map((b) => ({
      userId,
      categoryId: b.categoryId,
      month,
      limitCents: b.limitCents,
    })),
    skipDuplicates: true,
  });
  revalidatePath("/dashboard/budgets");
}
