"use client";

import { useCallback, useEffect, useState } from "react";
import { ReportTabs, type Tab } from "@/components/ReportTabs";
import {
  DateRangePicker,
  presets,
  DEFAULT_RANGE_INDEX,
  type Range,
} from "@/components/DateRangePicker";
import { isoDate } from "@/lib/format";
import { IncomeView } from "@/components/income/IncomeView";
import { SpendingView } from "@/components/spending/SpendingView";
import { CashflowView } from "@/components/cashflow/CashflowView";
import { ConnectEmptyState, AddAccountButton } from "@/components/LinkButton";
import type { IncomeReport, SpendingReport, CashflowReport } from "@/lib/types";

const ENDPOINT: Record<Tab, string> = {
  income: "/api/reports/income",
  spending: "/api/reports/spending",
  cashflow: "/api/reports/cashflow",
};

export default function Home() {
  const [tab, setTab] = useState<Tab>("income");
  const [range, setRange] = useState<Range>(() => presets()[DEFAULT_RANGE_INDEX]);
  const [data, setData] = useState<
    IncomeReport | SpendingReport | CashflowReport | null
  >(null);
  // Which (tab,range) the loaded data belongs to — guards against rendering a
  // view with another tab's data during the fetch after a switch.
  const [dataKey, setDataKey] = useState<string>("");

  const key = `${tab}|${isoDate(range.start)}|${isoDate(range.end)}`;

  const load = useCallback(async () => {
    const qs = `?start=${isoDate(range.start)}&end=${isoDate(range.end)}`;
    const res = await fetch(ENDPOINT[tab] + qs);
    const json = await res.json();
    setData(json);
    setDataKey(`${tab}|${isoDate(range.start)}|${isoDate(range.end)}`);
  }, [tab, range]);

  useEffect(() => {
    load();
  }, [load]);

  // Pull fresh data from Plaid once when the app opens, then refresh the view.
  // Runs in the background so cached data shows immediately.
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    fetch("/api/plaid/sync", { method: "POST" }).finally(() => setSynced(true));
  }, []);
  useEffect(() => {
    if (synced) load();
  }, [synced, load]);

  const ready = data !== null && dataKey === key;
  const empty =
    ready &&
    (tab === "income"
      ? (data as IncomeReport).summary.count === 0
      : tab === "spending"
        ? (data as SpendingReport).total === 0
        : (data as CashflowReport).stats.income === 0 &&
          (data as CashflowReport).stats.expenses === 0);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-10 safe-top">
      <header className="flex items-center justify-between gap-2 pt-2">
        <h1 className="text-lg font-semibold">Reports</h1>
        <div className="flex items-center gap-2">
          {!empty && <AddAccountButton onLinked={load} />}
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </header>

      <ReportTabs value={tab} onChange={setTab} />

      {!ready ? (
        <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted">
          Loading…
        </div>
      ) : empty ? (
        <ConnectEmptyState onLinked={load} />
      ) : tab === "income" ? (
        <IncomeView data={data as IncomeReport} range={range} />
      ) : tab === "spending" ? (
        <SpendingView data={data as SpendingReport} />
      ) : (
        <CashflowView data={data as CashflowReport} />
      )}
    </main>
  );
}
