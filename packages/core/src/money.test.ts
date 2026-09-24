import { describe, expect, it } from "vitest";
import { formatTaka, formatTakaCompact, groupLakh, paisaToTaka, takaToPaisa } from "./money";

describe("groupLakh", () => {
  it.each([
    ["0", "0"],
    ["999", "999"],
    ["1000", "1,000"],
    ["18500", "18,500"],
    ["342000", "3,42,000"],
    ["1234567", "12,34,567"],
    ["12345678", "1,23,45,678"],
  ])("%s → %s", (input, expected) => {
    expect(groupLakh(input)).toBe(expected);
  });
});

describe("formatTaka", () => {
  it("formats whole taka without decimals", () => {
    expect(formatTaka(150000)).toBe("৳1,500");
    expect(formatTaka(34200000)).toBe("৳3,42,000");
    expect(formatTaka(0)).toBe("৳0");
  });
  it("shows paisa when present", () => {
    expect(formatTaka(150050)).toBe("৳1,500.50");
    expect(formatTaka(5)).toBe("৳0.05");
  });
  it("handles negatives", () => {
    expect(formatTaka(-4680000)).toBe("-৳46,800");
  });
  it("rejects non-integer paisa", () => {
    expect(() => formatTaka(1.5)).toThrow(RangeError);
  });
});

describe("formatTakaCompact", () => {
  it("uses L for lakhs and Cr for crores", () => {
    expect(formatTakaCompact(34200000)).toBe("৳3.42L");
    expect(formatTakaCompact(186200000)).toBe("৳18.62L");
    expect(formatTakaCompact(10000000)).toBe("৳1L");
    expect(formatTakaCompact(1200000000)).toBe("৳1.2Cr");
  });
  it("keeps full format below one lakh", () => {
    expect(formatTakaCompact(4680000)).toBe("৳46,800");
  });
});

describe("taka ↔ paisa", () => {
  it("converts without float drift", () => {
    expect(takaToPaisa(1500)).toBe(150000);
    expect(takaToPaisa(0.1 + 0.2)).toBe(30);
    expect(paisaToTaka(150050)).toBe(1500.5);
  });
});
