import { expect, test, type Page } from "@playwright/test";
import { login, OWNER, randomPhone, RECEPTION, uid } from "./helpers";

// Needs the local Supabase stack with seed data (pnpm db:reset).

async function openPanel(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole("button", { name: "পেমেন্ট নিন" }).click();
  return page.getByTestId("take-payment");
}

async function pickMember(panel: ReturnType<Page["getByTestId"]>, query: string) {
  await panel.getByRole("searchbox").fill(query);
  await panel
    .getByRole("button", { name: new RegExp(query) })
    .first()
    .click();
}

test.describe("M3 payments & dues", () => {
  test("reception renews a member in cash and opens the receipt", async ({
    page,
    isMobile,
  }, testInfo) => {
    await login(page, ...RECEPTION);
    await page.goto("/app/payments");
    await expect(page.getByText("আজকের কালেকশন")).toBeVisible();

    const panel = await openPanel(page, isMobile);
    await pickMember(panel, testInfo.project.name === "mobile" ? "PH-0005" : "PH-0002");
    await panel.getByRole("button", { name: "পেমেন্ট নিশ্চিত করুন" }).click();
    await expect(panel.getByText("পেমেন্ট হয়েছে")).toBeVisible();
    await expect(panel.getByText(/INV-\d{4}-\d{5}/)).toBeVisible();

    const receiptHref = await panel.getByRole("link", { name: "রিসিট দেখুন" }).getAttribute("href");
    await page.context().clearCookies();
    await page.goto(receiptHref!);
    await expect(page.getByRole("heading", { name: "পেমেন্ট রিসিট" })).toBeVisible();
    await expect(page.getByText(/INV-\d{4}-\d{5}/)).toBeVisible();
    await expect(page.getByText("সম্পন্ন")).toBeVisible();
  });

  test("dues list → pay the due only", async ({ page }) => {
    // Own member with a part payment, so parallel runs never fight over the same due.
    const name = `বকেয়া টেস্ট ${uid()}`;
    await login(page, ...RECEPTION);
    await page.goto("/app/members/new");
    await page.getByLabel("পুরো নাম").fill(name);
    await page.getByLabel("মোবাইল নম্বর").fill(randomPhone());
    await expect(page.getByText("৳2,500")).toBeVisible();
    await page.getByLabel("পরিমাণ (৳)").fill("1000");
    await page.getByRole("button", { name: "মেম্বার সেভ ও পেমেন্ট নিশ্চিত করুন" }).click();
    await expect(page).toHaveURL(/\/app\/members\/[0-9a-f-]{36}$/);

    await page.goto("/app/payments?view=dues");
    const row = page.getByText(name).filter({ visible: true }).first();
    await expect(row).toBeVisible();
    const container = page
      .locator("li, [role=row]")
      .filter({ has: page.getByText(name) })
      .filter({ visible: true })
      .first();
    await container.getByRole("link", { name: "বকেয়া পরিশোধ" }).click();
    await expect(page).toHaveURL(/member=/);
    const panel = page.getByTestId("take-payment");
    await expect(panel.getByText("বর্তমান বকেয়া ৳1,500")).toBeVisible();
    await panel.getByRole("button", { name: "পেমেন্ট নিশ্চিত করুন" }).click();
    await expect(panel.getByText("পেমেন্ট হয়েছে")).toBeVisible();
  });

  test("reception takes a bKash payment and cancels it; cannot verify", async ({
    page,
    isMobile,
  }) => {
    await login(page, ...RECEPTION);
    await page.goto("/app/payments");
    const panel = await openPanel(page, isMobile);
    await pickMember(panel, isMobile ? "PH-0006" : "PH-0003");
    await panel.getByRole("radio", { name: "বিকাশ" }).click();
    await panel.getByLabel(/ট্রানজেকশন আইডি/).fill(`X${uid()}`.slice(0, 12).toUpperCase());
    await panel.getByRole("button", { name: "পেমেন্ট নিশ্চিত করুন" }).click();
    await expect(panel.getByText("পেমেন্ট হয়েছে")).toBeVisible();
    if (isMobile) await page.keyboard.press("Escape");

    await page.goto("/app/payments?view=pending");
    await expect(page.getByRole("button", { name: "যাচাই করুন" })).toHaveCount(0);
    const cancel = page
      .getByRole("button", { name: /^বাতিল করুন: .*PH-0003|^বাতিল করুন:/ })
      .filter({ visible: true })
      .last();
    await cancel.click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("কারণ").fill("ভুল ট্রানজেকশন আইডি");
    await sheet.getByRole("button", { name: "বাতিল করুন" }).click();
    await expect(sheet).toBeHidden();
  });

  test("owner verifies a pending bKash payment", async ({ page }, testInfo) => {
    // Only one project verifies, so the before/after count is not disturbed by the other run.
    test.skip(testInfo.project.name === "mobile", "shared data; covered on desktop");
    await login(page, ...OWNER);
    await page.goto("/app/payments?view=pending");
    // Verify one specific payment and check that payment's own receipt (other tests run in parallel).
    const row = page
      .locator("li, [role=row]")
      .filter({ has: page.getByRole("button", { name: "যাচাই করুন" }) })
      .filter({ visible: true })
      .first();
    const receiptHref = await row.getByRole("link", { name: /^রিসিট/ }).getAttribute("href");
    await row.getByRole("button", { name: "যাচাই করুন" }).click();
    await expect(page.getByText("পেমেন্ট যাচাই হয়েছে")).toBeVisible();
    await page.goto(receiptHref!);
    await expect(page.getByText("সম্পন্ন")).toBeVisible();
  });
});
