"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createRuleAndApply, updateTransactionCategory } from "./actions";

const UNCATEGORIZED = "__none__";

export function CategoryPicker({
  transactionId,
  merchantLabel,
  categoryId,
  categories,
}: {
  transactionId: string;
  merchantLabel: string;
  categoryId: string | null;
  categories: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [offerRule, setOfferRule] = useState<string | null>(null);
  const [ruleSaved, setRuleSaved] = useState(false);

  function onChange(value: string | null) {
    const next = value === UNCATEGORIZED || value === null ? null : value;
    startTransition(async () => {
      await updateTransactionCategory(transactionId, next);
      setOfferRule(next);
      setRuleSaved(false);
    });
  }

  function onRemember() {
    if (!offerRule) return;
    startTransition(async () => {
      await createRuleAndApply(transactionId, offerRule);
      setRuleSaved(true);
      setOfferRule(null);
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      {offerRule && !pending && (
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          onClick={onRemember}
        >
          Always for “{merchantLabel}”?
        </Button>
      )}
      {ruleSaved && (
        <span className="text-xs text-muted-foreground">Rule saved</span>
      )}
      <Select
        items={[
          { value: UNCATEGORIZED, label: "Uncategorized" },
          ...categories.map((c) => ({ value: c.id, label: c.name })),
        ]}
        value={categoryId ?? UNCATEGORIZED}
        onValueChange={onChange}
        disabled={pending}
      >
        <SelectTrigger size="sm" className="w-36">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNCATEGORIZED}>
            <span className="text-muted-foreground">Uncategorized</span>
          </SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
