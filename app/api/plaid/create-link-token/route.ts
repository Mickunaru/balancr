import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { plaid, PLAID_COUNTRY_CODES, PLAID_PRODUCTS } from "@/lib/plaid";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Register the webhook receiver when the app has a public URL
    // (Vercel or an ngrok tunnel); localhost is unreachable for Plaid.
    const appUrl = process.env.APP_URL;
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: session.user.id },
      client_name: "Balancr",
      products: PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRY_CODES,
      language: "en",
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
