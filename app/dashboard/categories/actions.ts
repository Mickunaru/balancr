"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createCategory(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "") || null;
  if (!name) return;

  if (parentId) {
    const parent = await db.category.findFirst({
      where: { id: parentId, userId },
    });
    if (!parent) throw new Error("Not found");
  }

  await db.category.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name, parentId },
    update: { parentId },
  });
  revalidatePath("/dashboard/categories");
}

export async function renameCategory(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  const category = await db.category.findFirst({ where: { id, userId } });
  if (!category) throw new Error("Not found");

  await db.category.update({ where: { id }, data: { name } });
  revalidatePath("/dashboard/categories");
}

export async function deleteCategory(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");

  const category = await db.category.findFirst({ where: { id, userId } });
  if (!category) throw new Error("Not found");

  // Transactions fall back to uncategorized (SetNull); budgets and rules
  // pointing at this category are removed by cascade.
  await db.category.delete({ where: { id } });
  revalidatePath("/dashboard/categories");
}

export async function deleteRule(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");

  const rule = await db.rule.findFirst({ where: { id, userId } });
  if (!rule) throw new Error("Not found");

  await db.rule.delete({ where: { id } });
  revalidatePath("/dashboard/categories");
}
