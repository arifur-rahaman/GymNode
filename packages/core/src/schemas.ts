import { z } from "zod";
import { isIsoDate } from "./dates";
import { isValidBdPhone, normalizeBdPhone } from "./phone";
import { PAYMENT_METHODS, needsTransactionId } from "./renewal";

/**
 * Form rules shared by the browser (instant feedback) and the server (the real check).
 * Error messages are short codes; the app translates them via messages/<locale>.json
 * under "errors.<code>", so users see Bangla or English text.
 */
export const ERR = {
  required: "required",
  tooShort: "tooShort",
  tooLong: "tooLong",
  invalidEmail: "invalidEmail",
  invalidPhone: "invalidPhone",
  passwordTooShort: "passwordTooShort",
  passwordTooLong: "passwordTooLong",
  passwordsDontMatch: "passwordsDontMatch",
  invalidPrefix: "invalidPrefix",
  invalidNumber: "invalidNumber",
  invalidRole: "invalidRole",
  invalidDate: "invalidDate",
  transactionRequired: "transactionRequired",
  untilBeforeFrom: "untilBeforeFrom",
  choosePackage: "choosePackage",
} as const;
export type ErrorCode = (typeof ERR)[keyof typeof ERR];

const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? ERR.required : ERR.tooShort)
    .max(max, ERR.tooLong);

const optionalText = (max: number) => z.string().trim().max(max, ERR.tooLong);

export const bdPhone = z
  .string()
  .trim()
  .refine(isValidBdPhone, ERR.invalidPhone)
  .transform((v) => normalizeBdPhone(v) as string);

const optionalBdPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidBdPhone(v), ERR.invalidPhone)
  .transform((v) => (v === "" ? null : normalizeBdPhone(v)));

// Supabase/bcrypt use at most 72 bytes of a password.
export const password = z.string().min(8, ERR.passwordTooShort).max(72, ERR.passwordTooLong);

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, ERR.required),
  password: z.string().min(1, ERR.required),
});
export type LoginInput = z.input<typeof loginSchema>;

export const signUpSchema = z.object({
  fullName: text(2, 80),
  email: z.string().trim().toLowerCase().pipe(z.email(ERR.invalidEmail)),
  password,
});
export type SignUpInput = z.input<typeof signUpSchema>;

export const emailOnlySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email(ERR.invalidEmail)),
});

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: ERR.passwordsDontMatch, path: ["confirm"] });
export type NewPasswordInput = z.input<typeof newPasswordSchema>;

export const gymSchema = z.object({
  name: text(2, 80),
  codePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,4}$/, ERR.invalidPrefix),
  city: optionalText(60),
  phone: optionalBdPhone,
  address: optionalText(200),
  branchName: text(1, 80),
  branchAddress: optionalText(200),
});
export type GymInput = z.input<typeof gymSchema>;

const takaAmount = z.coerce
  .number({ error: ERR.invalidNumber })
  .finite(ERR.invalidNumber)
  .min(0, ERR.invalidNumber)
  .max(10_000_000, ERR.invalidNumber);

export const packageSchema = z.object({
  name: text(1, 60),
  durationDays: z.coerce
    .number({ error: ERR.invalidNumber })
    .int(ERR.invalidNumber)
    .min(1, ERR.invalidNumber)
    .max(3660, ERR.invalidNumber),
  priceTaka: takaAmount,
  admissionFeeTaka: takaAmount,
});
export type PackageInput = z.input<typeof packageSchema>;

export const packagesSchema = z.object({ packages: z.array(packageSchema).min(1).max(10) });

export const STAFF_ROLES = ["manager", "reception", "trainer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const staffSchema = z.object({
  fullName: text(2, 80),
  phone: bdPhone,
  role: z.enum(STAFF_ROLES, { error: ERR.invalidRole }),
  password,
});
export type StaffInput = z.input<typeof staffSchema>;

export const staffPasswordResetSchema = z.object({ password });

// ---------------------------------------------------------------------------
// Members (M2)
// ---------------------------------------------------------------------------
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || isIsoDate(v), ERR.invalidDate)
  .transform((v) => (v === "" ? null : v));

const requiredDate = z.string().trim().refine(isIsoDate, ERR.invalidDate);

export const GENDERS = ["male", "female", "other"] as const;

const optionalGender = z.enum([...GENDERS, ""]).transform((v) => (v === "" ? null : v));

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

