import { expect, test, type Page } from "@playwright/test";
import { login, OWNER, RECEPTION, uid } from "./helpers";

// Needs the local Supabase stack with seed data (pnpm db:reset).

/** The visible table row (desktop) or card (phone) that mentions `text`. */
function rowWith(page: Page, text: string) {
  return page
    .locator("li, [role=row]")
    .filter({ has: page.getByText(text, { exact: true }) })
    .filter({ visible: true })
    .last();
}

test.describe("M5 sales & stock", () => {
  test("owner adds a product and stock (as an expense); reception sells it; receipt lists it", async ({
    page,
    isMobile,
  }) => {
    const name = `টেস্ট শেক ${uid()}`;
    await login(page, ...OWNER);
    await page.goto("/app/sales?tab=stock");
    await page.getByRole("button", { name: "+ পণ্য যোগ করুন" }).click();
    await page.getByLabel("পণ্যের নাম").fill(name);
    await page.getByLabel("বিক্রয় মূল্য (৳)").fill("150");
    await page.getByRole("button", { name: "সেভ করুন" }).click();
    await expect(page.getByText("পণ্য সেভ হয়েছে")).toBeVisible();

    await rowWith(page, name).getByRole("button", { name: "স্টক যোগ" }).click();
    await page.getByLabel("পরিমাণ (পিস)").fill("5");
    await page.getByLabel("প্রতি পিস কেনা দাম (৳)").fill("90");
    await expect(page.getByText("মোট ৳450 আয়-ব্যয়ে যোগ হবে")).toBeVisible();
    await page.getByRole("button", { name: "সেভ করুন" }).click();
    await expect(page.getByText("স্টক যোগ হয়েছে")).toBeVisible();
    await expect(rowWith(page, name).getByText("5", { exact: true })).toBeVisible();

    // The purchase shows up as this month's expense.
    await page.goto("/app/expenses");
    await expect(page.getByText(`${name} × 5`).filter({ visible: true })).toBeVisible();

    // Reception sells two.
    await page.context().clearCookies();
    await login(page, ...RECEPTION);
    await page.goto("/app/sales");
    await page.getByRole("searchbox", { name: "পণ্য খুঁজুন" }).fill(name);
    const product = page.getByRole("button", { name: new RegExp(`^${name}`) });
    await product.click();
    await product.click();
    if (isMobile) await page.getByRole("button", { name: /কার্ট দেখুন · 2/ }).click();
    const cart = page.getByTestId("cart");
    await expect(cart.getByText("৳150 × 2 = ৳300")).toBeVisible();
    await cart.getByRole("button", { name: "বিক্রি নিশ্চিত করুন" }).click();
    await expect(cart.getByText("বিক্রি হয়েছে")).toBeVisible();

    const receiptHref = await cart.getByRole("link", { name: "রিসিট দেখুন" }).getAttribute("href");
    await page.goto(receiptHref!);
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText("× 2 (৳150)")).toBeVisible();
    await expect(page.getByText("৳300").first()).toBeVisible();

    // Stock went down to 3; reception can't change products.
    await page.goto("/app/sales?tab=stock");
    await expect(rowWith(page, name).getByText("3", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ পণ্য যোগ করুন" })).toHaveCount(0);
  });

  test("owner adds and deletes an expense", async ({ page }) => {
    const note = `টেস্ট খরচ ${uid()}`;
    await login(page, ...OWNER);
    await page.goto("/app/expenses");
    await page.getByRole("button", { name: "+ খরচ যোগ করুন" }).click();
    const form = page.getByRole("dialog", { name: "নতুন খরচ" });
    await form.getByLabel("খাত").selectOption({ label: "অন্যান্য" });
    await form.getByLabel("পরিমাণ (৳)").fill("1234");
    await form.getByLabel("নোট (ঐচ্ছিক)").fill(note);
    await form.getByRole("button", { name: "সেভ করুন" }).click();
    await expect(page.getByText("খরচ সেভ হয়েছে")).toBeVisible();
    const row = rowWith(page, note);
    await expect(row.getByText("৳1,234")).toBeVisible();

    await row.getByRole("button", { name: /^মুছে ফেলুন/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "মুছে ফেলুন" }).click();
    await expect(page.getByText("খরচ মুছে ফেলা হয়েছে")).toBeVisible();
    await expect(page.getByText(note).filter({ visible: true })).toHaveCount(0);
  });
});

test.describe("M5 reports", () => {
  test("owner sees the report and downloads Excel", async ({ page }) => {
    await login(page, ...OWNER);
    await page.goto("/app/reports");
    await expect(page.getByRole("heading", { name: "রিপোর্ট" })).toBeVisible();
    await expect(page.getByText("মোট আয়")).toBeVisible();
    await expect(page.getByRole("heading", { name: "মাসিক আয়, ব্যয় ও লাভ" })).toBeVisible();
    await expect(page.getByRole("table", { name: "মাসভিত্তিক আয়, ব্যয় ও লাভ" })).toBeAttached();

    await page.getByRole("link", { name: "এই মাস" }).click();
    await expect(page).toHaveURL(/range=month/);

    const res = await page.request.get("/app/reports/export?range=month");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("spreadsheetml");
    // .xlsx files are zip archives: they start with "PK".
    expect((await res.body()).subarray(0, 2).toString()).toBe("PK");
  });

  test("reception cannot open reports or expenses", async ({ page }) => {
    await login(page, ...RECEPTION);
    await page.goto("/app/reports");
    await expect(page.getByText("এই কাজটি করার অনুমতি আপনার নেই")).toBeVisible();
    await page.goto("/app/expenses");
    await expect(page.getByText("এই কাজটি করার অনুমতি আপনার নেই")).toBeVisible();
    const res = await page.request.get("/app/reports/export");
    expect(res.status()).toBe(403);
  });
});
