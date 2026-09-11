import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

type Fixture = {
  units: Record<string, { id: string; kode: string; nama: string }>;
  programs: Record<string, { id: string; kode_program: string; nama_program: string }>;
  referrals: Record<string, { referralId: string; referralCode: string }>;
};

const artifactDir = path.join(process.cwd(), "artifacts", "dp3a");
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
  const identifier = process.env.E2E_DP3A_IDENTIFIER;
  const password = process.env.E2E_DP3A_PASSWORD;
  if (!identifier || !password) throw new Error("Credential E2E DP3A belum tersedia.");
  await page.goto("/login");
  await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dp3a$/u, { timeout: 15_000 });
}

function rowFor(page: Page, code: string) {
  return page.getByRole("row").filter({ hasText: code });
}

test.describe.serial("DP3A real database workflow", () => {
  test.beforeAll(() => {
    mkdirSync(artifactDir, { recursive: true });
    execFileSync(process.execPath, ["scripts/dev/seed-dp3a-fixtures.mjs"], {
      cwd: process.cwd(), env: process.env, stdio: "pipe",
    });
    fixture = JSON.parse(readFileSync(fixtureStateFile, "utf8"));
    fixtureSeeded = true;
  });

  test.afterAll(() => {
    if (!fixtureSeeded) return;
    execFileSync(process.execPath, ["scripts/dev/cleanup-dp3a-fixtures.mjs"], {
      cwd: process.cwd(), env: process.env, stdio: "pipe",
    });
  });

  test("alur rujukan dapat dimulai, diperbarui, dan diselesaikan", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page);
    await expect(page.getByRole("heading", { name: "Rujukan Masuk & Penanganan Kasus" })).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/u);

    const row = rowFor(page, fixture.referrals.primary.referralCode);
    await row.getByRole("button", { name: "Proses Penanganan" }).click();
    const start = page.getByRole("dialog", { name: /Proses Penanganan DP3A/u });
    await start.getByLabel("Pilih Program Layanan DP3A").selectOption(fixture.programs["DEV-PRG-PPA-01"].id);
    await start.getByLabel("Unit Pelaksana / Tim Pendamping").selectOption(fixture.units["DEV-UNIT-PPA-01"].id);
    await start.getByLabel("Jadwal Pendampingan / Konseling").fill(today);
    await start.getByLabel("Rencana Penanganan & Catatan Rekomendasi").fill("Rencana bantuan perlindungan untuk pengujian E2E terkontrol.");
    await start.getByRole("button", { name: "Simpan & Proses Penanganan" }).click();
    await expect(start).toBeHidden();
    await expect(row.getByText("Sedang Diverifikasi")).toBeVisible();

    await row.getByRole("button", { name: "Update Progress" }).click();
    let progress = page.getByRole("dialog", { name: /Update Progress Penanganan/u });
    await progress.getByLabel("Persentase Progress (%)").fill("75");
    await progress.getByLabel("Status Verifikasi Berkas").selectOption("LULUS");
    await progress.getByLabel("Realisasi Pagu Bantuan (Rp)").fill("2000000");
    await progress.getByLabel("Catatan Progress Penanganan DP3A").fill("Dokumen selesai diverifikasi dan bantuan sedang disalurkan ke unit layanan.");
    await progress.getByRole("button", { name: "Simpan & Update Progress" }).click();
    await expect(progress).toBeHidden();

    await row.getByRole("button", { name: "Update Progress" }).click();
    progress = page.getByRole("dialog", { name: /Update Progress Penanganan/u });
    await progress.getByLabel("Status Penanganan Baru").selectOption("SELESAI");
    await progress.getByLabel("Realisasi Pagu Bantuan (Rp)").fill("2500000");
    await progress.getByLabel("Tanggal Penutupan Kasus").fill(today);
    await progress.getByLabel("Catatan Progress Penanganan DP3A").fill("Bantuan perlindungan selesai disalurkan dan diterima oleh unit layanan.");
    await progress.getByRole("button", { name: "Simpan & Selesaikan Penanganan" }).click();
    await expect(progress).toBeHidden();
    await expect(row.getByText("Terintervensi / Selesai")).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/u);
  });

  test("katalog program dan laporan memakai data database", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Program Layanan" }).click();
    await expect(page.getByRole("heading", { name: "Katalog Program Layanan Perlindungan & Pemberdayaan" })).toBeVisible();
    await expect(page.getByText("Pendampingan Terpadu Development", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: /Tambah Program/u }).click();
    const addProgram = page.getByRole("dialog", { name: "Tambah Program Layanan Baru" });
    await expect(addProgram.getByLabel("Unit Pelaksana")).toContainText("UPTD PPA Pengujian DP3A");
    await page.keyboard.press("Escape");
    await expect(addProgram).toBeHidden();

    await page.getByRole("link", { name: "Laporan Realisasi" }).click();
    await expect(page.getByRole("heading", { name: "Laporan Pelaksanaan & Realisasi DP3A" })).toBeVisible();
    const reportRow = rowFor(page, fixture.referrals.primary.referralCode);
    await expect(reportRow.getByText(/2\.500\.000/u)).toBeVisible();
    await reportRow.getByRole("button", { name: "Detail" }).click();
    const report = page.getByRole("dialog", { name: /Detail Laporan Realisasi/u });
    await expect(report.getByText(fixture.referrals.primary.referralCode)).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/u);
  });

  test("halaman utama DP3A tidak overflow pada mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    for (const url of ["/dp3a", "/dp3a/program", "/dp3a/laporan"]) {
      await page.goto(url);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.content()).not.toMatch(/\b\d{16}\b/u);
    }
  });
});
