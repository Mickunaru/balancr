"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { decryptToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { plaid } from "@/lib/plaid";
import { syncAllItems } from "@/lib/sync";

export async function syncNow() {
  const session = await auth();
  if (!session?.user?.id) return;

  await syncAllItems(session.user.id);
  revalidatePath("/dashboard", "layout");
}

/**
 * Remove every linked institution and all of its accounts/transactions.
 * Revokes Plaid access tokens first so Items don't linger on Plaid's side;
 * a failed revoke (e.g. already-removed sandbox Item) doesn't block deletion.
 */
export async function clearAccountData() {
  const session = await auth();
  if (!session?.user?.id) return;

  const items = await db.item.findMany({
    where: { userId: session.user.id },
    select: { id: true, plaidItemId: true, accessToken: true },
  });

  for (const item of items) {
    if (item.plaidItemId.startsWith("manual-")) continue;
    try {
      await plaid.itemRemove({ access_token: decryptToken(item.accessToken) });
    } catch (err) {
      console.error(`itemRemove failed for item ${item.id}`, err);
    }
  }

  await db.item.deleteMany({ where: { userId: session.user.id } });
  revalidatePath("/dashboard", "layout");
}
