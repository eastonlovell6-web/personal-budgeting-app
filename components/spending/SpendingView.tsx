"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { SpendingReport, SpendingCategory } from "@/lib/types";
import { CATEGORICAL, OTHER_COLOR } from "@/lib/palette";
import { money } from "@/lib/format";
import { Card } from "@/components/ui/Card";

const TOP_N = 8;

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <span className="text-foreground">{p.name}</span>
      <span className="ml-2 tabular-nums text-muted">{money(p.value)}</span>
    </div>
  );
}

export function SpendingView({ data }: { data: SpendingReport }) {
  const [expanded, setExpanded] = useState(false);

  // Donut: top N distinct slices + a folded "Other".
  const top = data.categories.slice(0, TOP_N);
  const tail = data.categories.slice(TOP_N);
  const tailTotal = tail.reduce((s, c) => s + c.amount, 0);
  const slices = [
    ...top.map((c, i) => ({ name: c.display, value: c.amount, color: CATEGORICAL[i] })),
    ...(tailTotal > 0 ? [{ name: "Other", value: tailTotal, color: OTHER_COLOR }] : []),
  ];

  const visible = expanded ? data.categories : data.categories.slice(0, TOP_N);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="relative mx-auto h-60 w-60">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius="68%"
                outerRadius="100%"
                paddingAngle={2}
                stroke={"var(--surface)"}
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
              >
                {slices.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-semibold tabular-nums">
              {money(data.total)}
            </div>
            <div className="text-xs text-muted">Total</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col">
          {visible.map((c, i) => (
            <CategoryRow
              key={c.detailed}
              category={c}
              color={i < TOP_N ? CATEGORICAL[i] : OTHER_COLOR}
              total={data.total}
            />
          ))}
        </div>
        {data.categories.length > TOP_N && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 w-full py-2 text-center text-sm font-medium text-accent"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </Card>
    </div>
  );
}

function CategoryRow({
  category,
  color,
  total,
}: {
  category: SpendingCategory;
  color: string;
  total: number;
}) {
  const pct = total > 0 ? (category.amount / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
        style={{ background: color + "22" }}
      >
        {category.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground">{category.display}</div>
        <div className="text-xs text-muted">{pct.toFixed(1)}%</div>
      </div>
      <div className="tabular-nums text-sm text-foreground">
        {money(category.amount)}
      </div>
    </div>
  );
}
