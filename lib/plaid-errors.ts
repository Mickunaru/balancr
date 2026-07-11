import { db } from "@/lib/db";

// Plaid surfaces expired credentials (e.g. Wealthsimple's ~30-day
// re-auth, spec §9) as ITEM_LOGIN_REQUIRED on any API call.
export function isItemLoginRequired(error: unknown): boolean {
  const code = (
    error as { response?: { data?: { error_code?: string } } }
  )?.response?.data?.error_code;
  return code === "ITEM_LOGIN_REQUIRED";
}

/** Flag an Item as needing re-authentication; UI shows a reconnect banner. */
export async function markItemLoginRequired(itemDbId: string) {
  await db.item.update({
    where: { id: itemDbId },
    data: { status: "LOGIN_REQUIRED" },
  });
}
