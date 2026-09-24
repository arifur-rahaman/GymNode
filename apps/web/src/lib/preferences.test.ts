import { describe, expect, it } from "vitest";
import { parseLocale, parseTheme } from "./preferences";

describe("preferences", () => {
  it("defaults to Bangla and dark", () => {
    expect(parseLocale(undefined)).toBe("bn");
    expect(parseTheme(undefined)).toBe("dark");
  });
  it("accepts valid values and ignores junk", () => {
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("fr")).toBe("bn");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("<script>")).toBe("dark");
  });
});
