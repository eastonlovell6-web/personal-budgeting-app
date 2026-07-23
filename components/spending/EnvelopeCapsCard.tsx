"use client";

import { useCallback, useState } from "react";
import type { EnvelopeGroupProgress } from "@/lib/types";
import { money0 } from "@/lib/format";
import { Card } from "@/components/ui/Card";

export function EnvelopeCapsCard({
  groups,
  onCapChange,
}: {
  groups: EnvelopeGroupProgress[];
  onCapChange: () => void;
}) {
  const [editing, setEditing] = useState<Record<string, string>>({});

  const saveCap = useCallback(
    async (group: string, raw: string) => {
      setEditing((prev) => {
        const next = { ...prev };
        delete next[group];
        return next;
      });
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) return;
      await fetch("/api/category-caps", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group, monthlyCap: value }),
      });
      onCapChange();
    },
    [onCapChange]
  );

  return (
    <Card>
      <div className="mb-1 text-sm font-medium text-foreground">Envelope Caps</div>
      <div className="flex flex-col">
        {groups.map((g) => {
          const pct = g.cap != null && g.cap > 0 ? Math.min(g.actual / g.cap, 1) * 100 : 0;
          const editValue = editing[g.group] ?? String(g.monthlyCap ?? "");
          const over = g.overBy != null && g.overBy > 0;
          return (
            <div key={g.group} className="border-t border-border py-2.5 first:border-t-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm">
                    {g.emoji}
                  </span>
                  <div className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {g.group}
                  </div>
                </div>
                <div className="tabular-nums text-sm text-foreground">
                  {money0(g.actual)}
                </div>
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${over ? "bg-negative" : "bg-accent"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-xs text-muted">
                  <span>Cap: $</span>
                  <input
                    type="number"
                    step="1"
                    value={editValue}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [g.group]: e.target.value }))
                    }
                    onBlur={(e) => saveCap(g.group, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    placeholder="Set"
                    className="w-14 rounded-lg border border-border bg-background px-1.5 py-0.5 text-right tabular-nums text-foreground"
                  />
                  <span>/mo</span>
                </div>
                {over && (
                  <span className="text-xs text-negative">
                    ⚠️ Over by {money0(g.overBy!)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
