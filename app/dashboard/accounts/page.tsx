import type { Metadata } from "next";
import { Landmark } from "lucide-react";

import { auth } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/format";

import { ConnectBankButton } from "./connect-bank-button";

export const metadata: Metadata = {
  title: "Accounts — Balancr",
};

export default async function AccountsPage() {
  const session = await auth();

  const items = await db.item.findMany({
    where: { userId: session!.user.id },
    include: { accounts: { orderBy: { name: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Accounts
          </h1>
          <p className="text-sm text-muted-foreground">
            Linked institutions and balances.
          </p>
        </div>
        <ConnectBankButton />
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Landmark className="size-8 text-muted-foreground" />
            <p className="font-medium">No accounts linked yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Connect a bank to pull in your accounts and balances. In sandbox,
              use <code className="text-foreground">user_good</code> /{" "}
              <code className="text-foreground">pass_good</code>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {items.map((item) => (
            <div key={item.id}>
              <div className="mb-2 flex items-center gap-2">
                <Landmark className="size-4 text-muted-foreground" />
                <h2 className="font-medium">
                  {item.institutionName ?? "Institution"}
                </h2>
              </div>
              <Card>
                <CardContent className="divide-y p-0">
                  {item.accounts.map((acct) => (
                    <div
                      key={acct.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{acct.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {acct.subtype ?? acct.type}
                        </p>
                      </div>
                      <p className="font-heading text-lg tabular-nums">
                        {formatCents(
                          acct.currentBalanceCents,
                          acct.currencyCode
                        )}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
