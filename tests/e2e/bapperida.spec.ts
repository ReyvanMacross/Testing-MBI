import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  const identifier =
    process.env.E2E_BAPPERIDA_IDENTIFIER ??
    process.env.BAPPERIDA_ADMIN_USERNAME ??
    "admin.bapperida";
  const password =
    process.env.E2E_BAPPERIDA_PASSWORD ??
    process.env.BAPPERIDA_ADMIN_PASSWORD ??
    process.env.SUPABASE_TEST_ADMIN_PASSWORD;

  if (!password) throw new Error("Credential E2E Bapperida belum tersedia.");

  await page.goto("/login");
  await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/bapperida$/u, { timeout: 15_000 });
}

test.describe("Bapperida coordination workspace", () => {
  test.beforeAll(() => {
    execFileSync(process.execPath, ["scripts/dev/seed-bapperida-demo.mjs"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe",
    });
  });

  test("dashboard, reports, recommendations, map drill-down, and mobile layout", async ({ page }) => {
    await login(page);

    await expect(page.getByRole("heading", { name: "Dashboard Outcome" })).toBeVisible();
    await expect(page.getByText("1.847", { exact: true })).toBeVisible();
    await expect(page.getByText("68%", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Peta desil Kota Bandung" })).toBeVisible();

    await page.goto("/bapperida?kecamatan=Coblong");
    await expect(page).toHaveURL(/kecamatan=Coblong/iu);
    await expect(page.getByText("Kecamatan terpilih")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Coblong", exact: true })).toBeVisible();

    await page.goto("/bapperida/laporan");
    await expect(page.getByRole("heading", { name: "Laporan Evaluasi", exact: true })).toBeVisible();
    await expect(page.getByText("1.847", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Lihat laporan Desember 2026/iu }).click();
    await expect(page.getByRole("dialog", { name: /Laporan Evaluasi/iu })).toBeVisible();
    await page.getByRole("button", { name: "Tutup" }).last().click();

    await page.goto("/bapperida/rekomendasi");
    await expect(page.getByRole("heading", { name: "Rekomendasi Kebijakan" })).toBeVisible();
    await expect(page.getByText(/Capaian Akselerasi Sektoral hanya 8%/u)).toBeVisible();
    await page.getByRole("button", { name: /Buat Rekomendasi Baru/u }).click();
    await expect(page.getByText("Rekomendasi Baru", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ajukan ke Wali Kota" })).toBeVisible();

    expect(await page.content()).not.toMatch(/\b\d{16}\b/u);

    await page.setViewportSize({ width: 390, height: 844 });
    for (const url of ["/bapperida", "/bapperida/laporan", "/bapperida/rekomendasi"]) {
      await page.goto(url);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
    }
  });
});
