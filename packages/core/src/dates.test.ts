import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatDateLong,
  formatDateShort,
  formatTimeDhaka,
  isIsoDate,
  todayInDhaka,
} from "./dates";

describe("todayInDhaka", () => {
  it("uses Dhaka's date, not UTC's", () => {
    // 20:30 UTC on 23 Sep is 02:30 on 24 Sep in Dhaka (UTC+6).
    expect(todayInDhaka(new Date("2026-09-23T20:30:00Z"))).toBe("2026-09-24");
    expect(todayInDhaka(new Date("2026-09-23T17:59:00Z"))).toBe("2026-09-23");
  });
});

describe("date arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-09-24", 30)).toBe("2026-10-24");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("counts days between dates", () => {
    expect(daysBetween("2026-09-24", "2026-09-29")).toBe(5);
    expect(daysBetween("2026-09-29", "2026-09-24")).toBe(-5);
  });
  it("validates ISO dates", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("24-09-2026")).toBe(false);
    expect(isIsoDate("2026-09-24")).toBe(true);
    expect(() => addDays("nope", 1)).toThrow(RangeError);
  });
});

describe("formatting", () => {
  it("formats table dates in English", () => {
    expect(formatDateShort("2026-09-24")).toBe("24 Sep 2026");
  });
  it("formats long dates per locale", () => {
    expect(formatDateLong("2026-09-24", "en")).toMatch(/^Thursday,? 24 September$/);
    expect(formatDateLong("2026-09-24", "bn")).toContain("সেপ্টেম্বর");
    expect(formatDateLong("2026-09-24", "bn")).toContain("বৃহস্পতিবার");
  });
  it("shows Dhaka clock time", () => {
    expect(formatTimeDhaka(new Date("2026-09-24T03:14:00Z"))).toBe("9:14");
  });
});

describe("formatDateShort with instants", () => {
  it("uses the Dhaka calendar day", () => {
    expect(formatDateShort(new Date("2026-09-23T20:30:00Z"))).toBe("24 Sep 2026");
  });
});
