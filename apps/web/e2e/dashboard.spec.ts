import { expect, test, type Page } from "@playwright/test";
import { login, OWNER, randomPhone, RECEPTION, TRAINER, uid } from "./helpers";

// Needs the local Supabase stack with seed data (pnpm db:reset), including Realtime.

async function newMember(page: Page, name: string, withPackage: boolean) {
  await page.goto("/app/members/new");
  await page.getByLabel("পুরো নাম").fill(name);
  await page.getByLabel("মোবাইল নম্বর").fill(randomPhone());
  if (!withPackage) await page.getByLabel("এখন প্যাকেজ দেবেন না").check();
  await page
    .getByRole("button", {
      name: withPackage ? "মেম্বার সেভ ও পেমেন্ট নিশ্চিত করুন" : "মেম্বার সেভ করুন",
    })
    .click();
  await expect(page).toHaveURL(/\/app\/members\/[0-9a-f-]{36}$/);
}

test.describe("M4 dashboard", () => {
  test("owner sees money KPIs, the income vs expense chart and payment methods", async ({
    page,
  }) => {
    await login(page, ...OWNER);
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText("আজকের কালেকশন")).toBeVisible();
    await expect(page.getByText("এই মাসের আয়")).toBeVisible();
    await expect(page.getByText("মোট বকেয়া")).toBeVisible();
    await expect(page.getByRole("heading", { name: /আয় বনাম ব্যয়/ })).toBeVisible();
    // Accessible data table behind the chart.
    await expect(page.getByRole("table", { name: "দিনভিত্তিক আয় ও ব্যয়" })).toBeAttached();
    await expect(page.getByRole("heading", { name: "এই মাসে পেমেন্ট মাধ্যম" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "লাইভ চেক-ইন" })).toBeVisible();
  });

  test("reception checks members in from the dashboard; the live feed updates", async ({
    page,
  }) => {
    const paid = `চেকইন টেস্ট ${uid()}`;
    const unpaid = `আনপেইড টেস্ট ${uid()}`;
    await login(page, ...RECEPTION);
    await newMember(page, paid, true);
    await newMember(page, unpaid, false);

    await page.goto("/app");
    const live = page.getByTestId("live-checkins");
    const search = live.getByRole("searchbox");

    await search.fill(paid);
    await live.getByRole("button", { name: "চেক-ইন" }).first().click();
    await expect(page.getByText(`${paid} চেক-ইন হয়েছেন`)).toBeVisible();
    // Arrives through Supabase Realtime (no page reload).
    await expect(
      live.getByRole("listitem").filter({ hasText: paid }).filter({ hasText: "প্রবেশ অনুমোদিত" }),
    ).toBeVisible({
      timeout: 10_000,
    });

    await search.fill(unpaid);
    await live.getByRole("button", { name: "চেক-ইন" }).first().click();
    await expect(page.getByText(new RegExp(`${unpaid}-কে আটকানো হয়েছে`))).toBeVisible();
    await expect(
      live.getByRole("listitem").filter({ hasText: unpaid }).filter({ hasText: "আটকানো" }),
    ).toBeVisible({
      timeout: 10_000,
    });
    // Reception may not override.
    await expect(live.getByRole("button", { name: "তবুও ঢুকতে দিন" })).toHaveCount(0);
  });

  test("trainer sees no money on the dashboard", async ({ page }) => {
    await login(page, ...TRAINER);
    await expect(page.getByText("সক্রিয় মেম্বার")).toBeVisible();
    await expect(page.getByText("আজকের কালেকশন")).toHaveCount(0);
    await expect(page.getByText("মোট বকেয়া")).toHaveCount(0);
  });

  test("profile shows the attendance grid", async ({ page }) => {
    await login(page, ...OWNER);
    await page.goto("/app/members?tab=active");
    await page
      .getByRole("link", { name: /প্রোফাইল খুলুন/ })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page.getByText(/এই মাসে উপস্থিতি/)).toBeVisible();
  });
});
