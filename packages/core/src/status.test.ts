import { describe, expect, it } from "vitest";
import { daysLeft, memberDisplayStatus } from "./status";

const base = { today: "2026-09-24", endDate: "2026-10-24", frozen: false, duePaisa: 0 };

describe("memberDisplayStatus", () => {
  it("is active when paid and not expired", () => {
    expect(memberDisplayStatus(base)).toBe("active");
  });
  it("is still active on the last day", () => {
    expect(memberDisplayStatus({ ...base, endDate: "2026-09-24" })).toBe("active");
  });
  it("is expired the day after end date, or with no membership", () => {
    expect(memberDisplayStatus({ ...base, endDate: "2026-09-23" })).toBe("expired");
    expect(memberDisplayStatus({ ...base, endDate: null })).toBe("expired");
  });
  it("is due when money is owed on a valid membership", () => {
    expect(memberDisplayStatus({ ...base, duePaisa: 150000 })).toBe("due");
  });
  it("prefers frozen over everything, and expired over due", () => {
    expect(memberDisplayStatus({ ...base, frozen: true, duePaisa: 100, endDate: null })).toBe(
      "frozen",
    );
    expect(memberDisplayStatus({ ...base, endDate: "2026-09-01", duePaisa: 100 })).toBe("expired");
  });
});

describe("daysLeft", () => {
  it("counts remaining days", () => {
    expect(daysLeft("2026-09-24", "2026-09-26")).toBe(2);
    expect(daysLeft("2026-09-24", "2026-09-24")).toBe(0);
  });
});
