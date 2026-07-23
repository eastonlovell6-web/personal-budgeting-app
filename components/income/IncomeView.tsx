"use client";

import { useState } from "react";
import type { IncomeReport } from "@/lib/types";
import type { Range } from "@/components/DateRangePicker";
import { money, rangeLabel } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { IncomeBySourceChart } from "@/components/income/IncomeBySourceChart";
import { IncomeVsSpendingChart } from "@/components/income/IncomeVsSpendingChart";

type ChartView = "source" | "vsSpending";

export function IncomeView({
  data,
  range,
}: {
  data: IncomeReport;
  range: Range;
}) {
  const [view, setView] = useState<ChartView>("source");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm text-muted">
            {view === "source" ? "Income by month" : "Income vs. spending"}
          </div>
          <div className="flex rounded-full bg-surface p-1" role="tablist">
            <ViewButton
              active={view === "source"}
              onClick={() => setView("source")}
              label="By source"
            />
            <ViewButton
              active={view === "vsSpending"}
              onClick={() => setView("vsSpending")}
              label="Income vs. spending"
            />
          </div>
        </div>
        {view === "source" ? (
          <IncomeBySourceChart data={data} />
        ) : (
          <IncomeVsSpendingChart data={data} />
        )}
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

function ViewButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-surface-2 text-foreground shadow-sm"
          : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
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
