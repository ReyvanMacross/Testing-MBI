import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

type Fixture = {
  mentors: Record<string, { id: string; nama: string }>;
  programs: Record<string, { id: string; nama_program: string }>;
  referrals: Record<string, { referralId: string; referralCode: string }>;
};

const artifactDir = path.join(process.cwd(), "artifacts", "disdagin");
const fixtureStateFile = path.join(artifactDir, "fixture-state.json");
let fixture: Fixture;
let fixtureSeeded = false;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

async function login(page: Page) {
  const identifier = process.env.E2E_DISDAGIN_IDENTIFIER;
  const password = process.env.E2E_DISDAGIN_PASSWORD;
  if (!identifier || !password) throw new Error("Credential E2E Disdagin belum tersedia.");
  await page.goto("/login");
  await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/disdagin$/, { timeout: 15_000 });
}

function rowFor(page: Page, code: string) {
  return page.getByRole("row").filter({ hasText: code });
}

test.describe.serial("Disdagin real database workflow", () => {
  test.beforeAll(() => {
    mkdirSync(artifactDir, { recursive: true });
    execFileSync(process.execPath, ["scripts/dev/seed-disdagin-fixtures.mjs"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
    fixture = JSON.parse(readFileSync(fixtureStateFile, "utf8"));
    fixtureSeeded = true;
  });

  test.afterAll(() => {
    if (!fixtureSeeded) return;
    execFileSync(process.execPath, ["scripts/dev/cleanup-disdagin-fixtures.mjs"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
  });

  test("admin starts, updates, and completes an entrepreneurship intervention", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 900 });
    await login(page);
    await expect(page.getByRole("heading", { name: "Rujukan Masuk & Intervensi" })).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/);

    const primaryRow = rowFor(page, fixture.referrals.primary.referralCode);
    await primaryRow.getByRole("button", { name: "Proses Intervensi" }).click();
    const startDialog = page.getByRole("dialog", { name: /Proses Intervensi Akses Pasar/ });
    await startDialog.getByLabel("Nama Usaha").fill("Usaha Pameran E2E");
    await startDialog.getByLabel("Nomor NIB").fill("9000000009010");
    await startDialog.getByLabel("Agenda & Kemitraan Spesifik").selectOption(fixture.programs["DEV-PRG-DAG-01"].id);
    await startDialog.getByLabel("Mitra / Penyelenggara Target").selectOption(fixture.mentors["DEV-PLUT-01"].id);
    await startDialog.getByLabel("Tanggal Pelaksanaan").fill(today);
    await startDialog.getByLabel("Catatan & Dukungan Fasilitasi").fill("Rencana fasilitasi pasar untuk pengujian E2E terkontrol.");
    await startDialog.getByRole("button", { name: "Simpan & Alokasikan Fasilitasi" }).click();
    await expect(startDialog).toBeHidden();
    await expect(primaryRow.getByText("Fasilitasi Pameran")).toBeVisible();

    await primaryRow.getByRole("button", { name: "Update Progress" }).click();
    let progressDialog = page.getByRole("dialog", { name: /Update Status Fasilitasi/ });
    await progressDialog.getByLabel("Persentase Progress Usaha (%)").fill("75");
    await progressDialog.getByLabel("Status Penetrasi Pasar").selectOption("PROSES_NIB_HALAL");
    await progressDialog.getByLabel("Catatan Evaluasi Pendamping").fill("Peserta sedang mengikuti fasilitasi pameran melalui E2E.");
    await progressDialog.getByRole("button", { name: "Simpan Progress" }).click();
    await expect(progressDialog).toBeHidden();

    await primaryRow.getByRole("button", { name: "Update Progress" }).click();
    progressDialog = page.getByRole("dialog", { name: /Update Status Fasilitasi/ });
    await progressDialog.getByLabel("Status Intervensi Baru").selectOption("MANDIRI_SELESAI");
    await progressDialog.getByLabel("Nomor NIB").fill("9000000009010");
    await progressDialog.getByLabel("Transaksi / Omzet Event (Rp)").fill("4500000");
    await progressDialog.getByLabel("Tanggal Selesai Pendampingan").fill(today);
    await progressDialog.getByLabel("Catatan Evaluasi Pendamping").fill("Usaha telah memiliki legalitas dan omzet bulanan yang terverifikasi.");
    await progressDialog.getByRole("button", { name: "Simpan & Selesaikan Pendampingan" }).click();
    await expect(progressDialog).toBeHidden();
    await expect(primaryRow.getByText("Mitra Retail / Selesai")).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/);
  });

  test("program catalog and revenue report use database records", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Agenda & Kemitraan" }).click();
    await expect(page.getByRole("heading", { name: "Katalog Kemitraan & Pameran Dagang" })).toBeVisible();
    await expect(page.getByText("Pendampingan Usaha Development", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: /Tambah Agenda/ }).click();
    await expect(page.getByRole("dialog", { name: "Tambah Agenda Kemitraan & Pameran Baru" }).getByLabel("Mitra / Penyelenggara Target")).toContainText("Pendamping PLUT Development");
    await page.keyboard.press("Escape");

    await page.getByRole("link", { name: "Laporan Pemasaran" }).click();
    await expect(page.getByRole("heading", { name: "Laporan Pemasaran & Penetrasi Pasar UMKM" })).toBeVisible();
    await expect(page.getByText(/4\.500\.000/).first()).toBeVisible();
    await rowFor(page, fixture.referrals.primary.referralCode).getByRole("button", { name: "Detail" }).click();
    const report = page.getByRole("dialog", { name: /Detail Rekap Pemasaran/ });
    await expect(report.getByText(fixture.referrals.primary.referralCode)).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/);
  });

  test("primary Disdagin screens have no mobile horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    for (const url of ["/disdagin", "/disdagin/program", "/disdagin/laporan"]) {
      await page.goto(url);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.content()).not.toMatch(/\b\d{16}\b/);
    }
  });
});
