import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  const identifier = process.env.E2E_WALIKOTA_IDENTIFIER ?? process.env.WALIKOTA_ADMIN_USERNAME ?? "admin.walikota";
  const password = process.env.E2E_WALIKOTA_PASSWORD ?? process.env.WALIKOTA_ADMIN_PASSWORD ?? process.env.SUPABASE_TEST_ADMIN_PASSWORD;
  if (!password) throw new Error("Credential E2E Wali Kota belum tersedia.");
  await page.goto("/login");
  await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/walikota$/u, { timeout: 15_000 });
}

test.describe("Wali Kota executive workspace", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => {
    execFileSync(process.execPath, ["scripts/dev/seed-bapperida-demo.mjs"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
    execFileSync(process.execPath, ["scripts/dev/seed-walikota-demo.mjs"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
    execFileSync(process.execPath, ["scripts/dev/seed-walikota-fixtures.mjs"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
  });
  test.afterAll(() => {
    execFileSync(process.execPath, ["scripts/dev/cleanup-walikota-fixtures.mjs"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
  });

  test("dashboard, shared map, recommendation decision, disposition history, and mobile layout", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "Dashboard Eksekutif" })).toBeVisible();
    await expect(page.getByText("Warga Mandiri", { exact: true })).toBeVisible();
    await expect(page.getByText("OPD Aktif", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Peta desil Kota Bandung" })).toBeVisible();

    await page.goto("/walikota?kecamatan=Coblong");
    await expect(page.getByText("Kecamatan terpilih")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Coblong", exact: true })).toBeVisible();

    await page.goto("/walikota/rekomendasi");
    await expect(page.getByRole("heading", { name: "Rekomendasi Strategis", exact: true }).first()).toBeVisible();
    const fixtureCard = page.getByText("DEV-WK-REC-01").locator("xpath=ancestor::article");
    await expect(fixtureCard).toBeVisible();
    await fixtureCard.getByRole("button", { name: "Beri Keputusan" }).click();
    const dialog = page.getByRole("dialog", { name: /Tinjau DEV-WK-REC-01/u });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Catatan Pimpinan").fill("Setujui fokus wilayah dan pantau hasil koordinasi setiap pekan.");
    for (const checkbox of await dialog.getByRole("checkbox").all()) if (await checkbox.isChecked()) await checkbox.uncheck();
    await dialog.getByRole("button", { name: "Setujui Rekomendasi" }).click();
    await expect(dialog.getByText(/disetujui/u)).toBeVisible();

    await page.goto("/walikota/keputusan");
    await expect(page.getByRole("heading", { name: "Keputusan & Disposisi" })).toBeVisible();
    await expect(page.getByText("Setujui fokus wilayah dan pantau hasil koordinasi setiap pekan.")).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/u);

    await page.setViewportSize({ width: 390, height: 844 });
    for (const url of ["/walikota", "/walikota/rekomendasi", "/walikota/keputusan"]) {
      await page.goto(url);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), url).toBeLessThanOrEqual(1);
    }
  });
});
