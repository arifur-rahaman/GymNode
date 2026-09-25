import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatDateLong,
  formatMonth,
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

describe("dhakaPeriod", async () => {
  const { dhakaPeriod, percentChange, dhakaDayStart } = await import("./dates");
  // Friday 25 Sep 2026, 01:00 in Dhaka (= 24 Sep 19:00 UTC).
  const now = new Date("2026-09-24T19:00:00Z");

  it("today runs from Dhaka midnight to the next", () => {
    const r = dhakaPeriod("today", now);
    expect(r.firstDay).toBe("2026-09-25");
    expect(r.from.toISOString()).toBe("2026-09-24T18:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-09-25T18:00:00.000Z");
    expect(r.prevFrom.toISOString()).toBe("2026-09-23T18:00:00.000Z");
  });
  it("the week starts on Saturday", () => {
    expect(dhakaPeriod("week", now).firstDay).toBe("2026-09-19");
    // A Saturday is the first day of its own week.
    expect(dhakaPeriod("week", new Date("2026-09-26T06:00:00Z")).firstDay).toBe("2026-09-26");
  });
  it("the month is the calendar month, across year ends too", () => {
    expect(dhakaPeriod("month", now).firstDay).toBe("2026-09-01");
    const dec = dhakaPeriod("month", new Date("2026-12-15T06:00:00Z"));
    expect(dec.to.toISOString()).toBe(dhakaDayStart("2027-01-01").toISOString());
    const jan = dhakaPeriod("month", new Date("2027-01-15T06:00:00Z"));
    expect(jan.prevFrom.toISOString()).toBe(dhakaDayStart("2026-12-01").toISOString());
  });
  it("percent change", () => {
    expect(percentChange(112, 100)).toBe(12);
    expect(percentChange(50, 0)).toBeNull();
  });
});

describe("formatMonth", () => {
  it("uses Bangla or English month names with English-digit years", () => {
    expect(formatMonth("2026-09-25", "bn")).toBe("সেপ্টেম্বর 2026");
    expect(formatMonth("2026-04-01", "bn", { style: "short", withYear: false })).toBe("এপ্রি");
    expect(formatMonth("2026-12-01", "en")).toBe("December 2026");
    expect(formatMonth("2026-12-01", "en", { style: "short", withYear: false })).toBe("Dec");
  });
});
