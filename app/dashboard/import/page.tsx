import type { Metadata } from "next";

import { auth } from "@/auth";
import { db } from "@/lib/db";

import { ImportClient } from "./import-client";

export const metadata: Metadata = {
  title: "Import CSV — Balancr",
};

export default async function ImportPage() {
  const session = await auth();

  const accounts = await db.bankAccount.findMany({
    where: { item: { userId: session!.user.id } },
    select: {
      id: true,
      name: true,
      item: { select: { institutionName: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Import CSV
        </h1>
        <p className="text-sm text-muted-foreground">
          Bring in transactions from a bank export — for accounts Plaid can’t
          link, or history from before you connected.
        </p>
      </div>
      <ImportClient
        accounts={accounts.map((a) => ({
          id: a.id,
          label: `${a.item.institutionName ?? "Bank"} · ${a.name}`,
        }))}
      />
    </div>
  );
}
