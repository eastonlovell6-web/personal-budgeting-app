"use client";

export type Tab = "income" | "spending" | "cashflow" | "savings" | "goals";

// Money Moves: the active tab label reads in that tab's fixed concept
// color; inactive tabs stay neutral so the color reads as a signal.
const TABS: { id: Tab; label: string; activeClass: string }[] = [
  { id: "income", label: "Income", activeClass: "text-income" },
  { id: "spending", label: "Spending", activeClass: "text-spending" },
  { id: "cashflow", label: "Cash Flow", activeClass: "text-cashflow" },
  { id: "savings", label: "Savings", activeClass: "text-savings" },
  { id: "goals", label: "Goals", activeClass: "text-goals" },
];

export function ReportTabs({
  value,
  onChange,
}: {
  value: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <div className="flex rounded-full bg-surface p-1" role="tablist">
      {TABS.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? `bg-surface-2 shadow-sm ${t.activeClass}`
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
