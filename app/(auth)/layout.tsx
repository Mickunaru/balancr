import Link from "next/link";
import { Wallet } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <Wallet className="size-5 text-primary" />
          <span className="font-heading text-lg font-semibold tracking-tight">
            Balancr
          </span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        {children}
      </main>
    </div>
  );
}
