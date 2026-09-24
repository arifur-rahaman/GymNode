import { describe, expect, it } from "vitest";
import { gymSchema, newPasswordSchema, packageSchema, signUpSchema, staffSchema } from "./schemas";

function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : result.error?.issues[0]?.message;
}

describe("signUpSchema", () => {
  it("accepts a valid owner and normalises email", () => {
    const r = signUpSchema.parse({
      fullName: " জাহিদ ",
      email: " Owner@Gym.COM ",
      password: "12345678",
    });
    expect(r).toEqual({ fullName: "জাহিদ", email: "owner@gym.com", password: "12345678" });
  });
  it("gives translatable error codes", () => {
    expect(
      firstError(signUpSchema.safeParse({ fullName: "জ", email: "a@b.co", password: "12345678" })),
    ).toBe("tooShort");
    expect(
      firstError(
        signUpSchema.safeParse({ fullName: "জাহিদ", email: "nope", password: "12345678" }),
      ),
    ).toBe("invalidEmail");
    expect(
      firstError(signUpSchema.safeParse({ fullName: "জাহিদ", email: "a@b.co", password: "short" })),
    ).toBe("passwordTooShort");
  });
});

describe("newPasswordSchema", () => {
  it("requires matching passwords", () => {
    const r = newPasswordSchema.safeParse({ password: "12345678", confirm: "12345679" });
    expect(firstError(r)).toBe("passwordsDontMatch");
  });
});

describe("gymSchema", () => {
  const base = {
    name: "পাওয়ার হাউস জিম",
    codePrefix: "ph",
    city: "ঢাকা",
    phone: "",
    address: "",
    branchName: "ধানমন্ডি",
    branchAddress: "",
  };
  it("upper-cases the prefix and allows an empty phone", () => {
    const r = gymSchema.parse(base);
    expect(r.codePrefix).toBe("PH");
    expect(r.phone).toBeNull();
  });
  it("normalises the phone", () => {
    expect(gymSchema.parse({ ...base, phone: "01711111111" }).phone).toBe("+8801711111111");
  });
  it("rejects bad prefixes", () => {
    expect(firstError(gymSchema.safeParse({ ...base, codePrefix: "P1" }))).toBe("invalidPrefix");
    expect(firstError(gymSchema.safeParse({ ...base, codePrefix: "ABCDE" }))).toBe("invalidPrefix");
  });
});

describe("packageSchema", () => {
  it("coerces numbers from form inputs", () => {
    expect(
      packageSchema.parse({
        name: "মাসিক",
        durationDays: "30",
        priceTaka: "1500",
        admissionFeeTaka: "0",
      }),
    ).toEqual({
      name: "মাসিক",
      durationDays: 30,
      priceTaka: 1500,
      admissionFeeTaka: 0,
    });
  });
  it("rejects negative or fractional values", () => {
    expect(
      firstError(
        packageSchema.safeParse({
          name: "x",
          durationDays: "1.5",
          priceTaka: 1,
          admissionFeeTaka: 0,
        }),
      ),
    ).toBe("invalidNumber");
    expect(
      firstError(
        packageSchema.safeParse({
          name: "x",
          durationDays: 30,
          priceTaka: -1,
          admissionFeeTaka: 0,
        }),
      ),
    ).toBe("invalidNumber");
  });
});

describe("staffSchema", () => {
  it("accepts a receptionist", () => {
    const r = staffSchema.parse({
      fullName: "শিপা",
      phone: "01722222222",
      role: "reception",
      password: "12345678",
    });
    expect(r.phone).toBe("+8801722222222");
  });
  it("does not allow creating owners", () => {
    expect(
      firstError(
        staffSchema.safeParse({
          fullName: "শিপা",
          phone: "01722222222",
          role: "owner",
          password: "12345678",
        }),
      ),
    ).toBe("invalidRole");
  });
});
