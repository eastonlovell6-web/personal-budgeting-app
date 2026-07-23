// Pure aggregation functions over transactions. No I/O — fully unit-testable.
import { categoryInfo, GROUPS } from "@/lib/categories";
import { isoDate } from "@/lib/format";
import type {
  Txn,
  IncomeMonth,
  IncomeSummary,
  IncomeReport,
  NetMonth,
  SpendingCategory,
  SpendingCategoryTransaction,
  SankeyData,
  CashflowStats,
  CashPlacementAccount,
  CashPlacementNudgeResult,
  SavingsRule,
  SavingsSimulationResult,
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

/** Monthly income vs. expenses vs. net totals, sorted chronologically. */
export function cashflowByMonth(txns: Txn[]): NetMonth[] {
  const byMonth = new Map<string, NetMonth>();
  for (const t of txns) {
    const key = monthKey(t.date);
    let row = byMonth.get(key);
    if (!row) {
      row = { month: key, income: 0, expenses: 0, net: 0 };
      byMonth.set(key, row);
    }
    if (t.isIncome) row.income += t.amount;
    else row.expenses += t.amount;
    row.net = row.income - row.expenses;
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
    netByMonth: cashflowByMonth(txns),
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

/** One category's transactions, newest first — powers the Spending drill-down. */
export function transactionsForCategory(
  txns: Txn[],
  detailed: string
): SpendingCategoryTransaction[] {
  return txns
    .filter((t) => !t.isIncome && t.pfDetailed === detailed)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((t) => ({
      transactionId: t.transactionId,
      date: isoDate(t.date),
      name: t.merchantName ?? t.name,
      amount: t.amount,
    }));
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

  // Investing is shown as its own stat, not as a sankey leaf — only Savings
  // (net minus what was invested) flows out of the hub below.
  // Savings (positive net, minus what was invested) as a leaf off the hub
  const net = totalIncome - totalExpense;
  const savings = net - investingTotal;
  if (savings > 0) addLink(hub, addNode("sav:Savings", "Savings"), savings);

  return { nodes, links };
}

/** Per-account cash placement check: which accounts need a rate entered,
 * and which have a meaningful, user-actionable gap vs. the reference rate.
 * Only considers accounts at/above minBalance; returns nothing at all when
 * referenceApy hasn't been set yet (the UI shows a one-time setup prompt
 * instead). Accounts whose gap is below minGapPP are dropped entirely —
 * not "fine", just not worth surfacing. */
export function cashPlacementNudge(
  accounts: CashPlacementAccount[],
  referenceApy: number | null,
  opts?: { minGapPP?: number; minBalance?: number }
): CashPlacementNudgeResult {
  if (referenceApy == null) return { needsRate: [], opportunities: [] };

  const minGapPP = opts?.minGapPP ?? 0.5;
  const minBalance = opts?.minBalance ?? 500;

  const eligible = accounts.filter(
    (a) => a.currentBalance != null && a.currentBalance >= minBalance
  );

  const needsRate: CashPlacementNudgeResult["needsRate"] = [];
  const opportunities: CashPlacementNudgeResult["opportunities"] = [];

  for (const a of eligible) {
    const balance = a.currentBalance!;
    if (a.apy == null) {
      needsRate.push({ accountId: a.accountId, name: a.name, balance });
      continue;
    }
    const gapPP = Math.round((referenceApy - a.apy) * 100) / 100;
    if (gapPP >= minGapPP) {
      const annualOpportunityCost = Math.round((balance * gapPP) / 100 * 100) / 100;
      opportunities.push({
        accountId: a.accountId,
        name: a.name,
        balance,
        apy: a.apy,
        gapPP,
        annualOpportunityCost,
      });
    }
  }

  opportunities.sort((a, b) => b.annualOpportunityCost - a.annualOpportunityCost);

  return { needsRate, opportunities };
}

/** Simulates active automated-savings rules against real transactions.
 * Split rules apply percent% to income transactions; round-up rules round
 * each expense transaction up to the nearest $1/$5 and sum the difference.
 * Inactive rules are excluded from both perRule and combinedTotal. Uses
 * integer-cents math for the round-up remainder to avoid floating-point
 * drift. */
export function savingsRulesSimulation(
  txns: Txn[],
  rules: SavingsRule[]
): SavingsSimulationResult {
  const perRule: SavingsSimulationResult["perRule"] = [];
  let combinedTotal = 0;

  for (const rule of rules) {
    if (!rule.active) continue;

    let total = 0;
    if (rule.type === "split") {
      const percent = rule.percent ?? 0;
      for (const t of txns) {
        if (!t.isIncome) continue;
        total += (t.amount * percent) / 100;
      }
    } else {
      const incrementCents = Math.round((rule.increment ?? 1) * 100);
      for (const t of txns) {
        if (t.isIncome) continue;
        const amountCents = Math.round(t.amount * 100);
        const remainder = amountCents % incrementCents;
        if (remainder !== 0) total += (incrementCents - remainder) / 100;
      }
    }

    total = Math.round(total * 100) / 100;
    perRule.push({ ruleId: rule.id, type: rule.type, total });
    combinedTotal += total;
  }

  combinedTotal = Math.round(combinedTotal * 100) / 100;
  return { perRule, combinedTotal };
}
