import Link from "next/link";
import { Wallet } from "lucide-react";

import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

import { NavLinks } from "./nav-links";

export default function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
              <Wallet className="size-5 text-primary" />
              <span className="font-heading text-lg font-semibold tracking-tight">
                Balancr
              </span>
            </Link>
            <div className="hidden min-w-0 lg:block">
              <NavLinks />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
        </div>
        <div className="border-t px-4 py-2 lg:hidden">
          <NavLinks />
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
