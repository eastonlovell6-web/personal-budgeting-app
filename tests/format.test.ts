import { describe, it, expect } from "vitest";
import { monthsInRange } from "@/lib/format";

describe("monthsInRange", () => {
  it("counts a single partial month as 1", () => {
    expect(monthsInRange(new Date("2026-07-01"), new Date("2026-07-23"))).toBe(1);
  });

  it("counts a 3-month preset span", () => {
    expect(monthsInRange(new Date("2026-05-01"), new Date("2026-07-23"))).toBe(3);
  });

  it("counts a year-to-date span", () => {
    expect(monthsInRange(new Date("2026-01-01"), new Date("2026-07-23"))).toBe(7);
  });

  it("counts a 12-month preset span", () => {
    expect(monthsInRange(new Date("2025-08-01"), new Date("2026-07-23"))).toBe(12);
  });
});
