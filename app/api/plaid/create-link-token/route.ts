import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { decryptToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { plaid, PLAID_COUNTRY_CODES, PLAID_PRODUCTS } from "@/lib/plaid";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    itemId?: string;
  } | null;

  try {
    // Update mode (re-connect flow): pass the Item's access token instead
    // of products — Link re-authenticates the existing Item in place.
    let accessToken: string | undefined;
    if (body?.itemId) {
      const item = await db.item.findFirst({
        where: { id: body.itemId, userId: session.user.id },
        select: { accessToken: true },
      });
      if (!item) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      accessToken = decryptToken(item.accessToken);
    }

    // Register the webhook receiver when the app has a public URL
    // (Vercel or an ngrok tunnel); localhost is unreachable for Plaid.
    const appUrl = process.env.APP_URL;
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: session.user.id },
      client_name: "Balancr",
      country_codes: PLAID_COUNTRY_CODES,
      language: "en",
      ...(accessToken
        ? { access_token: accessToken }
        : { products: PLAID_PRODUCTS }),
      ...(appUrl ? { webhook: `${appUrl}/api/plaid/webhook` } : {}),
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error("linkTokenCreate failed", error);
    return NextResponse.json(
      { error: "Failed to create link token" },
      { status: 500 }
    );
  }
}
