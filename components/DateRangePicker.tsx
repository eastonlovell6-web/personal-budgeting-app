"use client";

import { useState } from "react";

export type Range = { start: Date; end: Date; label: string };

function startOfMonth(d: Date, monthsBack: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsBack, 1));
}
function endOfToday(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

/** Preset ranges, computed lazily off "now". */
export function presets(): Range[] {
  const end = endOfToday();
  const now = new Date();
  return [
    { label: "Last 3 months", start: startOfMonth(now, 2), end },
    { label: "Last 6 months", start: startOfMonth(now, 5), end },
    { label: "Last 12 months", start: startOfMonth(now, 11), end },
    {
      label: "Year to date",
      start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
      end,
    },
  ];
}

export const DEFAULT_RANGE_INDEX = 1; // Last 6 months

export function DateRangePicker({
  value,
  onChange,
}: {
  value: Range;
  onChange: (r: Range) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = presets();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted"
      >
        {value.label}
        <span className="text-xs">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-surface-2 shadow-lg">
            {options.map((opt) => {
              const active = opt.label === value.label;
              return (
                <button
                  key={opt.label}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm ${
                    active ? "text-foreground" : "text-muted hover:text-foreground"
                  }`}
                >
                  {opt.label}
                  {active && <span className="text-accent">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
