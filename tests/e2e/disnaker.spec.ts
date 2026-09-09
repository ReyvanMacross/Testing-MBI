import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

type Fixture = {
  providers: Record<string, { id: string; nama: string }>;
  partners: Record<string, { id: string; nama_perusahaan: string }>;
  programs: Record<string, { id: string; nama_program: string }>;
  referrals: Record<string, { referralId: string; referralCode: string }>;
};

const artifactDir = path.join(process.cwd(), "artifacts", "disnaker");
const fixtureStateFile = path.join(artifactDir, "fixture-state.json");
let fixture: Fixture;
let fixtureSeeded = false;
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

async function login(page: Page) {
  const identifier = process.env.E2E_DISNAKER_IDENTIFIER;
  const password = process.env.E2E_DISNAKER_PASSWORD;
  if (!identifier || !password) throw new Error("Credential E2E Disnaker belum tersedia.");
  await page.goto("/login");
  await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/disnaker$/, { timeout: 15_000 });
}

function rowFor(page: Page, code: string) {
  return page.getByRole("row").filter({ hasText: code });
}

test.describe.serial("Disnaker real database workflow", () => {
  test.beforeAll(() => {
    mkdirSync(artifactDir, { recursive: true });
    execFileSync(process.execPath, ["scripts/dev/seed-disnaker-fixtures.mjs"], {
      cwd: process.cwd(), env: process.env, stdio: "pipe",
    });
    fixture = JSON.parse(readFileSync(fixtureStateFile, "utf8"));
    fixtureSeeded = true;
  });

  test.afterAll(() => {
    if (!fixtureSeeded) return;
    execFileSync(process.execPath, ["scripts/dev/cleanup-disnaker-fixtures.mjs"], {
      cwd: process.cwd(), env: process.env, stdio: "pipe",
    });
  });

  test("admin starts, updates, and completes a vocational intervention", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1024 });
    await login(page);
    await expect(page.getByRole("heading", { name: "Rujukan Masuk & Intervensi" })).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/);
    await page.screenshot({ path: path.join(artifactDir, "01-referral-desktop.png"), fullPage: true });

    const primaryRow = rowFor(page, fixture.referrals.primary.referralCode);
    await primaryRow.getByRole("button", { name: "Proses Intervensi" }).click();
    const startDialog = page.getByRole("dialog", { name: /Proses Intervensi Vokasi/ });
    await expect(startDialog).toHaveAttribute("aria-modal", "true");
    await startDialog.getByLabel("Program Vokasi Spesifik").selectOption(fixture.programs["DEV-PRG-VOK-01"].id);
    await startDialog.getByLabel("Lembaga Pelaksana / BLK Target").selectOption(fixture.providers["DEV-BLK-01"].id);
    await startDialog.getByLabel("Tanggal Mulai Pelatihan").fill(today);
    await startDialog.getByLabel("Catatan Instruksi untuk Peserta").fill("Instruksi E2E untuk pelaksanaan program vokasi.");
    await startDialog.getByRole("button", { name: "Simpan & Mulai Pelatihan" }).click();
    await expect(startDialog).toBeHidden();
    await expect(primaryRow.getByText("Sedang Pelatihan")).toBeVisible();

    await primaryRow.getByRole("button", { name: "Update Progress" }).click();
    const progressDialog = page.getByRole("dialog", { name: /Update Progress Intervensi/ });
    await progressDialog.getByLabel("Status Kehadiran / Keikutsertaan").selectOption("AKTIF_PELATIHAN");
    await progressDialog.getByLabel("Persentase Kehadiran (%)").fill("85");
    await progressDialog.getByLabel("Catatan Evaluasi Instruktur BLK").fill("Peserta aktif mengikuti seluruh modul pengujian E2E.");
    await progressDialog.getByRole("button", { name: "Simpan Progress" }).click();
    await expect(progressDialog).toBeHidden();
    await expect(primaryRow.getByText("Sedang Pelatihan")).toBeVisible();

    await primaryRow.getByRole("button", { name: "Selesaikan Penempatan" }).click();
    const completeDialog = page.getByRole("dialog", { name: /Selesaikan Penempatan/ });
    await completeDialog.getByLabel("Perusahaan / Mitra Penempatan").selectOption(fixture.partners["DEV-MITRA-BLUEBIRD"].id);
    await completeDialog.getByLabel("Tanggal Penempatan Kerja").fill(today);
    await completeDialog.getByLabel("Catatan Evaluasi Disnaker").fill("Peserta berhasil ditempatkan melalui pengujian E2E terkontrol.");
    await completeDialog.getByRole("button", { name: "Simpan & Selesaikan Intervensi" }).click();
    await expect(completeDialog).toBeHidden();
    await expect(primaryRow.getByText("Bekerja / Selesai")).toBeVisible();

    await primaryRow.getByRole("button", { name: "Detail" }).click();
    const detail = page.getByRole("dialog", { name: /Detail Intervensi Warga/ });
    await expect(detail.getByRole("heading", { name: "Riwayat Intervensi" })).toBeVisible();
    await expect(detail.getByText(/Kehadiran 85%/)).toBeVisible();
    await expect(detail.getByText("Peserta berhasil ditempatkan kerja.")).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/);
    await page.keyboard.press("Escape");
    await expect(detail).toBeHidden();
  });

  test("program catalog and placement report use database records", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1024 });
    await login(page);
    await page.getByRole("link", { name: "Program Pelatihan" }).click();
    await expect(page.getByRole("heading", { name: "Katalog Program Pelatihan Vokasi" })).toBeVisible();
    await expect(page.getByText("Program Vokasi Development", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: /Tambah Program/ }).click();
    const addDialog = page.getByRole("dialog", { name: "Tambah Program Pelatihan Baru" });
    await expect(addDialog.getByLabel("Mitra Pelaksana / BLK Target")).toContainText("BLK Development Kota Bandung");
    await page.keyboard.press("Escape");
    await expect(addDialog).toBeHidden();
    await page.screenshot({ path: path.join(artifactDir, "02-program-desktop.png"), fullPage: true });

    await page.getByRole("link", { name: "Laporan Penempatan" }).click();
    await expect(page.getByRole("heading", { name: "Laporan Penempatan Kerja MBI" })).toBeVisible();
    await expect(page.getByText("Belum tersedia", { exact: true })).toBeVisible();
    await expect(page.getByText("Mitra Transportasi Development", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Detail Penempatan" }).first().click();
    const reportDialog = page.getByRole("dialog", { name: /Detail Penempatan Kerja/ });
    await expect(reportDialog.getByText(fixture.referrals.primary.referralCode)).toBeVisible();
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
