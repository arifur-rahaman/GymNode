import { expect, test, type Page } from "@playwright/test";
import { login, OWNER, RECEPTION, uid } from "./helpers";

// Needs the local Supabase stack with seed data (pnpm db:reset).
const ADMIN = ["admin@gymnode.test", "GymNode-admin-1"] as const;
const SUPPORT = ["support@gymnode.test", "GymNode-admin-1"] as const;

async function openGym(page: Page, name: string) {
  await page.goto(`/admin/gyms?q=${encodeURIComponent(name)}`);
  await page
    .getByRole("link", { name: new RegExp(name) })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test.describe("M7 super admin", () => {
  test("dashboard, gyms list with filters, plans and billing load", async ({ page }) => {
    await login(page, ...ADMIN);
    await expect(page.getByText("মোট জিম")).toBeVisible();
    await expect(page.getByText("মাসিক রেকারিং আয় (MRR) · ১২ মাস")).toBeVisible();
    await expect(page.getByRole("table", { name: "মাসভিত্তিক সাবস্ক্রিপশন বিল" })).toBeAttached();

    await page.goto("/admin/gyms");
    await page
      .getByRole("link", { name: /ট্রায়াল/ })
      .first()
      .click();
    await expect(page).toHaveURL(/status=trial/);
    await expect(page.getByText("আয়রন প্যারাডাইস").filter({ visible: true })).toBeVisible();
    await expect(page.getByText("গোল্ডেন জিম").filter({ visible: true })).toHaveCount(0);

    await page.goto("/admin/plans");
    await expect(page.getByRole("heading", { name: "গ্রোথ" })).toBeVisible();
    await page.goto("/admin/billing?status=overdue");
    await expect(page.getByText("মাসল ফ্যাক্টরি").filter({ visible: true }).first()).toBeVisible();
  });

  test("support mode: read-only view of a gym, audited, can be ended", async ({ page }) => {
    await login(page, ...ADMIN);
    await openGym(page, "পাওয়ার হাউস জিম");
    await page.getByRole("button", { name: "সাপোর্ট মোডে দেখুন" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("কেন দেখছেন").fill("মালিক রিপোর্ট নিয়ে ফোন করেছেন");
    await dialog.getByRole("button", { name: "সাপোর্ট মোডে দেখুন" }).click();

    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText(/সাপোর্ট মোড — শুধু দেখার জন্য/)).toBeVisible();
    await expect(page.getByText("আজকের কালেকশন")).toBeVisible();

    // Writes are refused by the database.
    await page.goto("/app/packages");
    await page
      .getByRole("button", { name: /নতুন প্যাকেজ/ })
      .first()
      .click();
    const form = page.getByRole("dialog");
    await form.getByLabel("প্যাকেজের নাম").fill(`সাপোর্ট ${uid()}`);
    await form.getByRole("button", { name: /সেভ/ }).click();
    await expect(form.getByText("এই কাজটি করার অনুমতি আপনার নেই")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "সাপোর্ট মোড বন্ধ করুন" }).click();
    await expect(page).toHaveURL(/\/admin\/gyms\/[0-9a-f-]{36}$/);
    await expect(page.getByText("সাপোর্ট মোড চালু").first()).toBeVisible();
    await page.goto("/app");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("super admin records an invoice payment; support team can't change billing", async ({
    page,
    browser,
  }) => {
    const note = `e2e ${uid()}`;
    await login(page, ...ADMIN);
    await openGym(page, "বডি শেপ জিম");
    await page.getByLabel("পরিমাণ (৳)").fill("1500");
    await page.getByLabel("মাস", { exact: true }).fill("");
    await page.getByLabel("নোট (ঐচ্ছিক)").fill(note);
    await page.getByRole("button", { name: "ইনভয়েস তৈরি করুন" }).click();
    await expect(page.getByText("ইনভয়েস তৈরি হয়েছে")).toBeVisible();

    const row = page.locator("li").filter({ hasText: "অপরিশোধিত" }).first();
    await row.getByRole("button", { name: "পরিশোধিত" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("ট্রানজেকশন আইডি").fill(`TX${uid()}`.slice(0, 12).toUpperCase());
    await dialog.getByRole("button", { name: "পরিশোধিত" }).click();
    await expect(page.getByText("ইনভয়েস পরিশোধিত হয়েছে")).toBeVisible();

    const ctx = await browser.newContext();
    const support = await ctx.newPage();
    await login(support, ...SUPPORT);
    await openGym(support, "বডি শেপ জিম");
    await expect(
      support.getByText("প্ল্যান, বিল ও স্ট্যাটাস বদলাতে পারেন শুধু সুপার অ্যাডমিন।"),
    ).toBeVisible();
    await expect(support.getByRole("button", { name: "ইনভয়েস তৈরি করুন" })).toHaveCount(0);
    await support.goto("/admin/settings");
    await expect(support).toHaveURL(/\/admin$/);
    await ctx.close();
  });

  test("gym owner opens a support ticket; the team replies", async ({ page, browser }) => {
    const subject = `টেস্ট টিকেট ${uid()}`;
    await login(page, ...OWNER);
    await page.goto("/app/settings?tab=support");
    await page.getByLabel("বিষয়").fill(subject);
    await page.getByLabel("বিস্তারিত").fill("রিসিট প্রিন্ট হচ্ছে না");
    await page.getByRole("button", { name: "পাঠান" }).click();
    await expect(page).toHaveURL(/ticket=/);
    await expect(page.getByText("রিসিট প্রিন্ট হচ্ছে না")).toBeVisible();

    const ctx = await browser.newContext();
    const team = await ctx.newPage();
    await login(team, ...SUPPORT);
    await team.goto("/admin/support");
    await team.getByRole("link", { name: subject }).filter({ visible: true }).first().click();
    await team.getByLabel("উত্তর লিখুন").fill("ব্রাউজারের প্রিন্ট সেটিং দেখুন");
    await team.getByRole("button", { name: "পাঠান" }).click();
    await expect(team.getByText("ব্রাউজারের প্রিন্ট সেটিং দেখুন")).toBeVisible();
    await ctx.close();

    await page.reload();
    await expect(page.getByText("ব্রাউজারের প্রিন্ট সেটিং দেখুন")).toBeVisible();
    await expect(page.getByText("উত্তর দেওয়া হয়েছে").first()).toBeVisible();
  });

  test("owner sees plan usage; reception can't open settings", async ({ page }) => {
    await login(page, ...OWNER);
    await page.goto("/app/settings?tab=plan");
    await expect(page.getByText("আপনার প্ল্যান")).toBeVisible();
    await expect(page.getByText(/\/ 500/)).toBeVisible();
    await page.context().clearCookies();
    await login(page, ...RECEPTION);
    await page.goto("/app/settings");
    await expect(page.getByText("এই কাজটি করার অনুমতি আপনার নেই")).toBeVisible();
  });
});