export const memberSchema = z.object({
  fullName: text(2, 80),
  phone: bdPhone,
  gender: optionalGender,
  dob: optionalDate,
  address: optionalText(200),
  emergencyName: optionalText(80),
  emergencyPhone: optionalBdPhone,
  trainerId: optionalId,
  notes: optionalText(1000),
});
export type MemberInput = z.input<typeof memberSchema>;

/** Package + payment part of the new-member form and the renew panel. */
export const paymentSchema = z
  .object({
    packageId: z.string().trim().min(1, ERR.choosePackage),
    amountTaka: takaAmount,
    discountTaka: takaAmount,
    method: z.enum(PAYMENT_METHODS),
    transactionId: z.string().trim().max(40, ERR.tooLong),
  })
  .refine(
    (v) => v.amountTaka === 0 || !needsTransactionId(v.method) || v.transactionId.length >= 4,
    { message: ERR.transactionRequired, path: ["transactionId"] },
  );
export type PaymentInput = z.input<typeof paymentSchema>;

export const freezeSchema = z
  .object({ from: requiredDate, until: requiredDate, reason: optionalText(300) })
  .refine((v) => v.until >= v.from, { message: ERR.untilBeforeFrom, path: ["until"] });
export type FreezeInput = z.input<typeof freezeSchema>;

export const selfRegistrationSchema = z.object({
  fullName: text(2, 80),
  phone: bdPhone,
  gender: optionalGender,
  dob: optionalDate,
  address: optionalText(200),
  emergencyName: optionalText(80),
  emergencyPhone: optionalBdPhone,
});
export type SelfRegistrationInput = z.input<typeof selfRegistrationSchema>;

export const packageFormSchema = packageSchema.extend({ isActive: z.boolean() });
export type PackageFormInput = z.input<typeof packageFormSchema>;

/** Paying an outstanding due without renewing (M3). */
export const dueSchema = z
  .object({
    amountTaka: takaAmount.refine((v) => v > 0, ERR.invalidNumber),
    method: z.enum(PAYMENT_METHODS),
    transactionId: z.string().trim().max(40, ERR.tooLong),
  })
  .refine((v) => !needsTransactionId(v.method) || v.transactionId.length >= 4, {
    message: ERR.transactionRequired,
    path: ["transactionId"],
  });
export type DueInput = z.input<typeof dueSchema>;

export const cancelPaymentSchema = z.object({ reason: text(3, 300) });

// ---------------------------------------------------------------------------
// Expenses, shop and stock (M5)
// ---------------------------------------------------------------------------
const positiveTaka = takaAmount.refine((v) => v > 0, ERR.invalidNumber);

const wholeNumber = (min: number, max: number) =>
  z.coerce
    .number({ error: ERR.invalidNumber })
    .int(ERR.invalidNumber)
    .min(min, ERR.invalidNumber)
    .max(max, ERR.invalidNumber);

export const expenseSchema = z.object({
  categoryId: z.string().trim().min(1, ERR.required),
  amountTaka: positiveTaka,
  spentOn: requiredDate,
  note: optionalText(300),
});
export type ExpenseInput = z.input<typeof expenseSchema>;

export const expenseCategorySchema = z.object({
  name: text(1, 60),
  isSalary: z.boolean(),
});
export type ExpenseCategoryInput = z.input<typeof expenseCategorySchema>;

export const productSchema = z.object({
  name: text(1, 80),
  priceTaka: positiveTaka,
  lowStockAt: wholeNumber(0, 100_000),
  isActive: z.boolean(),
});
export type ProductInput = z.input<typeof productSchema>;

/** Stock in. The purchase can be recorded as an expense at the same time. */
export const stockInSchema = z.object({
  qty: wholeNumber(1, 100_000),
  unitCostTaka: takaAmount,
  recordExpense: z.boolean(),
  categoryId: z.string().trim(),
  note: optionalText(300),
});
export type StockInInput = z.input<typeof stockInSchema>;

export const stockAdjustSchema = z.object({
  newQty: wholeNumber(0, 100_000),
  reason: text(3, 300),
});
export type StockAdjustInput = z.input<typeof stockAdjustSchema>;

export const saleSchema = z
  .object({
    items: z
      .array(z.object({ productId: z.string().min(1), qty: wholeNumber(1, 999) }))
      .min(1, ERR.required)
      .max(50),
    memberId: optionalId,
    discountTaka: takaAmount,
    method: z.enum(PAYMENT_METHODS),
    transactionId: z.string().trim().max(40, ERR.tooLong),
  })
  .refine((v) => !needsTransactionId(v.method) || v.transactionId.length >= 4, {
    message: ERR.transactionRequired,
    path: ["transactionId"],
  });
