"use client";

import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import { FileUp, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCents } from "@/lib/format";

import { createManualAccount, importCsv } from "./actions";

type ParsedCsv = { headers: string[]; rows: Record<string, string>[] };
type Mapping = { date: string; amount: string; description: string };

const NEW_ACCOUNT = "__new__";

export function ImportClient({
  accounts,
}: {
  accounts: { id: string; label: string }[];
}) {
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Mapping>({
    date: "",
    amount: "",
    description: "",
  });
  const [dateFormat, setDateFormat] = useState("auto");
  const [expensesNegative, setExpensesNegative] = useState(true);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? NEW_ACCOUNT);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState("depository");
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File) {
    setFileName(file.name);
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headers = res.meta.fields ?? [];
        setCsv({ headers, rows: res.data });
        setMapping({
          date: guessColumn(headers, ["date", "posted"]),
          amount: guessColumn(headers, ["amount", "value", "debit"]),
          description: guessColumn(headers, [
            "description",
            "name",
            "merchant",
            "payee",
            "memo",
          ]),
        });
      },
    });
  }

  const preview = useMemo(() => {
    if (!csv || !mapping.date || !mapping.amount || !mapping.description) {
      return [];
    }
    return csv.rows.slice(0, 8).map((row) => normalizeRow(row, mapping, dateFormat, expensesNegative));
  }, [csv, mapping, dateFormat, expensesNegative]);

  const validPreview = preview.filter((r) => r !== null);

  function onImport() {
    if (!csv) return;
    startTransition(async () => {
      let targetId = accountId;
      if (targetId === NEW_ACCOUNT) {
        if (!newAccountName.trim()) {
          setResult("Give the new account a name first.");
          return;
        }
        const created = await createManualAccount(
          newAccountName,
          newAccountType
        );
        targetId = created.accountId;
      }
      const rows = csv.rows
        .map((row) => normalizeRow(row, mapping, dateFormat, expensesNegative))
        .filter((r): r is NonNullable<typeof r> => r !== null);
      const res = await importCsv(targetId, rows);
      setResult(
        `Imported ${res.imported} transaction${res.imported === 1 ? "" : "s"}` +
          (res.skipped > 0 ? `, ${res.skipped} duplicates skipped` : "") +
          (res.invalid > 0 ? `, ${res.invalid} rows unreadable` : "") +
          "."
      );
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileUp className="size-4" /> 1. Choose file
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
          {fileName && (
            <p className="mt-2 text-sm text-muted-foreground">
              {fileName} — {csv?.rows.length ?? 0} rows
            </p>
          )}
        </CardContent>
      </Card>

      {csv && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Map columns</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {(["date", "amount", "description"] as const).map((field) => (
                <div key={field} className="flex flex-col gap-1.5">
                  <Label className="capitalize">{field}</Label>
                  <select
                    value={mapping[field]}
                    onChange={(e) =>
                      setMapping({ ...mapping, [field]: e.target.value })
                    }
                    className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                  >
                    <option value="">Pick column…</option>
                    {csv.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Date format</Label>
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="ymd">YYYY-MM-DD</option>
                  <option value="mdy">MM/DD/YYYY</option>
                  <option value="dmy">DD/MM/YYYY</option>
                </select>
              </div>
              <label className="mt-5 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={expensesNegative}
                  onChange={(e) => setExpensesNegative(e.target.checked)}
                  className="size-4"
                />
                Expenses are negative in this file (most bank exports)
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {validPreview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y text-sm">
              {validPreview.map((row, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className="text-muted-foreground tabular-nums">
                    {row!.date}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{row!.name}</span>
                  <span
                    className={
                      row!.amountCents < 0
                        ? "tabular-nums text-emerald-600 dark:text-emerald-400"
                        : "tabular-nums"
                    }
                  >
                    {formatCents(-row!.amountCents)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Money out shows negative, money in green — flip the checkbox
              above if it looks reversed.
            </p>
          </CardContent>
        </Card>
      )}

      {csv && validPreview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Destination & import</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label>Account</Label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                  <option value={NEW_ACCOUNT}>+ New manual account</option>
                </select>
              </div>
              {accountId === NEW_ACCOUNT && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label>Account name</Label>
                    <Input
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder="e.g. Tangerine Chequing"
                      className="w-52"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Type</Label>
                    <select
                      value={newAccountType}
                      onChange={(e) => setNewAccountType(e.target.value)}
                      className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                    >
                      <option value="depository">Chequing / savings</option>
                      <option value="credit">Credit card</option>
                      <option value="loan">Loan</option>
                    </select>
                  </div>
                </>
              )}
              <Button onClick={onImport} disabled={pending}>
                <Upload className="size-4" />
                {pending
                  ? "Importing…"
                  : `Import ${csv.rows.length} rows`}
              </Button>
            </div>
            {result && <p className="text-sm">{result}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function guessColumn(headers: string[], candidates: string[]): string {
  const lower = headers.map((h) => h.toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return headers[idx];
  }
  return "";
}

function normalizeRow(
  row: Record<string, string>,
  mapping: Mapping,
  dateFormat: string,
  expensesNegative: boolean
): { date: string; amountCents: number; name: string } | null {
  const rawDate = (row[mapping.date] ?? "").trim();
  const rawAmount = (row[mapping.amount] ?? "").trim();
  const name = (row[mapping.description] ?? "").trim();
  if (!rawDate || !rawAmount || !name) return null;

  const date = parseDate(rawDate, dateFormat);
  if (!date) return null;

  // "(12.34)" and "$1,234.56" both appear in bank exports.
  const negativeParens = /^\(.*\)$/.test(rawAmount);
  const numeric = Number.parseFloat(rawAmount.replace(/[($,)\s]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  let amountCents = Math.round(Math.abs(numeric) * 100);
  const isNegative = negativeParens || numeric < 0;

  // Normalize to the Plaid convention: positive = money out.
  const isExpense = expensesNegative ? isNegative : !isNegative;
  if (!isExpense) amountCents = -amountCents;

  return { date, amountCents, name };
}

function parseDate(raw: string, format: string): string | null {
  const pad = (n: number) => String(n).padStart(2, "0");
  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (format === "mdy" && slash) {
    return `${slash[3]}-${pad(Number(slash[1]))}-${pad(Number(slash[2]))}`;
  }
  if (format === "dmy" && slash) {
    return `${slash[3]}-${pad(Number(slash[2]))}-${pad(Number(slash[1]))}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (format === "auto") {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
    }
  }
  return null;
}
