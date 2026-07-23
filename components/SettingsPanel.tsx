"use client";

import { useState } from "react";
import type { BudgetingMode } from "@/lib/types";

export function SettingsPanel({
  value,
  onChange,
}: {
  value: BudgetingMode;
  onChange: (mode: BudgetingMode) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        className="flex items-center justify-center rounded-full border border-border bg-surface px-2.5 py-1.5 text-sm text-muted"
      >
        ⚙️
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-border bg-surface-2 p-3 shadow-lg">
            <div className="mb-2 text-xs text-muted">Budgeting mode</div>
            <div className="flex rounded-full bg-surface p-1">
              <button
                onClick={() => onChange("automated")}
                className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  value === "automated"
                    ? "bg-surface-2 text-foreground shadow-sm"
                    : "text-muted"
                }`}
              >
                Automated
              </button>
              <button
                onClick={() => onChange("envelope")}
                className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  value === "envelope"
                    ? "bg-surface-2 text-foreground shadow-sm"
                    : "text-muted"
                }`}
              >
                Envelope
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