export type SaleInput = z.input<typeof saleSchema>;

// ---------------------------------------------------------------------------
// Super admin & support (M7)
// ---------------------------------------------------------------------------
export const BILLING_METHODS = ["cash", "bkash", "nagad", "rocket", "card", "bank"] as const;
export type BillingMethod = (typeof BILLING_METHODS)[number];

const optionalTaka = z.union([z.literal(""), takaAmount]).transform((v) => (v === "" ? null : v));
const optionalCount = z
  .union([z.literal(""), wholeNumber(0, 1_000_000)])
  .transform((v) => (v === "" ? null : v));

export const PLAN_FEATURES = [
  "sms_reminders",
  "basic_reports",
  "whatsapp_automation",
  "member_app",
  "website",
  "branded_app",
  "ai_diet",
  "priority_support",
] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

export const planSchema = z.object({
  name: text(1, 40),
  nameEn: text(1, 40),
  /** Empty = price not decided yet ("[দাম]"). */
  priceTaka: optionalTaka,
  billingPeriod: z.enum(["monthly", "yearly"]),
  /** Empty = unlimited. */
  maxMembers: optionalCount,
  maxBranches: optionalCount,
  maxDevices: optionalCount,
  features: z.array(z.enum(PLAN_FEATURES)),
  isActive: z.boolean(),
});
export type PlanInput = z.input<typeof planSchema>;

export const gymPlanSchema = z.object({
  planId: z.string().trim(),
  /** Empty = use the plan's price. */
  priceTaka: optionalTaka,
});
export type GymPlanInput = z.input<typeof gymPlanSchema>;

export const gymStatusSchema = z.object({
  status: z.enum(["active", "suspended", "cancelled"]),
  reason: text(3, 300),
});
export type GymStatusInput = z.input<typeof gymStatusSchema>;

export const extendTrialSchema = z.object({ days: wholeNumber(1, 90) });
export type ExtendTrialInput = z.input<typeof extendTrialSchema>;

export const invoiceSchema = z.object({
  amountTaka: takaAmount,
  dueDate: requiredDate,
  /** First day of the billed month, e.g. "2026-09-01"; empty for one-off invoices. */
  periodMonth: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}$/.test(v), ERR.invalidDate)
    .transform((v) => (v === "" ? null : `${v}-01`)),
  note: optionalText(300),
});
export type InvoiceInput = z.input<typeof invoiceSchema>;

export const invoicePaidSchema = z
  .object({
    method: z.enum(BILLING_METHODS),
    transactionId: z.string().trim().max(40, ERR.tooLong),
    paidOn: requiredDate,
  })
  .refine((v) => ["cash", "card", "bank"].includes(v.method) || v.transactionId.length >= 4, {
    message: ERR.transactionRequired,
    path: ["transactionId"],
  });
export type InvoicePaidInput = z.input<typeof invoicePaidSchema>;

export const supportSessionSchema = z.object({
  reason: text(5, 500),
  minutes: z.coerce
    .number()
    .int()
    .refine((v) => [15, 30, 60, 120].includes(v), ERR.invalidNumber),
});
export type SupportSessionInput = z.input<typeof supportSessionSchema>;

export const ticketSchema = z.object({
  subject: text(3, 120),
  body: text(1, 2000),
  priority: z.enum(["normal", "urgent"]),
});
export type TicketInput = z.input<typeof ticketSchema>;

export const ticketReplySchema = z.object({ body: text(1, 2000) });
export type TicketReplyInput = z.input<typeof ticketReplySchema>;

export const teamMemberSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email(ERR.invalidEmail)),
  role: z.enum(["super_admin", "support"]),
});
export type TeamMemberInput = z.input<typeof teamMemberSchema>;

export const platformSettingsSchema = z.object({
  trialDays: wholeNumber(1, 90),
  graceDays: wholeNumber(1, 90),
});
export type PlatformSettingsInput = z.input<typeof platformSettingsSchema>;

export const gymProfileSchema = z.object({
  name: text(2, 80),
  city: optionalText(60),
  phone: optionalBdPhone,
  address: optionalText(200),
  /** Monthly income target for the dashboard (empty = none). */
  monthlyTargetTaka: optionalTaka,
});
export type GymProfileInput = z.input<typeof gymProfileSchema>;
