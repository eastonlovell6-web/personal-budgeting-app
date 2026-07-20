import { describe, it, expect } from "vitest";
import {
  incomeByMonth,
  incomeSummary,
  incomeReport,
  spendingByCategory,
  cashflowSankey,
  cashflowStats,
} from "@/lib/aggregations";
import type { Txn } from "@/lib/types";

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
});
