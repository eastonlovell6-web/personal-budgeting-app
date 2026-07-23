"use client";

import { useEffect, useRef, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type {
  SpendingReport,
  SpendingCategory,
  SpendingCategoryTransaction,
} from "@/lib/types";
import { CATEGORICAL, OTHER_COLOR } from "@/lib/palette";
import { money, dayShort, isoDate } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import type { Range } from "@/components/DateRangePicker";

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

export function SpendingView({ data, range }: { data: SpendingReport; range: Range }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [txnCache, setTxnCache] = useState<
    Map<string, SpendingCategoryTransaction[] | "loading">
  >(new Map());

  // Collapse and drop cached transactions whenever the selected date range
  // changes — the cache is keyed by category only, so a stale list for the
  // old range must not be shown.
  const rangeKey = `${isoDate(range.start)}|${isoDate(range.end)}`;
  const rangeKeyRef = useRef(rangeKey);
  rangeKeyRef.current = rangeKey;
  useEffect(() => {
    setExpandedCategory(null);
    setTxnCache(new Map());
  }, [rangeKey]);

  function toggleCategory(detailed: string) {
    if (expandedCategory === detailed) {
      setExpandedCategory(null);
      return;
    }
    setExpandedCategory(detailed);
    if (txnCache.has(detailed)) return;

    const requestRangeKey = rangeKey;
    setTxnCache((m) => new Map(m).set(detailed, "loading"));
    const qs = `?start=${isoDate(range.start)}&end=${isoDate(range.end)}&category=${encodeURIComponent(detailed)}`;
    fetch(`/api/reports/spending/transactions${qs}`)
      .then((res) => res.json())
      .then((txns: SpendingCategoryTransaction[]) => {
        if (rangeKeyRef.current !== requestRangeKey) return;
        setTxnCache((m) => new Map(m).set(detailed, txns));
      })
      .catch(() => {
        if (rangeKeyRef.current !== requestRangeKey) return;
        setTxnCache((m) => {
          const next = new Map(m);
          next.delete(detailed);
          return next;
        });
      });
  }

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
                isAnimationActive={false}
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
              expanded={expandedCategory === c.detailed}
              onToggle={() => toggleCategory(c.detailed)}
              transactions={txnCache.get(c.detailed)}
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
  expanded,
  onToggle,
  transactions,
}: {
  category: SpendingCategory;
  color: string;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  transactions: SpendingCategoryTransaction[] | "loading" | undefined;
}) {
  const pct = total > 0 ? (category.amount / total) * 100 : 0;
  return (
    <div className="border-t border-border first:border-t-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 py-2.5 text-left"
      >
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
      </button>
      {expanded && (
        <div className="flex flex-col pb-2.5 pl-11">
          {transactions === "loading" || transactions === undefined ? (
            <div className="py-1.5 text-xs text-muted">Loading…</div>
          ) : (
            transactions.map((t) => <TransactionRow key={t.transactionId} txn={t} />)
          )}
        </div>
      )}
    </div>
  );
}

function TransactionRow({ txn }: { txn: SpendingCategoryTransaction }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-12 shrink-0 text-xs text-muted">{dayShort(new Date(txn.date))}</div>
      <div className="min-w-0 flex-1 truncate text-sm text-foreground">{txn.name}</div>
      <div className="tabular-nums text-sm text-muted">{money(txn.amount)}</div>
    </div>
  );
}
