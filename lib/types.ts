// Shared shapes used across aggregations, API routes, and components.

/** Minimal transaction shape the aggregation functions operate on. */
export type Txn = {
  transactionId: string;
  date: Date;
  amount: number; // positive magnitude
  merchantName: string | null;
  name: string;
  pfPrimary: string;
  pfDetailed: string;
  isIncome: boolean;
};

/** Income report */
export type IncomeMonth = {
  month: string; // "YYYY-MM"
  sources: Record<string, number>;
  total: number;
};
export type IncomeSummary = {
  total: number;
  count: number;
  largest: number;
};
export type IncomeReport = {
  byMonth: IncomeMonth[];
  sources: string[]; // distinct income source display names, for chart series
  summary: IncomeSummary;
};

/** Spending report */
export type SpendingCategory = {
  detailed: string;
  display: string;
  emoji: string;
  amount: number;
};
export type SpendingReport = {
  total: number;
  categories: SpendingCategory[];
};

/** Cash flow report */
export type SankeyData = {
  nodes: { name: string }[];
  links: { source: number; target: number; value: number }[];
};
export type CashflowStats = {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  investing: number;
};
export type CashflowReport = {
  sankey: SankeyData;
  stats: CashflowStats;
};

/** Investing report */
export type InvestmentAccount = {
  accountId: string;
  name: string;
  institution: string;
  currentBalance: number | null;
};
export type InvestingSummary = {
  accounts: InvestmentAccount[]; // sorted by balance desc, nulls last
  total: number; // sum of non-null balances only
};
export type InvestingReport = InvestingSummary;

/** Cash Placement Nudge */
export type CashPlacementAccount = {
  accountId: string;
  name: string;
  currentBalance: number | null;
  apy: number | null; // user-entered current APY, percent (e.g. 0.4 = 0.4%)
};
export type CashPlacementNeedsRate = {
  accountId: string;
  name: string;
  balance: number;
};
export type CashPlacementOpportunity = {
  accountId: string;
  name: string;
  balance: number;
  apy: number;
  gapPP: number; // referenceApy - apy, in percentage points
  annualOpportunityCost: number; // balance * gapPP / 100
};
export type CashPlacementNudgeResult = {
  needsRate: CashPlacementNeedsRate[];
  opportunities: CashPlacementOpportunity[];
};

/** Automated Savings Rules */
export type SavingsRuleType = "split" | "roundup";
export type SavingsRule = {
  id: string;
  type: SavingsRuleType;
  active: boolean;
  percent: number | null; // for "split": 0-100
  increment: number | null; // for "roundup": 1 or 5
};
export type SavingsRulePerRule = {
  ruleId: string;
  type: SavingsRuleType;
  total: number;
};
export type SavingsSimulationResult = {
  perRule: SavingsRulePerRule[];
  combinedTotal: number;
};
export type SavingsReport = SavingsSimulationResult & {
  rules: SavingsRule[];
};

/** Goals (Savings Buckets) */
export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
};

/** Budgeting Mode Toggle */
export type BudgetingMode = "automated" | "envelope";

export type EnvelopeGroupProgress = {
  group: string;
  emoji: string;
  actual: number; // spend in the selected range
  monthlyCap: number | null; // raw user-entered monthly cap, null = not set
  cap: number | null; // monthlyCap * months in the selected range, null if monthlyCap is null
  overBy: number | null; // max(0, actual - cap), null if cap is null
};

export type EnvelopeReport = {
  groups: EnvelopeGroupProgress[]; // always all 9 non-Income GROUPS entries
  months: number; // number of calendar months the selected range touches
};
