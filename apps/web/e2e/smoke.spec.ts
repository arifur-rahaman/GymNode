import { expect, test } from "@playwright/test";

test.describe("M0 smoke", () => {
  test("defaults to Bangla and dark theme", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "bn");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("লগইন করুন");
  });

  test("theme choice is remembered after reload", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect
      .poll(async () => (await page.context().cookies()).find((c) => c.name === "gn_theme")?.value)
      .toBe("light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("language switch to English is remembered", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Log in");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Log in");
  });

  test("component gallery shows both themes and opens the payment sheet", async ({ page }) => {
    await page.goto("/dev/ui");
    const dark = page.getByTestId("gallery-dark");
    await expect(dark).toBeVisible();
    await expect(page.getByTestId("gallery-light")).toBeVisible();

    await dark.getByRole("button", { name: "পেমেন্ট নিন" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("tables become card lists on phones", async ({ page, isMobile }) => {
    await page.goto("/dev/ui");
    const dark = page.getByTestId("gallery-dark");
    const table = dark.getByRole("table");
    const cards = dark.getByRole("list", { name: "টেবিল → মোবাইলে কার্ড" });
    if (isMobile) {
      await expect(table).toBeHidden();
      await expect(cards).toBeVisible();
    } else {
      await expect(table).toBeVisible();
      await expect(cards).toBeHidden();
    }
  });
});
