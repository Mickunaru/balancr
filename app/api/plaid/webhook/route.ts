import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { verifyPlaidWebhook } from "@/lib/plaid-webhook-verify";
import { syncItemTransactions } from "@/lib/sync";

// Plaid posts webhooks here (spec §5). SYNC_UPDATES_AVAILABLE → pull the
// delta via /transactions/sync. Item error webhooks are iteration 7's
// re-connect flow; log them for now.
export async function POST(request: Request) {
  const rawBody = await request.text();

  const verified = await verifyPlaidWebhook(
    rawBody,
    request.headers.get("plaid-verification")
  );
  if (!verified) {
    return NextResponse.json({ error: "Verification failed" }, { status: 401 });
  }

  let payload: {
    webhook_type?: string;
    webhook_code?: string;
    item_id?: string;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { webhook_type, webhook_code, item_id } = payload;

  if (
    webhook_type === "TRANSACTIONS" &&
    webhook_code === "SYNC_UPDATES_AVAILABLE" &&
    item_id
  ) {
    const item = await db.item.findUnique({
      where: { plaidItemId: item_id },
      select: { id: true },
    });
    if (item) {
      try {
        const result = await syncItemTransactions(item.id);
        console.log(`webhook sync for item ${item_id}:`, result);
      } catch (error) {
        console.error(`webhook sync failed for item ${item_id}`, error);
        // Still 200 — Plaid retries are not needed; next sync catches up.
      }
    }
  } else {
    console.log("unhandled plaid webhook", webhook_type, webhook_code);
  }

  return NextResponse.json({ received: true });
}
