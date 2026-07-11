"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

type ErroredItem = { id: string; institutionName: string | null };

export function ReconnectBanner({ items }: { items: ErroredItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6 flex flex-col gap-2">
      {items.map((item) => (
        <ReconnectRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function ReconnectRow({ item }: { item: ErroredItem }) {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startReconnect = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json();
      if (data.link_token) setLinkToken(data.link_token);
    } finally {
      setLoading(false);
    }
  }, [item.id]);

  const onSuccess = useCallback(async () => {
    await fetch("/api/plaid/reconnected", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id }),
    });
    setLinkToken(null);
    router.refresh();
  }, [item.id, router]);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3"
    >
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="truncate text-sm">
          <span className="font-medium">
            {item.institutionName ?? "A linked bank"}
          </span>{" "}
          needs re-authentication — transactions are paused.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={startReconnect}
        disabled={loading}
      >
        {loading ? "Opening…" : "Reconnect"}
      </Button>
    </div>
  );
}
