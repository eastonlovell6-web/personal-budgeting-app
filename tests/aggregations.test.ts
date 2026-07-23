import { describe, it, expect } from "vitest";
import {
  incomeByMonth,
  incomeSummary,
  incomeReport,
  spendingByCategory,
  cashflowSankey,
  cashflowStats,
  investingSummary,
  cashPlacementNudge,
} from "@/lib/aggregations";
import type { Txn, InvestmentAccount, CashPlacementAccount } from "@/lib/types";

const t = (o: Partial<Txn>): Txn => ({
  transactionId: Math.random().toString(),
  date: new Date("2026-01-15"),
  amount: 0,
  merchantName: null,
  name: "x",
  pfPrimary: "GENERAL_MERCHANDISE",
  pfDetailed: "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE",
  isIncome: false,
  ...o,
});

const fixture: Txn[] = [
  t({ isIncome: true, pfPrimary: "INCOME", pfDetailed: "INCOME_WAGES", amount: 4000, date: new Date("2026-01-01") }),
  t({ isIncome: true, pfPrimary: "INCOME", pfDetailed: "INCOME_INTEREST_EARNED", amount: 50, date: new Date("2026-01-05") }),
  t({ isIncome: true, pfPrimary: "INCOME", pfDetailed: "INCOME_WAGES", amount: 4000, date: new Date("2026-02-01") }),
  t({ pfPrimary: "RENT_AND_UTILITIES", pfDetailed: "RENT_AND_UTILITIES_RENT", amount: 2000, date: new Date("2026-01-03") }),
  t({ pfPrimary: "FOOD_AND_DRINK", pfDetailed: "FOOD_AND_DRINK_GROCERIES", amount: 300, date: new Date("2026-01-10") }),
  t({ pfPrimary: "FOOD_AND_DRINK", pfDetailed: "FOOD_AND_DRINK_RESTAURANT", amount: 120, date: new Date("2026-01-12") }),
];

