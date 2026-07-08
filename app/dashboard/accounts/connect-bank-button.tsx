"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ConnectBankButton() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch a fresh link token when the user intends to connect.
  const fetchLinkToken = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
      });
      const data = await res.json();
      if (data.link_token) setLinkToken(data.link_token);
    } finally {
      setLoading(false);
    }
  }, []);

  const onSuccess = useCallback(
    async (publicToken: string) => {
      await fetch("/api/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      });
      setLinkToken(null);
      router.refresh();
    },
    [router]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  // Open Plaid Link as soon as we have a token and the SDK is ready.
  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <Button onClick={fetchLinkToken} disabled={loading}>
      <Plus className="size-4" />
      {loading ? "Preparing…" : "Connect a bank"}
    </Button>
  );
}
