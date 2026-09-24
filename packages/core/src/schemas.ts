import { z } from "zod";
import { isValidBdPhone, normalizeBdPhone } from "./phone";

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
