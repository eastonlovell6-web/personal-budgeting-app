"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { IncomeReport } from "@/lib/types";
import type { Range } from "@/components/DateRangePicker";
import { colorMap, CHART } from "@/lib/palette";
import { money, moneyCompact, monthShort, rangeLabel } from "@/lib/format";
import { Card } from "@/components/ui/Card";

type Row = { month: string } & Record<string, number | string>;

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      {payload
        .slice()
        .reverse()
        .map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-muted">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ background: p.color }}
            />
            <span className="text-foreground">{p.dataKey}</span>
            <span className="ml-auto tabular-nums">{money(p.value)}</span>
          </div>
        ))}
    </div>
  );
}

export function IncomeView({
  data,
  range,
}: {
  data: IncomeReport;
  range: Range;
}) {
  const colors = colorMap(data.sources);
  const rows: Row[] = data.byMonth.map((m) => ({
    month: monthShort(m.month),
    ...m.sources,
  }));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 text-sm text-muted">Income by month</div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
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
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              {data.sources.map((source, i) => (
                <Bar
                  key={source}
                  dataKey={source}
                  stackId="income"
                  fill={colors[source]}
                  radius={i === data.sources.length - 1 ? [4, 4, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {data.sources.map((source) => (
            <div key={source} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: colors[source] }}
              />
              <span className="text-muted">{source}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3 text-sm text-muted">Summary</div>
        <div className="mb-3 text-xs text-muted">
          {rangeLabel(range.start, range.end)}
        </div>
        <SummaryRow label="Total income" value={money(data.summary.total)} strong />
        <SummaryRow label="Total transactions" value={String(data.summary.count)} />
        <SummaryRow label="Largest transaction" value={money(data.summary.largest)} />
      </Card>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border py-2.5 first:border-t-0">
      <span className="text-sm text-muted">{label}</span>
      <span
        className={`tabular-nums ${
          strong ? "text-base font-semibold text-foreground" : "text-sm text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
