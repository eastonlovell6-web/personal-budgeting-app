"use client";

import { useCallback, useState } from "react";
import type { SavingsReport, SavingsRuleType } from "@/lib/types";
import { money } from "@/lib/format";
import { Card } from "@/components/ui/Card";

export function SavingsView({
  data,
  onChange,
}: {
  data: SavingsReport;
  onChange: () => void;
}) {
  const [type, setType] = useState<SavingsRuleType>("split");
  const [percent, setPercent] = useState("");
  const [increment, setIncrement] = useState<1 | 5>(1);

  const addRule = useCallback(async () => {
    if (type === "split") {
      const trimmed = percent.trim();
      const value = Number(trimmed);
      if (trimmed === "" || !Number.isFinite(value) || value < 0 || value > 100) return;
      await fetch("/api/savings-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "split", percent: value }),
      });
      setPercent("");
    } else {
      await fetch("/api/savings-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "roundup", increment }),
      });
    }
    onChange();
  }, [type, percent, increment, onChange]);

  const toggleActive = useCallback(
    async (id: string, active: boolean) => {
      await fetch(`/api/savings-rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      onChange();
    },
    [onChange]
  );

  const deleteRule = useCallback(
    async (id: string) => {
      await fetch(`/api/savings-rules/${id}`, { method: "DELETE" });
      onChange();
    },
    [onChange]
  );

  const totalByRuleId = new Map(data.perRule.map((r) => [r.ruleId, r.total]));
  const ruleLabel = (r: { type: SavingsRuleType; percent: number | null; increment: number | null }) =>
    r.type === "split" ? `${r.percent}% of deposits` : `Round up to $${r.increment}`;

  return (
    <div className="flex flex-col gap-4">
      {data.rules.some((r) => r.active) && (
        <Card>
          <div className="text-xs text-muted">Simulated this period</div>
          <div className="mt-1 font-heading text-2xl font-semibold tabular-nums text-savings">
            {money(data.combinedTotal)}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {data.rules
              .filter((r) => r.active)
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{ruleLabel(r)}</span>
                  <span className="tabular-nums text-foreground">
                    {money(totalByRuleId.get(r.id) ?? 0)}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-2">
          {data.rules.length === 0 && (
            <div className="text-sm text-muted">No rules yet — add one below.</div>
          )}
          {data.rules.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 border-t border-border py-2.5 first:border-t-0"
            >
              <div className="min-w-0 flex-1 text-sm text-foreground">{ruleLabel(r)}</div>
              <button
                onClick={() => toggleActive(r.id, !r.active)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  r.active ? "bg-accent text-white" : "bg-surface-2 text-muted"
                }`}
              >
                {r.active ? "Active" : "Paused"}
              </button>
              <button
                onClick={() => deleteRule(r.id)}
                aria-label="Delete rule"
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex rounded-full bg-surface-2 p-1">
            <button
              onClick={() => setType("split")}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                type === "split" ? "bg-surface text-foreground shadow-sm" : "text-muted"
              }`}
            >
              Deposit split
            </button>
            <button
              onClick={() => setType("roundup")}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                type === "roundup" ? "bg-surface text-foreground shadow-sm" : "text-muted"
              }`}
            >
              Round-up
            </button>
          </div>
          {type === "split" ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                placeholder="10"
                className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm tabular-nums"
              />
              <span className="text-xs text-muted">% of every deposit</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Round up to nearest</span>
              <select
                value={increment}
                onChange={(e) => setIncrement(Number(e.target.value) as 1 | 5)}
                className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
              >
                <option value={1}>$1</option>
                <option value={5}>$5</option>
              </select>
            </div>
          )}
          <button
            onClick={addRule}
            className="self-start rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white"
          >
            Add rule
          </button>
        </div>
      </Card>
    </div>
  );
}
