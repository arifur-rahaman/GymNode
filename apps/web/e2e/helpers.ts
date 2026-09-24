import { expect, type Page } from "@playwright/test";

export async function login(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("ইমেইল বা মোবাইল নম্বর").fill(identifier);
  await page.getByLabel("পাসওয়ার্ড", { exact: true }).fill(password);
  await page.getByRole("button", { name: "লগইন", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export const OWNER = ["owner@gymnode.test", "GymNode-owner-1"] as const;
export const RECEPTION = ["01722222222", "GymNode-staff-1"] as const;
export const TRAINER = ["01733333333", "GymNode-staff-1"] as const;

export function randomPhone() {
  return `019${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
