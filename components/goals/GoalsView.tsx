"use client";

import { useCallback, useState } from "react";
import type { Goal } from "@/lib/types";
import { money0 } from "@/lib/format";
import { Card } from "@/components/ui/Card";

export function GoalsView({
  data,
  onChange,
}: {
  data: Goal[];
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});

  const addGoal = useCallback(async () => {
    const trimmedName = name.trim();
    const value = Number(targetAmount);
    if (trimmedName === "" || !Number.isFinite(value) || value <= 0) return;

    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmedName, targetAmount: value }),
    });
    setName("");
    setTargetAmount("");
    onChange();
  }, [name, targetAmount, onChange]);

  const saveCurrentAmount = useCallback(
    async (id: string, raw: string) => {
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) return;
      await fetch(`/api/goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentAmount: value }),
      });
      setEditing((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      onChange();
    },
    [onChange]
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      await fetch(`/api/goals/${id}`, { method: "DELETE" });
      onChange();
    },
    [onChange]
  );

  return (
    <div className="flex flex-col gap-4">
      {data.length === 0 && (
        <Card>
          <div className="text-sm text-muted">No goals yet — add one below.</div>
        </Card>
      )}

      {data.map((g) => {
        const pct = g.targetAmount > 0 ? Math.min(g.currentAmount / g.targetAmount, 1) * 100 : 0;
        const editValue = editing[g.id] ?? String(g.currentAmount);
        return (
          <Card key={g.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1 text-sm font-medium text-foreground">{g.name}</div>
              <button
                onClick={() => deleteGoal(g.id)}
                aria-label="Delete goal"
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted">
              <input
                type="number"
                step="1"
                value={editValue}
                onChange={(e) =>
                  setEditing((prev) => ({ ...prev, [g.id]: e.target.value }))
                }
                onBlur={(e) => saveCurrentAmount(g.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="w-20 rounded-control border border-border bg-background px-2 py-0.5 text-right tabular-nums text-foreground"
              />
              <span>/ {money0(g.targetAmount)}</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-control">
              <div
                className="h-full rounded-full bg-goals"
                style={{ width: `${pct}%` }}
              />
            </div>
          </Card>
        );
      })}

      <Card>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Goal name"
            className="rounded-control border border-border bg-background px-2 py-1 text-sm"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="1"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="10000"
              className="w-24 rounded-control border border-border bg-background px-2 py-1 text-sm tabular-nums"
            />
            <span className="text-xs text-muted">target amount</span>
          </div>
          <button
            onClick={addGoal}
            className="self-start rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-ink"
          >
            Add goal
          </button>
        </div>
      </Card>
    </div>
  );
}
