"use client";

import type { IncomeReport } from "@/lib/types";
import type { Range } from "@/components/DateRangePicker";
import { money, rangeLabel } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { IncomeBySourceChart } from "@/components/income/IncomeBySourceChart";

export function IncomeView({
  data,
  range,
}: {
  data: IncomeReport;
  range: Range;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 text-sm text-muted">Income by month</div>
        <IncomeBySourceChart data={data} />
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
