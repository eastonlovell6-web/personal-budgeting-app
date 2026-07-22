import { describe, it, expect } from "vitest";
import {
  categoryInfo,
  isIncomeCategory,
  isTransfer,
  isInvestmentTransferCategory,
  GROUPS,
} from "@/lib/categories";

describe("categories", () => {
  it("maps a known detailed category to display/emoji/group", () => {
    const c = categoryInfo("FOOD_AND_DRINK_RESTAURANT");
    expect(c.display).toBe("Restaurants");
    expect(c.group).toBe("Food & Dining");
    expect(c.emoji).toBeTruthy();
  });

  it("maps rent to Housing group", () => {
    const c = categoryInfo("RENT_AND_UTILITIES_RENT");
    expect(c.display).toBe("Rent");
    expect(c.group).toBe("Housing");
  });

  it("falls back gracefully for unknown categories", () => {
    const c = categoryInfo("SOMETHING_WEIRD_XYZ");
    expect(c.display).toBeTruthy();
    expect(c.group).toBe("Other");
  });

  it("classifies income primary categories (transfers are not income)", () => {
    expect(isIncomeCategory("INCOME")).toBe(true);
    expect(isIncomeCategory("TRANSFER_IN")).toBe(false);
    expect(isIncomeCategory("FOOD_AND_DRINK")).toBe(false);
  });

  it("flags transfers so reports can exclude them", () => {
    expect(isTransfer("TRANSFER_IN")).toBe(true);
    expect(isTransfer("TRANSFER_OUT")).toBe(true);
    expect(isTransfer("FOOD_AND_DRINK")).toBe(false);
  });

  it("flags only the investment transfer detailed category", () => {
    expect(
      isInvestmentTransferCategory("TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS")
    ).toBe(true);
    expect(isInvestmentTransferCategory("TRANSFER_OUT_SAVINGS")).toBe(false);
    expect(isInvestmentTransferCategory("TRANSFER_IN_DEPOSIT")).toBe(false);
    expect(isInvestmentTransferCategory("FOOD_AND_DRINK_GROCERIES")).toBe(false);
  });

  it("exposes ordered groups starting with Income and ending with Other", () => {
    expect(GROUPS[0]).toBe("Income");
    expect(GROUPS[GROUPS.length - 1]).toBe("Other");
  });
});
