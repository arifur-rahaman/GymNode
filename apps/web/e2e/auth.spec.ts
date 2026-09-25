import { expect, test, type Page } from "@playwright/test";

// These tests need the local Supabase stack with the seed (pnpm db:reset).
// Seeded logins are documented in supabase/seed.sql.

async function login(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("ইমেইল বা মোবাইল নম্বর").fill(identifier);
  await page.getByLabel("পাসওয়ার্ড", { exact: true }).fill(password);
  await page.getByRole("button", { name: "লগইন", exact: true }).click();
}

async function logout(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole("button", { name: "মেনু খুলুন" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "লগআউট" }).click();
  } else {
    await page.getByRole("button", { name: "লগআউট" }).first().click();
  }
  await expect(page).toHaveURL(/\/login$/);
}

function randomPhone() {
  return `017${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
}

test.describe("M1 auth & onboarding", () => {
  test("protected pages send logged-out visitors to login", async ({ page }) => {
    await page.goto("/app/staff");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fstaff$/);
  });

  test("wrong password shows a clear Bangla error", async ({ page }) => {
    await login(page, "owner@gymnode.test", "wrong-password");
    await expect(
      page.getByRole("alert").filter({ hasText: "ইমেইল/ফোন বা পাসওয়ার্ড ভুল" }),
    ).toBeVisible();
  });

  test("seeded owner reaches the dashboard and sees staff", async ({ page, isMobile }) => {
    await login(page, "owner@gymnode.test", "GymNode-owner-1");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1, name: "ড্যাশবোর্ড" })).toBeVisible();
    await expect(
      page.getByText("পাওয়ার হাউস জিম").filter({ visible: true }).first(),
    ).toBeVisible();
    await page.goto("/app/staff");
    await expect(page.getByText("শিপা আক্তার").filter({ visible: true }).first()).toBeVisible();
    await logout(page, isMobile);
  });

  test("super admin lands on the admin area", async ({ page }) => {
    await login(page, "admin@gymnode.test", "GymNode-admin-1");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "SaaS ড্যাশবোর্ড" })).toBeVisible();
  });

  test("new owner signs up, sets up a gym, adds staff; staff logs in by phone", async ({
    page,
    isMobile,
  }) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const staffPhone = randomPhone();

    // Sign up (local Supabase has email confirmation off, so this logs straight in).
    await page.goto("/signup");
    await page.getByLabel("আপনার নাম").fill("নতুন মালিক");
    await page.getByLabel("ইমেইল").fill(`owner-${id}@test.local`);
    await page.getByLabel("পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)").fill("Owner-pass-123");
    await page.getByRole("button", { name: "অ্যাকাউন্ট খুলুন" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);

    // Step 1: gym
    await page.getByLabel("জিমের নাম").fill(`টেস্ট জিম ${id}`);
    await page.getByLabel("মেম্বার আইডির শুরু").fill("tg");
    await page.getByLabel("প্রথম শাখার নাম").fill("মিরপুর শাখা");
    await page.getByRole("button", { name: "জিম তৈরি করুন" }).click();
    await expect(page).toHaveURL(/step=logo/);

    // Step 2: skip logo
    await page.getByRole("link", { name: "এখন নয়" }).click();
    await expect(page).toHaveURL(/step=packages/);

    // Step 3: keep the three suggested packages
    await expect(page.getByLabel("প্যাকেজের নাম").first()).toHaveValue("মাসিক");
    await page.getByRole("button", { name: "সেভ করে এগিয়ে যান" }).click();
    await expect(page).toHaveURL(/step=staff/);

    // Step 4: add a receptionist
    await page.getByLabel("নাম", { exact: true }).fill("রিসেপশন টেস্ট");
    await page.getByLabel("মোবাইল নম্বর").fill(staffPhone);
    await page.getByLabel("প্রথম পাসওয়ার্ড").fill("Temp-pass-123");
    await page.getByRole("button", { name: "অ্যাকাউন্ট খুলুন" }).click();
    await expect(
      page.getByRole("main").getByRole("listitem").filter({ hasText: "রিসেপশন টেস্ট" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "সেটআপ শেষ, ড্যাশবোর্ডে যান" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1, name: "ড্যাশবোর্ড" })).toBeVisible();
    await page.goto("/app/packages");
    await expect(page.getByText("মাসিক").filter({ visible: true }).first()).toBeVisible();
    await page.goto("/app");
    // Tenant isolation in the UI: the seeded gym is not visible to this new owner.
    await expect(page.getByText("পাওয়ার হাউস জিম")).toHaveCount(0);
    await logout(page, isMobile);

    // Staff logs in with the phone number and must set a new password first.
    await login(page, staffPhone, "Temp-pass-123");
    await expect(page).toHaveURL(/\/account\/password$/);
    await page.getByLabel("পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)").fill("Staff-own-456");
    await page.getByLabel("পাসওয়ার্ড আবার লিখুন").fill("Staff-own-456");
    await page.getByRole("button", { name: "পাসওয়ার্ড সেভ করুন" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText(`টেস্ট জিম ${id}`).filter({ visible: true }).first()).toBeVisible();

    // Reception cannot manage staff.
    await page.goto("/app/staff");
    await expect(page.getByText("এই কাজটি করার অনুমতি আপনার নেই")).toBeVisible();
  });
});
