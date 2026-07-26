"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { IncomeReport } from "@/lib/types";
import { CHART } from "@/lib/palette";
import { money, moneyCompact, monthShort } from "@/lib/format";

type Row = {
  month: string;
  income: number;
  expenses: number; // negated for display so bars diverge below zero
  net: number;
};

function TooltipRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 text-muted">
      <span
        className="inline-block h-2 w-2 rounded-sm"
        style={{ background: color }}
      />
      <span className="text-foreground">{label}</span>
      <span className="ml-auto tabular-nums">{money(value)}</span>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p: any) => p.dataKey === "income")?.value ?? 0;
  const expenses = payload.find((p: any) => p.dataKey === "expenses")?.value ?? 0;
  const net = payload.find((p: any) => p.dataKey === "net")?.value ?? 0;
  return (
    <div className="rounded-control border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      <TooltipRow color={CHART.positive} label="Income" value={income} />
      <TooltipRow color={CHART.negative} label="Spending" value={Math.abs(expenses)} />
      <TooltipRow color={CHART.textPrimary} label="Net income" value={net} />
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ background: color }}
      />
      <span className="text-muted">{label}</span>
    </div>
  );
}

export function IncomeVsSpendingChart({ data }: { data: IncomeReport }) {
  const rows: Row[] = data.netByMonth.map((m) => ({
    month: monthShort(m.month),
    income: m.income,
    expenses: -m.expenses,
    net: m.net,
  }));

  return (
    <>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            stackOffset="sign"
            margin={{ top: 8, right: 4, left: -8, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis
              dataKey="month"
              tick={{ fill: CHART.textMuted, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: CHART.axis }}
            />
            <YAxis
              tick={{ fill: CHART.textMuted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v) => moneyCompact(Number(v))}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "var(--chart-hover)" }}
            />
            <ReferenceLine y={0} stroke={CHART.axis} />
            <Bar
              dataKey="income"
              stackId="netFlow"
              fill={CHART.positive}
              isAnimationActive={false}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="expenses"
              stackId="netFlow"
              fill={CHART.negative}
              isAnimationActive={false}
              radius={[0, 0, 4, 4]}
            />
            <Line
              type="monotone"
              dataKey="net"
              stroke={CHART.textPrimary}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        <LegendSwatch color={CHART.positive} label="Income" />
        <LegendSwatch color={CHART.negative} label="Spending" />
        <LegendSwatch color={CHART.textPrimary} label="Net income" />
      </div>
    </>
  );
}
