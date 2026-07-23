"use client";

export type Tab = "income" | "spending" | "cashflow" | "investing" | "savings";

const TABS: { id: Tab; label: string }[] = [
  { id: "income", label: "Income" },
  { id: "spending", label: "Spending" },
  { id: "cashflow", label: "Cash Flow" },
  { id: "investing", label: "Investing" },
  { id: "savings", label: "Savings" },
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
                ? "bg-surface-2 text-foreground shadow-sm"
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
