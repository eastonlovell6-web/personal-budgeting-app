"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { money0 } from "@/lib/format";
import type {
  CashPlacementNeedsRate,
  CashPlacementOpportunity,
} from "@/lib/types";

type NudgeData = {
  referenceApy: number | null;
  snoozedUntil: string | null;
  needsRate: CashPlacementNeedsRate[];
  opportunities: CashPlacementOpportunity[];
};

export function CashPlacementNudge() {
  const [data, setData] = useState<NudgeData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [referenceInput, setReferenceInput] = useState("");
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/nudges/cash-placement");
    setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveReferenceApy = useCallback(async () => {
    const trimmed = referenceInput.trim();
    const value = Number(trimmed);
    if (trimmed === "" || !Number.isFinite(value)) return;
    await fetch("/api/nudges/cash-placement", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referenceApy: value }),
    });
    setReferenceInput("");
    load();
  }, [referenceInput, load]);

  const saveAccountApy = useCallback(
    async (accountId: string) => {
      const trimmed = (rateInputs[accountId] ?? "").trim();
      const value = Number(trimmed);
      if (trimmed === "" || !Number.isFinite(value)) return;
      await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apy: value }),
      });
      setRateInputs((prev) => ({ ...prev, [accountId]: "" }));
      load();
    },
    [rateInputs, load]
  );

  const dismiss = useCallback(async () => {
    setDismissed(true);
    await fetch("/api/nudges/cash-placement", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snooze: true }),
    });
  }, []);

  if (dismissed || !data) return null;
  const snoozed = data.snoozedUntil != null && new Date(data.snoozedUntil) > new Date();
  if (snoozed) return null;
  const hasContent =
    data.referenceApy == null ||
    data.needsRate.length > 0 ||
    data.opportunities.length > 0;
  if (!hasContent) return null;

  return (
    <Card className="relative">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-muted hover:text-foreground"
      >
        ✕
      </button>
      {data.referenceApy == null ? (
        <div className="pr-6">
          <div className="text-sm font-medium text-foreground">
            See if your cash is earning what it could
          </div>
          <div className="mt-1 text-xs text-muted">
            Enter today&rsquo;s typical high-yield savings rate to compare
            against your accounts.
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              value={referenceInput}
              onChange={(e) => setReferenceInput(e.target.value)}
              placeholder="4.10"
              className="w-20 rounded-control border border-border bg-background px-2 py-1 text-sm tabular-nums"
            />
            <span className="text-xs text-muted">%</span>
            <button
              onClick={saveReferenceApy}
              className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-ink"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pr-6">
          {data.needsRate.map((a) => (
            <div
              key={a.accountId}
              className="flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1 text-sm text-foreground">
                What does &ldquo;{a.name}&rdquo; currently earn?
              </div>
              <input
                type="number"
                step="0.01"
                value={rateInputs[a.accountId] ?? ""}
                onChange={(e) =>
                  setRateInputs((prev) => ({
                    ...prev,
                    [a.accountId]: e.target.value,
                  }))
                }
                placeholder="0.40"
                className="w-16 rounded-control border border-border bg-background px-2 py-1 text-sm tabular-nums"
              />
              <button
                onClick={() => saveAccountApy(a.accountId)}
                className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-ink"
              >
                Save
              </button>
            </div>
          ))}
          {data.opportunities.map((o) => (
            <div
              key={o.accountId}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-foreground">
                  {o.name}
                </div>
                <div className="text-xs text-muted">
                  Earning {o.apy.toFixed(2)}% vs. {data.referenceApy!.toFixed(2)}%
                  reference
                </div>
              </div>
              <div className="text-right text-sm font-medium tabular-nums text-foreground">
                +{money0(o.annualOpportunityCost)}/yr
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
