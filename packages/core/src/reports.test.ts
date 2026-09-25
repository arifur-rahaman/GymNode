import { describe, expect, it } from "vitest";
import { addMonths, reportRange } from "./reports";
import { cartTotals, stockLevel } from "./shop";

describe("addMonths", () => {
  it("clamps to the end of shorter months", () => {
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2028-03-31", -1)).toBe("2028-02-29");
    expect(addMonths("2026-01-15", -2)).toBe("2025-11-15");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });
});

describe("reportRange", () => {
  it("this month is compared with the same days of last month", () => {
    expect(reportRange("month", "2026-09-25")).toEqual({
      from: "2026-09-01",
      to: "2026-09-25",
      prevFrom: "2026-08-01",
      prevTo: "2026-08-25",
    });
  });
  it("6 months runs from the 1st, five months back", () => {
    expect(reportRange("6m", "2026-09-25")).toEqual({
      from: "2026-04-01",
      to: "2026-09-25",
      prevFrom: "2025-10-01",
      prevTo: "2026-03-25",
    });
  });
  it("3 months across a year boundary", () => {
    expect(reportRange("3m", "2026-01-10")).toEqual({
      from: "2025-11-01",
      to: "2026-01-10",
      prevFrom: "2025-08-01",
      prevTo: "2025-10-10",
    });
  });
  it("month-end: 31 Mar compares with all of February", () => {
    const r = reportRange("month", "2026-03-31")!;
    expect([r.prevFrom, r.prevTo]).toEqual(["2026-02-01", "2026-02-28"]);
  });
  it("custom range is compared with the same number of days before it", () => {
    expect(reportRange("custom", "2026-09-25", { from: "2026-09-11", to: "2026-09-20" })).toEqual({
      from: "2026-09-11",
      to: "2026-09-20",
      prevFrom: "2026-09-01",
      prevTo: "2026-09-10",
    });
  });
  it("rejects bad custom ranges", () => {
    expect(
      reportRange("custom", "2026-09-25", { from: "2026-09-20", to: "2026-09-10" }),
    ).toBeNull();
    expect(reportRange("custom", "2026-09-25", { from: "x", to: "2026-09-10" })).toBeNull();
    expect(
      reportRange("custom", "2026-09-25", { from: "2020-01-01", to: "2026-09-10" }),
    ).toBeNull();
  });
});

describe("cartTotals", () => {
  it("adds lines and applies the discount", () => {
    expect(
      cartTotals(
        [
          { pricePaisa: 15000, qty: 2 },
          { pricePaisa: 2500, qty: 1 },
        ],
        2500,
      ),
    ).toEqual({
      subtotalPaisa: 32500,
      discountPaisa: 2500,
      totalPaisa: 30000,
      items: 3,
    });
  });
  it("never lets the discount make a sale free or negative", () => {
    expect(cartTotals([{ pricePaisa: 15000, qty: 1 }], 99999).totalPaisa).toBe(1);
    expect(cartTotals([{ pricePaisa: 15000, qty: 1 }], -500).discountPaisa).toBe(0);
    expect(cartTotals([], 0).totalPaisa).toBe(0);
  });
});

describe("stockLevel", () => {
  it("out, low or ok", () => {
    expect(stockLevel(0, 5)).toBe("out");
    expect(stockLevel(5, 5)).toBe("low");
    expect(stockLevel(6, 5)).toBe("ok");
  });
});
