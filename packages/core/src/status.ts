import { daysBetween, type IsoDate } from "./dates";

/**
 * One badge per member, chosen by priority (docs/PLAN.md §4.5):
 * frozen → expired → due → active.
 * Pending bKash/Nagad payments count as paid (founder decision Q4); the UI adds a
 * separate "যাচাই বাকি" flag for them.
 */
export type MemberDisplayStatus = "frozen" | "expired" | "due" | "active";

export interface MemberStatusInput {
  today: IsoDate;
  /** Current membership end date, or null if the member never had one. */
  endDate: IsoDate | null;
  /** Is the current membership frozen on `today`? */
  frozen: boolean;
  /** Outstanding amount in paisa (pending-verification payments already counted as paid). */
  duePaisa: number;
  /** Days after end date the member may still enter (access_rules.grace_days). Does not change the badge. */
  graceDays?: number;
}

export function memberDisplayStatus(input: MemberStatusInput): MemberDisplayStatus {
  if (input.frozen) return "frozen";
  if (input.endDate === null || daysBetween(input.today, input.endDate) < 0) return "expired";
  if (input.duePaisa > 0) return "due";
  return "active";
}

/** Days left including today; 0 means it ends today, negative means already expired. */
export function daysLeft(today: IsoDate, endDate: IsoDate): number {
  return daysBetween(today, endDate);
}

export type BadgeTone = "green" | "amber" | "red" | "blue" | "gray";

export const statusTone: Record<MemberDisplayStatus, BadgeTone> = {
  active: "green",
  due: "amber",
  expired: "red",
  frozen: "gray",
};
