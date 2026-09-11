import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

type Fixture = {
  officers: Record<string, { id: string; nama: string }>;
  programs: Record<string, { id: string; nama_program: string }>;
  referrals: Record<string, { referralId: string; referralCode: string }>;
};

const artifactDir = path.join(process.cwd(), "artifacts", "cipta-bintar");
const fixtureStateFile = path.join(artifactDir, "fixture-state.json");
let fixture: Fixture;
let fixtureSeeded = false;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

async function login(page: Page) {
  const identifier = process.env.E2E_CIPTA_BINTAR_IDENTIFIER || process.env.CIPTA_BINTAR_ADMIN_USERNAME || "admin.cipta-bintar";
  const password = process.env.E2E_CIPTA_BINTAR_PASSWORD || process.env.CIPTA_BINTAR_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD;
  if (!identifier || !password) throw new Error("Credential E2E CiptaBintar belum tersedia.");
  await page.goto("/login");
  await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/cipta-bintar$/, { timeout: 15_000 });
}

function rowFor(page: Page, code: string) {
  return page.getByRole("row").filter({ hasText: code });
}

test.describe.serial("CiptaBintar real database workflow", () => {
  test.beforeAll(() => {
    mkdirSync(artifactDir, { recursive: true });
    execFileSync(process.execPath, ["scripts/dev/seed-cipta-bintar-fixtures.mjs"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
    fixture = JSON.parse(readFileSync(fixtureStateFile, "utf8"));
    fixtureSeeded = true;
  });

  test.afterAll(() => {
    if (!fixtureSeeded) return;
    execFileSync(process.execPath, ["scripts/dev/cleanup-cipta-bintar-fixtures.mjs"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
  });

  test("admin starts, updates, and completes an infrastructure intervention", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 900 });
    await login(page);
    await expect(page.getByRole("heading", { name: "Rujukan Masuk & Intervensi" })).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/);

    const primaryRow = rowFor(page, fixture.referrals.primary.referralCode);
    await primaryRow.getByRole("button", { name: "Proses Intervensi" }).click();
    const startDialog = page.getByRole("dialog", { name: /Proses Intervensi Cipta Bintar/ });
    await startDialog.getByLabel("Jenis Program Intervensi Cipta Bintar").selectOption({ label: "Rehabilitasi Rutilahu" });
    await startDialog.getByLabel("Program Rehabilitasi Target").selectOption(fixture.programs["DEV-PRG-INF-01"].id);
    await startDialog.getByLabel("Alokasi Pagu Anggaran Rehabilitasi").fill("25000000");
    await startDialog.getByLabel("Tanggal Mulai Pengerjaan Fisik").fill(today);
    await startDialog.getByLabel("Rencana Rincian Perbaikan & Catatan Verifikasi Lapangan").fill("Perbaikan atap, dinding, dan sanitasi rumah melalui pengujian E2E terkontrol.");
    await startDialog.getByRole("button", { name: "Simpan & Mulai Pengerjaan Fisik" }).click();
    await expect(startDialog).toBeHidden();
    await expect(primaryRow.getByText("Sedang Rehabilitasi")).toBeVisible();

    await primaryRow.getByRole("button", { name: "Update Progress" }).click();
    let progressDialog = page.getByRole("dialog", { name: /Update Progress Intervensi/ });
    await progressDialog.getByLabel("Progres Fisik Bangunan (%)").fill("75");
    await progressDialog.getByLabel("Catatan Evaluasi & Lapangan").fill("Perbaikan atap dan pasangan dinding telah mencapai 75 persen melalui E2E.");
    await progressDialog.getByRole("button", { name: "Simpan Status" }).click();
    await expect(progressDialog).toBeHidden();

    await primaryRow.getByRole("button", { name: "Update Progress" }).click();
    progressDialog = page.getByRole("dialog", { name: /Update Progress Intervensi/ });
    await progressDialog.getByLabel("Status Intervensi Baru").selectOption("HUNIAN_LAYAK_SELESAI");
    await progressDialog.getByLabel("Nilai Realisasi Anggaran (Rp)").fill("25000000");
    await progressDialog.getByLabel("Tanggal Selesai Rehabilitasi").fill(today);
    await progressDialog.getByLabel("Catatan Evaluasi & Lapangan").fill("Rehabilitasi selesai dan unit rumah telah dinyatakan layak huni.");
    await progressDialog.getByRole("button", { name: "Simpan & Selesaikan Rehabilitasi" }).click();
    await expect(progressDialog).toBeHidden();
    await expect(primaryRow.getByText("Mandiri / Selesai")).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/);
  });

  test("program catalog and infrastructure report use database records", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Program Infrastruktur" }).click();
    await expect(page.getByRole("heading", { name: "Katalog Program Infrastruktur" })).toBeVisible();
    await expect(page.getByText("Rehabilitasi Rutilahu Development", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: /Tambah Program/ }).click();
    await expect(page.getByRole("dialog", { name: "Tambah Program / Bantuan Baru" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("link", { name: "Laporan Realisasi" }).click();
    await expect(page.getByRole("heading", { name: "Laporan Pelaksanaan & Realisasi Infrastruktur" })).toBeVisible();
    await expect(page.getByText(/25\.000\.000/).first()).toBeVisible();
    await rowFor(page, fixture.referrals.primary.referralCode).getByRole("button", { name: "Detail" }).click();
    const report = page.getByRole("dialog", { name: /Detail Laporan Realisasi/ });
    await expect(report.getByText(fixture.referrals.primary.referralCode)).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/);
  });

  test("primary CiptaBintar screens have no mobile horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    for (const url of ["/cipta-bintar", "/cipta-bintar/program", "/cipta-bintar/laporan"]) {
      await page.goto(url);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.content()).not.toMatch(/\b\d{16}\b/);
    }
  });
});
