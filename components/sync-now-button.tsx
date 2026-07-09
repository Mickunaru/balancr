"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { syncNow } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

export function SyncNowButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      onClick={() => startTransition(() => syncNow())}
      disabled={pending}
    >
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
      {pending ? "Syncing…" : "Sync now"}
    </Button>
  );
}
