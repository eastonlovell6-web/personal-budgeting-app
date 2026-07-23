import type { CashflowStats } from "@/lib/types";
import { money0 } from "@/lib/format";
import { CHART } from "@/lib/palette";

export function StatRow({ stats }: { stats: CashflowStats }) {
  const items = [
    { label: "Total income", value: money0(stats.income), color: CHART.positive },
    { label: "Total expenses", value: money0(stats.expenses), color: CHART.negative },
    { label: "Net income", value: money0(stats.net), color: stats.net >= 0 ? CHART.positive : CHART.negative },
    { label: "Savings rate", value: `${(stats.savingsRate * 100).toFixed(1)}%`, color: CHART.textPrimary },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-border bg-surface p-3">
          <div className="text-xs text-muted">{it.label}</div>
          <div
            className="mt-1 text-lg font-semibold tabular-nums"
            style={{ color: it.color }}
          >
            {it.value}
          </div>
        </div>
      ))}
      <div className="col-span-2 rounded-xl border border-border bg-surface p-3">
        <div className="text-xs text-muted">Investing</div>
        <div
          className="mt-1 text-lg font-semibold tabular-nums"
          style={{ color: CHART.textPrimary }}
        >
          {money0(stats.investing)}
        </div>
      </div>
    </div>
  );
}