describe("aggregations", () => {
  it("income summary sums inflows only", () => {
    const s = incomeSummary(fixture);
    expect(s.total).toBe(8050);
    expect(s.count).toBe(3);
    expect(s.largest).toBe(4000);
  });

  it("income by month buckets and sums by source", () => {
    const rows = incomeByMonth(fixture);
    const jan = rows.find((r) => r.month === "2026-01")!;
    expect(jan.total).toBe(4050);
    expect(jan.sources["Paychecks"]).toBe(4000);
    expect(jan.sources["Interest"]).toBe(50);
    const feb = rows.find((r) => r.month === "2026-02")!;
    expect(feb.total).toBe(4000);
    // sorted chronologically
    expect(rows.map((r) => r.month)).toEqual(["2026-01", "2026-02"]);
  });

  it("income report exposes distinct sorted sources", () => {
    const rep = incomeReport(fixture);
    expect(rep.sources).toContain("Paychecks");
    expect(rep.sources).toContain("Interest");
  });

  it("spending groups by category desc, income excluded", () => {
    const rows = spendingByCategory(fixture);
    expect(rows[0].amount).toBe(2000);
    expect(rows[0].display).toBe("Rent");
    expect(rows.find((r) => r.detailed === "FOOD_AND_DRINK_GROCERIES")!.amount).toBe(300);
    expect(rows.some((r) => r.detailed.startsWith("INCOME"))).toBe(false);
  });

  it("cashflow stats compute net and savings rate", () => {
    const c = cashflowStats(fixture);
    expect(c.income).toBe(8050);
    expect(c.expenses).toBe(2420);
    expect(c.net).toBe(5630);
    expect(c.savingsRate).toBeCloseTo(5630 / 8050);
  });

  it("cashflow stats savings rate is 0 when no income", () => {
    const c = cashflowStats([t({ amount: 100 })]);
    expect(c.income).toBe(0);
    expect(c.savingsRate).toBe(0);
  });

  it("cashflow sankey builds valid node/link indices", () => {
    const s = cashflowSankey(fixture);
    expect(s.nodes.length).toBeGreaterThan(0);
    // every link points at real node indices
    for (const l of s.links) {
      expect(l.source).toBeGreaterThanOrEqual(0);
      expect(l.source).toBeLessThan(s.nodes.length);
      expect(l.target).toBeLessThan(s.nodes.length);
      expect(l.value).toBeGreaterThan(0);
    }
    // has an Income hub node and a Savings node (net positive)
    expect(s.nodes.some((n) => n.name === "Income")).toBe(true);
    expect(s.nodes.some((n) => n.name === "Savings")).toBe(true);
  });

  it("investingSummary sorts by balance descending", () => {
    const accounts: InvestmentAccount[] = [
      { accountId: "a1", name: "Brokerage", institution: "Robinhood", currentBalance: 5000 },
      { accountId: "a2", name: "IRA", institution: "Robinhood", currentBalance: 20000 },
      { accountId: "a3", name: "Crypto", institution: "Robinhood", currentBalance: 1200 },
    ];
    const s = investingSummary(accounts);
    expect(s.accounts.map((a) => a.accountId)).toEqual(["a2", "a1", "a3"]);
    expect(s.total).toBe(26200);
  });

  it("investingSummary excludes null balances from the total but keeps them in the list", () => {
    const accounts: InvestmentAccount[] = [
      { accountId: "a1", name: "Brokerage", institution: "Robinhood", currentBalance: 5000 },
      { accountId: "a2", name: "Just linked", institution: "Robinhood", currentBalance: null },
    ];
    const s = investingSummary(accounts);
    expect(s.total).toBe(5000);
    expect(s.accounts).toHaveLength(2);
    expect(s.accounts.find((a) => a.accountId === "a2")!.currentBalance).toBeNull();
    // null balances sort last regardless of magnitude
    expect(s.accounts[s.accounts.length - 1].accountId).toBe("a2");
  });

  it("investingSummary handles an empty account list", () => {
    const s = investingSummary([]);
    expect(s.accounts).toEqual([]);
    expect(s.total).toBe(0);
  });

  it("cashflow stats include the investing total and default to 0", () => {
    const withDefault = cashflowStats(fixture);
    expect(withDefault.investing).toBe(0);

    const withInvesting = cashflowStats(fixture, 1000);
    expect(withInvesting.investing).toBe(1000);
    // income/expenses/net/savingsRate are unaffected by investingTotal
    expect(withInvesting.income).toBe(8050);
    expect(withInvesting.net).toBe(5630);
  });

  it("cashflow sankey never shows an Investing leaf and reduces Savings when investingTotal > 0", () => {
    const withoutInvesting = cashflowSankey(fixture);
    expect(withoutInvesting.nodes.some((n) => n.name === "Investing")).toBe(false);
    const savingsLinkBefore = withoutInvesting.links.find(
      (l) => withoutInvesting.nodes[l.target].name === "Savings"
    )!;
    expect(savingsLinkBefore.value).toBe(5630);

    const withInvesting = cashflowSankey(fixture, 1000);
    expect(withInvesting.nodes.some((n) => n.name === "Investing")).toBe(false);
    const savingsLinkAfter = withInvesting.links.find(
      (l) => withInvesting.nodes[l.target].name === "Savings"
    )!;
    expect(savingsLinkAfter.value).toBe(4630); // 5630 net - 1000 invested
  });

  it("cashflow sankey omits the Investing leaf when investingTotal is 0", () => {
    const s = cashflowSankey(fixture, 0);
    expect(s.nodes.some((n) => n.name === "Investing")).toBe(false);
  });

  describe("cashPlacementNudge", () => {
    const acc = (o: Partial<CashPlacementAccount>): CashPlacementAccount => ({
      accountId: Math.random().toString(),
      name: "Checking",
      currentBalance: 1000,
      apy: null,
      ...o,
    });

    it("returns nothing when no reference rate is set yet", () => {
      const result = cashPlacementNudge(
        [acc({ apy: null }), acc({ apy: 0.1 })],
        null
      );
      expect(result.needsRate).toEqual([]);
      expect(result.opportunities).toEqual([]);
    });

    it("excludes accounts below the minimum balance", () => {
      const result = cashPlacementNudge([acc({ currentBalance: 400, apy: null })], 4.0);
      expect(result.needsRate).toEqual([]);
    });

    it("flags accounts with no APY entered as needing a rate", () => {
      const result = cashPlacementNudge(
        [acc({ accountId: "a1", name: "Savings", currentBalance: 1000, apy: null })],
        4.0
      );
      expect(result.needsRate).toEqual([{ accountId: "a1", name: "Savings", balance: 1000 }]);
    });

    it("excludes accounts whose gap is below the threshold", () => {
      const result = cashPlacementNudge(
        [acc({ currentBalance: 1000, apy: 3.6 })],
        4.0
      );
      expect(result.opportunities).toEqual([]);
      expect(result.needsRate).toEqual([]);
    });

    it("includes accounts at/above the gap threshold with correct gapPP and annualOpportunityCost", () => {
      const result = cashPlacementNudge(
        [acc({ accountId: "a2", name: "Old Savings", currentBalance: 10000, apy: 0.1 })],
        4.1
      );
      expect(result.opportunities).toEqual([
        {
          accountId: "a2",
          name: "Old Savings",
          balance: 10000,
          apy: 0.1,
          gapPP: 4.0,
          annualOpportunityCost: 400,
        },
      ]);
    });

    it("sorts opportunities by annual opportunity cost descending", () => {
      const result = cashPlacementNudge(
        [
          acc({ accountId: "small", currentBalance: 1000, apy: 0 }), // gap 4.0, cost 40
          acc({ accountId: "big", currentBalance: 50000, apy: 0 }), // gap 4.0, cost 2000
        ],
        4.0
      );
      expect(result.opportunities.map((o) => o.accountId)).toEqual(["big", "small"]);
    });
  });
});
