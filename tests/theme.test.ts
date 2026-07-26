import { describe, expect, it } from "vitest";
import { otherTheme, readStoredTheme } from "@/lib/theme";

describe("readStoredTheme", () => {
  it("defaults to dark when nothing is stored", () => {
    expect(readStoredTheme(null)).toBe("dark");
  });

  it("returns light when light is stored", () => {
    expect(readStoredTheme("light")).toBe("light");
  });

  it("returns dark when dark is stored", () => {
    expect(readStoredTheme("dark")).toBe("dark");
  });

  it("defaults to dark for unrecognized stored values", () => {
    expect(readStoredTheme("sepia")).toBe("dark");
  });
});

describe("otherTheme", () => {
  it("flips dark to light", () => {
    expect(otherTheme("dark")).toBe("light");
  });

  it("flips light to dark", () => {
    expect(otherTheme("light")).toBe("dark");
  });
});
