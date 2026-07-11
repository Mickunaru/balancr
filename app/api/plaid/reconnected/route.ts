import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { syncItemTransactions } from "@/lib/sync";

// Called after Plaid Link update mode succeeds. The access token is
// unchanged in update mode — just clear the flag and pull the backlog.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    itemId?: string;
  } | null;
  if (!body?.itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  const item = await db.item.findFirst({
    where: { id: body.itemId, userId: session.user.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.item.update({
    where: { id: item.id },
    data: { status: "ACTIVE" },
  });

  try {
    await syncItemTransactions(item.id);
  } catch (error) {
    console.error("post-reconnect sync failed", error);
    // Status update stands; webhook or manual sync catches up.
  }

  return NextResponse.json({ ok: true });
}
