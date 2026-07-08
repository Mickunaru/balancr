import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { encryptToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { plaid, PLAID_COUNTRY_CODES } from "@/lib/plaid";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    public_token?: string;
  } | null;
  const publicToken = body?.public_token;
  if (!publicToken) {
    return NextResponse.json(
      { error: "Missing public_token" },
      { status: 400 }
    );
  }

  try {
    const exchange = await plaid.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const accessToken = exchange.data.access_token;
    const plaidItemId = exchange.data.item_id;

    // Resolve institution for a friendly display name.
    const itemResp = await plaid.itemGet({ access_token: accessToken });
    const institutionId = itemResp.data.item.institution_id ?? null;
    let institutionName: string | null = null;
    if (institutionId) {
      const inst = await plaid.institutionsGetById({
        institution_id: institutionId,
        country_codes: PLAID_COUNTRY_CODES,
      });
      institutionName = inst.data.institution.name;
    }

    const accountsResp = await plaid.accountsGet({ access_token: accessToken });

    // Persist Item (encrypted token) + its accounts atomically.
    await db.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
          userId: session.user.id,
          plaidItemId,
          accessToken: encryptToken(accessToken),
          institutionId,
          institutionName,
        },
      });

      for (const acct of accountsResp.data.accounts) {
        const balance = acct.balances.current ?? 0;
        await tx.bankAccount.create({
          data: {
            itemId: item.id,
            plaidAccountId: acct.account_id,
            name: acct.name,
            officialName: acct.official_name ?? null,
            type: String(acct.type),
            subtype: acct.subtype ? String(acct.subtype) : null,
            currentBalanceCents: Math.round(balance * 100),
            currencyCode: acct.balances.iso_currency_code ?? "CAD",
          },
        });
      }
    });

    return NextResponse.json({ ok: true, institutionName });
  } catch (error) {
    console.error("plaid exchange failed", error);
    return NextResponse.json(
      { error: "Failed to link account" },
      { status: 500 }
    );
  }
}
