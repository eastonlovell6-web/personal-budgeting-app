"use client";

import type { InvestingReport } from "@/lib/types";
import { money, money0 } from "@/lib/format";
import { Card } from "@/components/ui/Card";

export function InvestingView({ data }: { data: InvestingReport }) {
  if (data.accounts.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="text-4xl">📈</div>
        <div>
          <p className="font-medium">No investment accounts yet</p>
          <p className="mt-1 text-sm text-muted">
            Connect a brokerage or retirement account to see your portfolio
            here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="text-xs text-muted">Total portfolio value</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">
          {money0(data.total)}
        </div>
      </Card>
      <Card>
        <div className="flex flex-col">
          {data.accounts.map((a) => (
            <div
              key={a.accountId}
              className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-foreground">{a.name}</div>
                <div className="text-xs text-muted">{a.institution}</div>
              </div>
              <div className="tabular-nums text-sm text-foreground">
                {a.currentBalance == null ? "—" : money(a.currentBalance)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
