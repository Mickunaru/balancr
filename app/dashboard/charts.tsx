"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCents } from "@/lib/format";

const VIZ = [
  "var(--viz-1)",
  "var(--viz-2)",
  "var(--viz-3)",
  "var(--viz-4)",
  "var(--viz-5)",
  "var(--viz-6)",
];

function compactDollars(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) {
    return `$${(dollars / 1000).toLocaleString("en-CA", { maximumFractionDigits: 1 })}K`;
  }
  return `$${dollars.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="text-muted-foreground">
          {entry.name}:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatCents(Number(entry.value))}
          </span>
        </p>
      ))}
    </div>
  );
}

export function NetWorthChart({
  data,
}: {
  data: { label: string; netWorthCents: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid
          vertical={false}
          stroke="var(--viz-grid)"
          strokeWidth={1}
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "var(--viz-axis)" }}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          dy={6}
        />
        <YAxis
          tickFormatter={compactDollars}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          width={52}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--viz-axis)" }} />
        <Area
          type="monotone"
          dataKey="netWorthCents"
          name="Net worth"
          stroke="var(--viz-1)"
          strokeWidth={2}
          strokeLinecap="round"
          fill="var(--viz-1)"
          fillOpacity={0.1}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
          animationDuration={600}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CashFlowChart({
  data,
}: {
  data: { label: string; inCents: number; outCents: number }[];
}) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          barGap={2}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--viz-grid)"
            strokeWidth={1}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--viz-axis)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            dy={6}
          />
          <YAxis
            tickFormatter={compactDollars}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            width={52}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
          <Bar
            dataKey="inCents"
            name="In"
            fill="var(--viz-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            animationDuration={600}
          />
          <Bar
            dataKey="outCents"
            name="Out"
            fill="var(--viz-2)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            animationDuration={600}
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: "var(--viz-1)" }} />
          In
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: "var(--viz-2)" }} />
          Out
        </span>
      </div>
    </div>
  );
}

export function SpendingDonut({
  data,
}: {
  data: { name: string; cents: number }[];
}) {
  const total = data.reduce((sum, d) => sum + d.cents, 0);
  // Color follows the entity, not its rank: slots assigned by stable
  // alphabetical order so a category keeps its hue as rankings shift.
  const slotByName = new Map(
    data
      .filter((d) => d.name !== "Other")
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b))
      .map((name, i) => [name, VIZ[i % VIZ.length]])
  );
  const colorFor = (name: string) =>
    name === "Other" ? "var(--viz-other)" : (slotByName.get(name) ?? "var(--viz-other)");

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Tooltip content={<ChartTooltip />} />
            <Pie
              data={data}
              dataKey="cents"
              nameKey="name"
              innerRadius={54}
              outerRadius={76}
              paddingAngle={2}
              strokeWidth={0}
              animationDuration={600}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={colorFor(entry.name)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xs text-muted-foreground">This month</p>
          <p className="font-heading text-sm font-semibold tabular-nums">
            {formatCents(total)}
          </p>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {data.map((entry) => (
          <div
            key={entry.name}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: colorFor(entry.name) }}
              />
              <span className="truncate">{entry.name}</span>
            </span>
            <span className="text-muted-foreground tabular-nums">
              {formatCents(entry.cents)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
