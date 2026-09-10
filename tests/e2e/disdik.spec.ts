import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  const identifier = process.env.E2E_DISDIK_IDENTIFIER;
  const password = process.env.E2E_DISDIK_PASSWORD;
  if (!identifier || !password) throw new Error("Credential E2E Disdik belum tersedia.");
  await page.goto("/login");
  await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/disdik$/u, { timeout: 15_000 });
}

test.describe.serial("Disdik preview terkontrol", () => {
  test("alur rujukan dapat dimulai, diperbarui, dan diselesaikan", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page);
    await expect(page.getByRole("heading", { name: "Rujukan Masuk & Intervensi" })).toBeVisible();
    await expect(page.getByText("Randi Permana", { exact: true }).first()).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/u);

    const row = page.getByRole("row").filter({ hasText: "REF-EDU-2026-101" });
    await row.getByRole("button", { name: "Proses Intervensi" }).click();
    const start = page.getByRole("dialog", { name: /Proses Intervensi Disdik/u });
    await start.getByLabel("Tanggal Penyaluran Bantuan").fill("2026-09-10");
    await start.getByRole("button", { name: "Simpan & Proses Bantuan" }).click();
    await expect(start).toBeHidden();
    await expect(row.getByText("Sedang Diverifikasi")).toBeVisible();

    await row.getByRole("button", { name: "Update Progress" }).click();
    let progress = page.getByRole("dialog", { name: /Update Progress Intervensi/u });
    await progress.getByLabel("Persentase Progress (%)").fill("75");
    await progress.getByLabel("Realisasi Pagu Bantuan (Rp)").fill("2000000");
    await progress.getByLabel("Catatan Progress Penyaluran Disdik").fill("Dokumen selesai diverifikasi dan bantuan sedang disalurkan ke sekolah.");
    await progress.getByRole("button", { name: "Simpan & Update Progress" }).click();
    await expect(progress).toBeHidden();

    await row.getByRole("button", { name: "Update Progress" }).click();
    progress = page.getByRole("dialog", { name: /Update Progress Intervensi/u });
    await progress.getByLabel("Status Intervensi Baru").selectOption("SELESAI");
    await progress.getByLabel("Realisasi Pagu Bantuan (Rp)").fill("2500000");
    await progress.getByLabel("Tanggal Selesai Intervensi").fill("2026-09-10");
    await progress.getByLabel("Catatan Progress Penyaluran Disdik").fill("Bantuan pendidikan selesai disalurkan dan diterima oleh sekolah.");
    await progress.getByRole("button", { name: "Simpan & Selesaikan Intervensi" }).click();
    await expect(progress).toBeHidden();
    await expect(row.getByText("Terintervensi / Selesai")).toBeVisible();
  });

  test("katalog program dan laporan menampilkan data Disdik", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Program Pendidikan" }).click();
    await expect(page.getByRole("heading", { name: "Katalog Program / Bantuan Pendidikan" })).toBeVisible();
    await expect(page.getByText("Beasiswa Rawan Putus Sekolah (RPS) MBI", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: /Tambah Program/u }).click();
    await expect(page.getByRole("dialog", { name: "Tambah Program / Bantuan Pendidikan Baru" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("link", { name: "Laporan Realisasi" }).click();
    await expect(page.getByRole("heading", { name: "Laporan Pelaksanaan & Realisasi Pendidikan" })).toBeVisible();
    await expect(page.getByText(/4\.200\.000/u).first()).toBeVisible();
    await page.getByRole("button", { name: "Detail" }).first().click();
    await expect(page.getByRole("dialog", { name: /Detail Laporan Realisasi/u })).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/u);
  });

  test("halaman utama Disdik tidak overflow pada mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    for (const url of ["/disdik", "/disdik/program", "/disdik/laporan"]) {
      await page.goto(url);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.content()).not.toMatch(/\b\d{16}\b/u);
    }
  });
});
