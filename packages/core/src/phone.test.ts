import { describe, expect, it } from "vitest";
import { isValidBdPhone, maskBdPhone, normalizeBdPhone, toLocalBdPhone } from "./phone";

describe("normalizeBdPhone", () => {
  it.each([
    ["01712345678", "+8801712345678"],
    ["8801712345678", "+8801712345678"],
    ["+880 1712-345678", "+8801712345678"],
    ["01312345678", "+8801312345678"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeBdPhone(input)).toBe(expected);
  });

  it.each(["0171234567", "01212345678", "1712345678", "abc", ""])("rejects %s", (input) => {
    expect(normalizeBdPhone(input)).toBeNull();
    expect(isValidBdPhone(input)).toBe(false);
  });
});

describe("display", () => {
  it("shows local form and masked form", () => {
    expect(toLocalBdPhone("+8801712345421")).toBe("01712345421");
    expect(maskBdPhone("+8801712345421")).toBe("017•• •••421");
  });
});
