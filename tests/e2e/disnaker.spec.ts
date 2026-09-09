import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const artifactDir = path.join(process.cwd(), "artifacts", "disnaker");

async function login(page: import("@playwright/test").Page) {
  const identifier = process.env.DISNAKER_ADMIN_USERNAME;
  const password = process.env.DISNAKER_ADMIN_PASSWORD;
  if (!identifier || !password) throw new Error("Credential E2E Disnaker belum tersedia.");
  await page.goto("/login");
  await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/disnaker$/);
}

test.describe.serial("Disnaker MVP", () => {
  test.beforeAll(() => mkdirSync(artifactDir, { recursive: true }));

  test("referral, program, and placement workflows render without citizen PII", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1024 });
    await login(page);
    await expect(page.getByRole("heading", { name: "Rujukan Masuk & Intervensi" })).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/);
    await page.screenshot({ path: path.join(artifactDir, "01-referral-desktop.png"), fullPage: true });

    await page.getByRole("button", { name: "Proses Intervensi" }).first().click();
    const processDialog = page.getByRole("dialog", { name: /Proses Intervensi Vokasi/ });
    await expect(processDialog).toBeVisible();
    await expect(processDialog).toHaveAttribute("aria-modal", "true");
    await page.keyboard.press("Escape");
    await expect(processDialog).toBeHidden();

    await page.getByRole("button", { name: "Update Progress" }).first().click();
    await expect(page.getByRole("dialog", { name: /Update Progress Intervensi/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Detail", exact: true }).first().click();
    await expect(page.getByRole("dialog", { name: /Detail Intervensi Warga/ })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("link", { name: "Program Pelatihan" }).click();
    await expect(page.getByRole("heading", { name: "Katalog Program Pelatihan Vokasi" })).toBeVisible();
    await page.getByRole("button", { name: /Tambah Program/ }).click();
    await expect(page.getByRole("dialog", { name: "Tambah Program Pelatihan Baru" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Kelola Kelas" }).first().click();
    await expect(page.getByRole("dialog", { name: /Kelola Kelas/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.screenshot({ path: path.join(artifactDir, "02-program-desktop.png"), fullPage: true });

    await page.getByRole("link", { name: "Laporan Penempatan" }).click();
    await expect(page.getByRole("heading", { name: "Laporan Penempatan Kerja MBI" })).toBeVisible();
    await page.getByRole("button", { name: "Detail Penempatan" }).first().click();
    await expect(page.getByRole("dialog", { name: /Detail Penempatan Kerja/ })).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/);
    await page.keyboard.press("Escape");
    await page.screenshot({ path: path.join(artifactDir, "03-laporan-desktop.png"), fullPage: true });
  });

  test("primary Disnaker screens have no mobile horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    for (const [name, url] of [["referral", "/disnaker"], ["program", "/disnaker/program"], ["laporan", "/disnaker/laporan"]] as const) {
      await page.goto(url);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${name} overflow`).toBeLessThanOrEqual(1);
      expect(await page.content()).not.toMatch(/\b\d{16}\b/);
      await page.screenshot({ path: path.join(artifactDir, `${name}-390.png`), fullPage: true });
    }
  });
});
