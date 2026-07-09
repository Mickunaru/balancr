import Link from "next/link";
import { Wallet } from "lucide-react";

import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Wallet className="size-5 text-primary" />
          <span className="font-heading text-lg font-semibold tracking-tight">
            Balancr
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Signed in as {session?.user?.email}
        </p>
        <div className="flex gap-2">
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/accounts" />}
          >
            View accounts
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/dashboard/transactions" />}
          >
            Transactions
          </Button>
        </div>
      </main>
    </div>
  );
}
