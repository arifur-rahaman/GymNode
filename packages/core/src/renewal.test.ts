import { describe, expect, it } from "vitest";
import { needsTransactionId, renewalQuote } from "./renewal";

const base = {
  today: "2026-09-25",
  currentEndDate: null,
  durationDays: 30,
  pricePaisa: 150000,
  admissionFeePaisa: 100000,
  chargeAdmission: true,
  discountPaisa: 0,
};

describe("renewalQuote", () => {
  it("new member starts today and pays admission", () => {
    expect(renewalQuote(base)).toEqual({
      startDate: "2026-09-25",
      endDate: "2026-10-24",
      admissionPaisa: 100000,
      chargesPaisa: 250000,
    });
  });
  it("early renewal continues after the current end date", () => {
    const q = renewalQuote({ ...base, currentEndDate: "2026-09-30", chargeAdmission: false });
    expect(q.startDate).toBe("2026-10-01");
    expect(q.endDate).toBe("2026-10-30");
    expect(q.chargesPaisa).toBe(150000);
  });
  it("renewal on the last day still continues", () => {
    expect(renewalQuote({ ...base, currentEndDate: "2026-09-25" }).startDate).toBe("2026-09-26");
  });
  it("expired membership restarts today", () => {
    expect(renewalQuote({ ...base, currentEndDate: "2026-09-01" }).startDate).toBe("2026-09-25");
  });
  it("applies the discount but never goes below zero", () => {
    expect(renewalQuote({ ...base, discountPaisa: 20000 }).chargesPaisa).toBe(230000);
    expect(renewalQuote({ ...base, discountPaisa: 999999 }).chargesPaisa).toBe(0);
  });
});

describe("needsTransactionId", () => {
  it("is required for mobile banking only", () => {
    expect(needsTransactionId("bkash")).toBe(true);
    expect(needsTransactionId("nagad")).toBe(true);
    expect(needsTransactionId("rocket")).toBe(true);
    expect(needsTransactionId("cash")).toBe(false);
    expect(needsTransactionId("card")).toBe(false);
  });
});
