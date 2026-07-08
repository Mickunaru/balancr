import { Wallet } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Wallet className="size-5 text-primary" />
          <span className="font-heading text-lg font-semibold tracking-tight">
            Balancr
          </span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
          Personal finance, balanced.
        </h1>
        <p className="max-w-md text-balance text-muted-foreground">
          Link your accounts, track spending, and see your net worth in one
          clean dashboard.
        </p>
        <p className="text-sm text-muted-foreground/60">Coming soon.</p>
      </main>
    </div>
  );
}
