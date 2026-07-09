"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function updateTransactionCategory(
  transactionId: string,
  categoryId: string | null
) {
  const userId = await requireUserId();

  // Ownership checks: transaction and category must belong to the user.
  const txn = await db.transaction.findFirst({
    where: { id: transactionId, account: { item: { userId } } },
    select: { id: true },
  });
  if (!txn) throw new Error("Not found");

  if (categoryId) {
    const category = await db.category.findFirst({
      where: { id: categoryId, userId },
      select: { id: true },
    });
    if (!category) throw new Error("Not found");
  }

  await db.transaction.update({
    where: { id: transactionId },
    data: { categoryId },
  });
  revalidatePath("/dashboard/transactions");
}

/**
 * "Always do this": create a Rule from the transaction's merchant and apply
 * it to every existing transaction of the user that matches. Future syncs
 * apply it before the Plaid mapping (rules win).
 */
export async function createRuleAndApply(
  transactionId: string,
  categoryId: string
) {
  const userId = await requireUserId();

  const [txn, category] = await Promise.all([
    db.transaction.findFirst({
      where: { id: transactionId, account: { item: { userId } } },
      select: { name: true, merchantName: true },
    }),
    db.category.findFirst({
      where: { id: categoryId, userId },
      select: { id: true },
    }),
  ]);
  if (!txn || !category) throw new Error("Not found");

  const matchPattern = txn.merchantName ?? txn.name;

  await db.rule.create({ data: { userId, matchPattern, categoryId } });

  // Retroactively apply to everything matching the pattern.
  const { count } = await db.transaction.updateMany({
    where: {
      account: { item: { userId } },
      OR: [
        { merchantName: { contains: matchPattern, mode: "insensitive" } },
        { name: { contains: matchPattern, mode: "insensitive" } },
      ],
    },
    data: { categoryId },
  });

  revalidatePath("/dashboard/transactions");
  return { matchPattern, applied: count };
}
