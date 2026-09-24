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
