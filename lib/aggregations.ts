// Pure aggregation functions over transactions. No I/O — fully unit-testable.
import { categoryInfo, GROUPS } from "@/lib/categories";
import type {
  Txn,
  IncomeMonth,
  IncomeSummary,
  IncomeReport,
  SpendingCategory,
  SankeyData,
  CashflowStats,
  InvestmentAccount,
  InvestingSummary,
} from "@/lib/types";

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Monthly income totals, split by source display name, sorted chronologically. */
export function incomeByMonth(txns: Txn[]): IncomeMonth[] {
  const byMonth = new Map<string, IncomeMonth>();
  for (const t of txns) {
    if (!t.isIncome) continue;
    const key = monthKey(t.date);
    let row = byMonth.get(key);
    if (!row) {
      row = { month: key, sources: {}, total: 0 };
      byMonth.set(key, row);
    }
    const source = categoryInfo(t.pfDetailed).display;
    row.sources[source] = (row.sources[source] ?? 0) + t.amount;
    row.total += t.amount;
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Totals across the whole range for the income summary block. */
export function incomeSummary(txns: Txn[]): IncomeSummary {
  let total = 0;
  let count = 0;
  let largest = 0;
  for (const t of txns) {
    if (!t.isIncome) continue;
    total += t.amount;
    count += 1;
    if (t.amount > largest) largest = t.amount;
  }
  return { total, count, largest };
}

/** Full income report: monthly series + distinct sources + summary. */
export function incomeReport(txns: Txn[]): IncomeReport {
  const byMonth = incomeByMonth(txns);
  const sourceSet = new Set<string>();
  for (const m of byMonth) {
    for (const s of Object.keys(m.sources)) sourceSet.add(s);
  }
  return {
    byMonth,
    sources: [...sourceSet].sort(),
    summary: incomeSummary(txns),
  };
}

/** Expenses grouped by detailed category, largest first. */
export function spendingByCategory(txns: Txn[]): SpendingCategory[] {
  const byCat = new Map<string, SpendingCategory>();
  for (const t of txns) {
    if (t.isIncome) continue;
    let row = byCat.get(t.pfDetailed);
    if (!row) {
      const info = categoryInfo(t.pfDetailed);
      row = {
        detailed: t.pfDetailed,
        display: info.display,
        emoji: info.emoji,
        amount: 0,
      };
      byCat.set(t.pfDetailed, row);
    }
    row.amount += t.amount;
  }
  return [...byCat.values()].sort((a, b) => b.amount - a.amount);
}

/** Top-level cash flow numbers. */
export function cashflowStats(txns: Txn[], investingTotal = 0): CashflowStats {
  let income = 0;
  let expenses = 0;
  for (const t of txns) {
    if (t.isIncome) income += t.amount;
    else expenses += t.amount;
  }
  const net = income - expenses;
  const savingsRate = income > 0 ? net / income : 0;
  return { income, expenses, net, savingsRate, investing: investingTotal };
}

/**
 * Sankey structure: income sources → "Income" hub → expense groups → leaf
 * categories, plus a "Savings" leaf for positive net. Nodes are keyed by a
 * role-qualified key so display names can safely repeat across roles.
 */
export function cashflowSankey(txns: Txn[], investingTotal = 0): SankeyData {
  const nodes: { name: string }[] = [];
  const nodeIndex = new Map<string, number>();
  const addNode = (key: string, name: string): number => {
    let i = nodeIndex.get(key);
    if (i === undefined) {
      i = nodes.length;
      nodeIndex.set(key, i);
      nodes.push({ name });
    }
    return i;
  };

  const links: SankeyData["links"] = [];
  const addLink = (source: number, target: number, value: number) => {
    if (value <= 0) return;
    const existing = links.find((l) => l.source === source && l.target === target);
    if (existing) existing.value += value;
    else links.push({ source, target, value });
  };

  const hub = addNode("hub:Income", "Income");

  // Income sources → hub
  const incomeBySource = new Map<string, number>();
  let totalIncome = 0;
  for (const t of txns) {
    if (!t.isIncome) continue;
    const d = categoryInfo(t.pfDetailed).display;
    incomeBySource.set(d, (incomeBySource.get(d) ?? 0) + t.amount);
    totalIncome += t.amount;
  }
  for (const [display, amt] of incomeBySource) {
    addLink(addNode(`src:${display}`, display), hub, amt);
  }

  // hub → expense group. (Leaf-level detail lives on the Spending page; a
  // 3-level flow keeps labels legible on a phone.)
  const groups = new Map<string, number>();
  let totalExpense = 0;
  for (const t of txns) {
    if (t.isIncome) continue;
    const info = categoryInfo(t.pfDetailed);
    groups.set(info.group, (groups.get(info.group) ?? 0) + t.amount);
    totalExpense += t.amount;
  }

  const orderedGroups = [...groups.keys()].sort(
    (a, b) => GROUPS.indexOf(a as (typeof GROUPS)[number]) - GROUPS.indexOf(b as (typeof GROUPS)[number])
  );
  for (const group of orderedGroups) {
    addLink(hub, addNode(`grp:${group}`, group), groups.get(group)!);
  }

  // Investing (money transferred to investment accounts) as a leaf off the
  // hub, added before Savings so Savings reflects the true leftover.
  if (investingTotal > 0) {
    addLink(hub, addNode("inv:Investing", "Investing"), investingTotal);
  }

  // Savings (positive net, minus what was invested) as a leaf off the hub
  const net = totalIncome - totalExpense;
  const savings = net - investingTotal;
  if (savings > 0) addLink(hub, addNode("sav:Savings", "Savings"), savings);

  return { nodes, links };
}

/** Portfolio summary: accounts sorted by balance descending (nulls last),
 * total excludes null balances rather than coercing them to 0. */
export function investingSummary(accounts: InvestmentAccount[]): InvestingSummary {
  const sorted = [...accounts].sort((a, b) => {
    if (a.currentBalance == null) return 1;
    if (b.currentBalance == null) return -1;
    return b.currentBalance - a.currentBalance;
  });
  const total = accounts.reduce(
    (sum, a) => (a.currentBalance == null ? sum : sum + a.currentBalance),
    0
  );
  return { accounts: sorted, total };
}
