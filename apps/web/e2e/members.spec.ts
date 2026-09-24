import { expect, test } from "@playwright/test";
import { login, OWNER, randomPhone, RECEPTION, TRAINER, uid } from "./helpers";

// Needs the local Supabase stack with seed data (pnpm db:reset).

test.describe("M2 members & packages", () => {
  test("member list: counts, search and status tab", async ({ page }) => {
    await login(page, ...OWNER);
    await page.goto("/app/members");
    await expect(page.getByRole("heading", { level: 1, name: "মেম্বার" })).toBeVisible();
    await expect(page.getByText(/মোট \d+ · সক্রিয় \d+/)).toBeVisible();

    await page.getByLabel("মেম্বার খুঁজুন").fill("PH-0001");
    await expect(page).toHaveURL(/q=PH-0001/);
    await expect(page.getByText("PH-0001").filter({ visible: true }).first()).toBeVisible();

    await page.getByLabel("মেম্বার খুঁজুন").fill("");
    await page.getByRole("radio", { name: /বকেয়া/ }).click();
    await expect(page).toHaveURL(/tab=due/);
    await expect(page.getByText("সক্রিয়", { exact: true }).filter({ visible: true })).toHaveCount(
      0,
    );
  });

  test("reception adds a member with payment, renews by bKash, freezes and unfreezes", async ({
    page,
  }) => {
    const name = `টেস্ট মেম্বার ${uid()}`;
    await login(page, ...RECEPTION);
    await page.goto("/app/members/new");
    await page.getByLabel("পুরো নাম").fill(name);
    await page.getByLabel("মোবাইল নম্বর").fill(randomPhone());
    await page.getByLabel("লিঙ্গ").selectOption("male");
    // Default package (মাসিক ৳1,500 + admission ৳1,000) is prefilled with the full amount.
    await expect(page.getByText("৳2,500")).toBeVisible();
    await page.getByRole("button", { name: "মেম্বার সেভ ও পেমেন্ট নিশ্চিত করুন" }).click();

    await expect(page).toHaveURL(/\/app\/members\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("সক্রিয়", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/PH-\d{4}/).first()).toBeVisible();

    // Renew by bKash: needs a transaction ID.
    await page.getByRole("button", { name: "পেমেন্ট নিন ও রিনিউ" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("radio", { name: "বিকাশ" }).click();
    await sheet.getByRole("button", { name: "পেমেন্ট নিশ্চিত করুন" }).click();
    await expect(sheet.getByText("বিকাশ/নগদ/রকেটের ট্রানজেকশন আইডি দিন")).toBeVisible();
    await sheet.getByLabel(/ট্রানজেকশন আইডি/).fill(`T${uid()}`.slice(0, 12).toUpperCase());
    await sheet.getByRole("button", { name: "পেমেন্ট নিশ্চিত করুন" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText("যাচাই বাকি").first()).toBeVisible();

    // Freeze for a week, then unfreeze.
    await page.getByRole("button", { name: "ফ্রিজ করুন" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ফ্রিজ করুন" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("ফ্রিজ", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "ফ্রিজ তুলে নিন" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ফ্রিজ তুলে নিন" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("button", { name: "ফ্রিজ করুন" })).toBeVisible();
  });

  test("QR sign-up appears for approval and gets a member code", async ({ page, browser }) => {
    const name = `কিউআর সদস্য ${uid()}`;
    // Find the gym's public link as the owner.
    await login(page, ...OWNER);
    await page.goto("/app/members");
    await page.getByRole("button", { name: "QR ভর্তি লিংক" }).click();
    const link = (await page
      .getByRole("dialog")
      .getByText(/\/join\//)
      .textContent())!.trim();
    await page.keyboard.press("Escape");

    // A visitor (not logged in) fills in the form.
    const visitor = await browser.newPage();
    await visitor.goto(new URL(link).pathname);
    await visitor.getByLabel("পুরো নাম").fill(name);
    await visitor.getByLabel("মোবাইল নম্বর").fill(randomPhone());
    await visitor.getByRole("button", { name: "আবেদন পাঠান" }).click();
    await expect(visitor.getByText("আবেদন পাঠানো হয়েছে")).toBeVisible();
    await visitor.close();

    await page.goto("/app/members?tab=pending");
    const row = page.getByRole("listitem").filter({ hasText: name });
    await row.getByRole("button", { name: "অনুমোদন দিন" }).click();
    await expect(row).toHaveCount(0);
    await page.goto(`/app/members?q=${encodeURIComponent(name)}`);
    await expect(
      page
        .getByText(/PH-\d{4}/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
  });

  test("packages: owner edits, reception is read-only", async ({ page }) => {
    const pkg = `টেস্ট প্যাকেজ ${uid()}`;
    await login(page, ...OWNER);
    await page.goto("/app/packages");
    await page.getByRole("button", { name: "+ নতুন প্যাকেজ" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("প্যাকেজের নাম").fill(pkg);
    await sheet.getByLabel("দাম (৳)").fill("2000");
    await sheet.getByRole("button", { name: "সেভ করুন" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText(pkg).filter({ visible: true }).first()).toBeVisible();
  });

  test("reception cannot edit packages; trainer sees only assigned members with masked phones", async ({
    page,
  }) => {
    await login(page, ...RECEPTION);
    await page.goto("/app/packages");
    await expect(page.getByText("প্যাকেজ বদলাতে পারবেন শুধু মালিক ও ম্যানেজার।")).toBeVisible();
    await expect(page.getByRole("button", { name: "+ নতুন প্যাকেজ" })).toHaveCount(0);

    await page.context().clearCookies();
    await login(page, ...TRAINER);
    await page.goto("/app/members");
    await expect(page.getByText(/মোট \d+/)).toBeVisible();
    const summary = await page.getByText(/মোট \d+/).textContent();
    expect(Number(summary!.match(/মোট (\d+)/)![1])).toBeLessThan(20);
    await expect(
      page
        .getByText(/01\d•• •••\d{3}/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "+ নতুন মেম্বার" })).toHaveCount(0);
  });

  test("Excel export downloads a CSV with Bangla", async ({ page }) => {
    await login(page, ...OWNER);
    const res = await page.request.get("/app/members/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const body = await res.text();
    expect(body.charCodeAt(0)).toBe(0xfeff);
    expect(body).toContain('"PH-0001"');
    expect(body.split("\r\n").length).toBeGreaterThan(10);
  });
});
