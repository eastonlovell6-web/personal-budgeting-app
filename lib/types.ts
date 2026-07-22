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
