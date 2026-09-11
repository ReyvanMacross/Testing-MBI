import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

type Fixture = {
  officers: Record<string, { id: string; nama: string }>;
  programs: Record<string, { id: string; nama_program: string }>;
  referrals: Record<string, { referralId: string; referralCode: string }>;
};

const artifactDir = path.join(process.cwd(), "artifacts", "dkpp");
const fixtureStateFile = path.join(artifactDir, "fixture-state.json");
let fixture: Fixture;
let fixtureSeeded = false;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

async function login(page: Page) {
  const identifier = process.env.E2E_DKPP_IDENTIFIER || process.env.DKPP_ADMIN_USERNAME || "admin.dkpp";
  const password = process.env.E2E_DKPP_PASSWORD || process.env.DKPP_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD;
  if (!identifier || !password) throw new Error("Credential E2E Dkpp belum tersedia.");
  await page.goto("/login");
  await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dkpp$/, { timeout: 15_000 });
}

function rowFor(page: Page, code: string) {
  return page.getByRole("row").filter({ hasText: code });
}

test.describe.serial("Dkpp real database workflow", () => {
  test.beforeAll(() => {
    mkdirSync(artifactDir, { recursive: true });
    execFileSync(process.execPath, ["scripts/dev/seed-dkpp-fixtures.mjs"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
    fixture = JSON.parse(readFileSync(fixtureStateFile, "utf8"));
    fixtureSeeded = true;
  });

  test.afterAll(() => {
    if (!fixtureSeeded) return;
    execFileSync(process.execPath, ["scripts/dev/cleanup-dkpp-fixtures.mjs"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
  });

  test("admin starts, updates, and completes a food-resilience intervention", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 900 });
    await login(page);
    await expect(page.getByRole("heading", { name: "Rujukan Masuk & Intervensi" })).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/);

    const primaryRow = rowFor(page, fixture.referrals.primary.referralCode);
    await primaryRow.getByRole("button", { name: "Proses Intervensi" }).click();
    const startDialog = page.getByRole("dialog", { name: /Proses Intervensi Pangan/ });
    await startDialog.getByLabel("Nama Kelompok / Keluarga").fill("KWT Pangan E2E");
    await startDialog.getByLabel("Lokasi Unit / Demplot").fill("Demplot E2E Sukajadi");
    await startDialog.getByLabel("Kategori Pangan").selectOption({ label: "Urban Farming" });
    await startDialog.getByLabel("Program Buruan SAE").selectOption(fixture.programs["DEV-PRG-SAE-01"].id);
    await startDialog.getByLabel("Penyuluh DKPP").selectOption(fixture.officers["DEV-PPL-01"].id);
    await startDialog.getByLabel("Tanggal Pelaksanaan").fill(today);
    await startDialog.getByLabel("Catatan Rencana Pendampingan").fill("Rencana pendampingan pangan untuk pengujian E2E terkontrol.");
    await startDialog.getByRole("button", { name: "Simpan & Mulai Pendampingan" }).click();
    await expect(startDialog).toBeHidden();
    await expect(primaryRow.getByText("Sedang Didampingi")).toBeVisible();

    await primaryRow.getByRole("button", { name: "Update Progress" }).click();
    let progressDialog = page.getByRole("dialog", { name: /Update Progress Intervensi/ });
    await progressDialog.getByLabel("Persentase Progress Pendampingan (%)").fill("75");
    await progressDialog.getByLabel("Status Hasil Pangan").selectOption("HASIL_MENCUKUPI");
    await progressDialog.getByLabel("Catatan Evaluasi Pendamping").fill("Peserta sedang mengikuti pendampingan budidaya melalui E2E.");
    await progressDialog.getByRole("button", { name: "Simpan Progress" }).click();
    await expect(progressDialog).toBeHidden();

    await primaryRow.getByRole("button", { name: "Update Progress" }).click();
    progressDialog = page.getByRole("dialog", { name: /Update Progress Intervensi/ });
    await progressDialog.getByLabel("Status Intervensi Baru").selectOption("MANDIRI_SELESAI");
    await progressDialog.getByLabel("Capaian Nilai Panen (Rp)").fill("4500000");
    await progressDialog.getByLabel("Tanggal Selesai Pendampingan").fill(today);
    await progressDialog.getByLabel("Catatan Evaluasi Pendamping").fill("Hasil panen memenuhi kebutuhan keluarga dan siap dipasarkan.");
    await progressDialog.getByRole("button", { name: "Simpan & Selesaikan Pendampingan" }).click();
    await expect(progressDialog).toBeHidden();
    await expect(primaryRow.getByText("Mandiri / Selesai")).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/);
  });

  test("program catalog and harvest report use database records", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Program Buruan SAE" }).click();
    await expect(page.getByRole("heading", { name: "Katalog Program Buruan SAE" })).toBeVisible();
    await expect(page.getByText("Pelatihan Urban Farming Development", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: /Tambah Program/ }).click();
    await expect(page.getByRole("dialog", { name: "Tambah Program / Bantuan Baru" }).getByLabel("Penyuluh DKPP")).toContainText("Penyuluh Buruan SAE Development");
    await page.keyboard.press("Escape");

    await page.getByRole("link", { name: "Laporan Ketahanan Pangan" }).click();
    await expect(page.getByRole("heading", { name: "Laporan Ketahanan Pangan & Usaha Agro" })).toBeVisible();
    await expect(page.getByText(/4\.500\.000/).first()).toBeVisible();
    await rowFor(page, fixture.referrals.primary.referralCode).getByRole("button", { name: "Detail" }).click();
    const report = page.getByRole("dialog", { name: /Detail Rekap Ketahanan Pangan/ });
    await expect(report.getByText(fixture.referrals.primary.referralCode)).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/);
  });

  test("primary Dkpp screens have no mobile horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    for (const url of ["/dkpp", "/dkpp/program", "/dkpp/laporan"]) {
      await page.goto(url);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.content()).not.toMatch(/\b\d{16}\b/);
    }
  });
});
