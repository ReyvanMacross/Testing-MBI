import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

type Fixture = {
  schools: Record<string, { id: string; kode: string; nama: string }>;
  programs: Record<string, { id: string; kode_program: string; nama_program: string }>;
  referrals: Record<string, { referralId: string; referralCode: string }>;
};

const artifactDir = path.join(process.cwd(), "artifacts", "disdik");
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
  const identifier = process.env.E2E_DISDIK_IDENTIFIER;
  const password = process.env.E2E_DISDIK_PASSWORD;
  if (!identifier || !password) throw new Error("Credential E2E Disdik belum tersedia.");
  await page.goto("/login");
  await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/disdik$/u, { timeout: 15_000 });
}

function rowFor(page: Page, code: string) {
  return page.getByRole("row").filter({ hasText: code });
}

test.describe.serial("Disdik real database workflow", () => {
  test.beforeAll(() => {
    mkdirSync(artifactDir, { recursive: true });
    execFileSync(process.execPath, ["scripts/dev/seed-disdik-fixtures.mjs"], {
      cwd: process.cwd(), env: process.env, stdio: "pipe",
    });
    fixture = JSON.parse(readFileSync(fixtureStateFile, "utf8"));
    fixtureSeeded = true;
  });

  test.afterAll(() => {
    if (!fixtureSeeded) return;
    execFileSync(process.execPath, ["scripts/dev/cleanup-disdik-fixtures.mjs"], {
      cwd: process.cwd(), env: process.env, stdio: "pipe",
    });
  });

  test("alur rujukan dapat dimulai, diperbarui, dan diselesaikan", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page);
    await expect(page.getByRole("heading", { name: "Rujukan Masuk & Intervensi" })).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/u);

    const row = rowFor(page, fixture.referrals.primary.referralCode);
    await row.getByRole("button", { name: "Proses Intervensi" }).click();
    const start = page.getByRole("dialog", { name: /Proses Intervensi Disdik/u });
    await start.getByLabel("Pilih Program Intervensi Pendidikan").selectOption(fixture.programs["DEV-PRG-EDU-01"].id);
    await start.getByLabel("Sekolah Tujuan / Penerima").selectOption(fixture.schools["DEV-SCH-EDU-01"].id);
    await start.getByLabel("Tanggal Penyaluran Bantuan").fill(today);
    await start.getByLabel("Rencana Intervensi & Catatan Rekomendasi").fill("Rencana bantuan pendidikan untuk pengujian E2E terkontrol.");
    await start.getByRole("button", { name: "Simpan & Proses Bantuan" }).click();
    await expect(start).toBeHidden();
    await expect(row.getByText("Sedang Diverifikasi")).toBeVisible();

    await row.getByRole("button", { name: "Update Progress" }).click();
    let progress = page.getByRole("dialog", { name: /Update Progress Intervensi/u });
    await progress.getByLabel("Persentase Progress (%)").fill("75");
    await progress.getByLabel("Status Verifikasi Dokumen").selectOption("LULUS");
    await progress.getByLabel("Realisasi Pagu Bantuan (Rp)").fill("2000000");
    await progress.getByLabel("Catatan Progress Penyaluran Disdik").fill("Dokumen selesai diverifikasi dan bantuan sedang disalurkan ke sekolah.");
    await progress.getByRole("button", { name: "Simpan & Update Progress" }).click();
    await expect(progress).toBeHidden();

    await row.getByRole("button", { name: "Update Progress" }).click();
    progress = page.getByRole("dialog", { name: /Update Progress Intervensi/u });
    await progress.getByLabel("Status Intervensi Baru").selectOption("SELESAI");
    await progress.getByLabel("Realisasi Pagu Bantuan (Rp)").fill("2500000");
    await progress.getByLabel("Tanggal Selesai Intervensi").fill(today);
    await progress.getByLabel("Catatan Progress Penyaluran Disdik").fill("Bantuan pendidikan selesai disalurkan dan diterima oleh sekolah.");
    await progress.getByRole("button", { name: "Simpan & Selesaikan Intervensi" }).click();
    await expect(progress).toBeHidden();
    await expect(row.getByText("Terintervensi / Selesai")).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/u);
  });

  test("katalog program dan laporan memakai data database", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Program Pendidikan" }).click();
    await expect(page.getByRole("heading", { name: "Katalog Program / Bantuan Pendidikan" })).toBeVisible();
    await expect(page.getByText("Bantuan Pendidikan Development", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: /Tambah Program/u }).click();
    const addProgram = page.getByRole("dialog", { name: "Tambah Program / Bantuan Pendidikan Baru" });
    await expect(addProgram.getByLabel("Sekolah / Penyelenggara")).toContainText("Sekolah Pengujian Disdik");
    await page.keyboard.press("Escape");
    await expect(addProgram).toBeHidden();

    await page.getByRole("link", { name: "Laporan Realisasi" }).click();
    await expect(page.getByRole("heading", { name: "Laporan Pelaksanaan & Realisasi Pendidikan" })).toBeVisible();
    const reportRow = rowFor(page, fixture.referrals.primary.referralCode);
    await expect(reportRow.getByText(/2\.500\.000/u)).toBeVisible();
    await reportRow.getByRole("button", { name: "Detail" }).click();
    const report = page.getByRole("dialog", { name: /Detail Laporan Realisasi/u });
    await expect(report.getByText(fixture.referrals.primary.referralCode)).toBeVisible();
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
