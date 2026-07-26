"use client";

import type { CashflowReport } from "@/lib/types";
import { StatRow } from "@/components/cashflow/StatRow";
import { SankeyChart } from "@/components/cashflow/SankeyChart";
import { Card } from "@/components/ui/Card";

export function CashflowView({ data }: { data: CashflowReport }) {
  return (
    <div className="flex flex-col gap-4">
      <StatRow stats={data.stats} />
      <Card>
        <div className="mb-2 text-section-label text-foreground">Cash flow</div>
        <SankeyChart data={data.sankey} />
      </Card>
    </div>
  );
}
