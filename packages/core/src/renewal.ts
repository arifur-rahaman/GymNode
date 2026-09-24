import { addDays, type IsoDate } from "./dates";

/**
 * Preview of a renewal, mirroring public.record_payment_and_renew() in the database
 * (the database result is what counts; this only powers the "new expiry / total" preview).
 */
export interface RenewalInput {
  today: IsoDate;
  /** End date of the member's current membership, or null if they never had one. */
  currentEndDate: IsoDate | null;
  durationDays: number;
  pricePaisa: number;
  admissionFeePaisa: number;
  /** Admission is charged on a member's first membership. */
  chargeAdmission: boolean;
  discountPaisa: number;
}

export interface RenewalQuote {
  startDate: IsoDate;
  endDate: IsoDate;
  admissionPaisa: number;
  chargesPaisa: number;
}

export function renewalQuote(input: RenewalInput): RenewalQuote {
  // Still active → continue after the current end date; expired or new → start today.
  const startDate =
    input.currentEndDate !== null && input.currentEndDate >= input.today
      ? addDays(input.currentEndDate, 1)
      : input.today;
  const endDate = addDays(startDate, input.durationDays - 1);
  const admissionPaisa = input.chargeAdmission ? input.admissionFeePaisa : 0;
  const chargesPaisa = Math.max(input.pricePaisa + admissionPaisa - input.discountPaisa, 0);
  return { startDate, endDate, admissionPaisa, chargesPaisa };
}

export const MOBILE_BANKING_METHODS = ["bkash", "nagad", "rocket"] as const;
export const PAYMENT_METHODS = ["cash", "bkash", "nagad", "rocket", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function needsTransactionId(method: PaymentMethod): boolean {
  return (MOBILE_BANKING_METHODS as readonly string[]).includes(method);
}
