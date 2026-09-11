import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Browser, type Page } from "@playwright/test";

type KecamatanFixture = {
  citizens: Record<string, { id: string; nama_lengkap: string }>;
};

type Dp3aFixture = {
  units: Record<string, { id: string }>;
  programs: Record<string, { id: string }>;
};

const kecamatanStateFile = path.join(process.cwd(), "artifacts", "kecamatan", "fixture-state.json");
const dp3aStateFile = path.join(process.cwd(), "artifacts", "dp3a", "fixture-state.json");
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

let kecamatanFixture: KecamatanFixture;
let dp3aFixture: Dp3aFixture;
let kecamatanSeeded = false;
let dp3aSeeded = false;

function runFixture(script: string) {
  execFileSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
  });
}

async function login(page: Page, identifier: string | undefined, password: string | undefined, home: string) {
  if (!identifier || !password) throw new Error(`Credential E2E ${home} belum tersedia.`);
  await page.goto("/login");
  await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${home}$`, "u"), { timeout: 15_000 });
}

function rowFor(page: Page, name: string) {
  return page.getByRole("row").filter({ hasText: name });
}

async function kecamatanCreatesReferral(browser: Browser, citizenName: string) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  try {
    await login(page, process.env.E2E_KECAMATAN_IDENTIFIER, process.env.E2E_KECAMATAN_PASSWORD, "/kecamatan");
    let row = rowFor(page, citizenName);

    await row.getByRole("button", { name: "Tugaskan Survei" }).click();
    let dialog = page.getByRole("dialog", { name: /Penugasan Survei Lapangan/u });
    await dialog.getByLabel("Pilih Petugas Surveyor").fill("PSM Integrasi Kecamatan DP3A");
    await dialog.getByLabel("Catatan & Instruksi Perintah Tugas").fill("Verifikasi faktual untuk rujukan perlindungan lintas instansi ke DP3A.");
    await dialog.getByRole("button", { name: "Kirim Penugasan Survei" }).click();
    await expect(dialog).toBeHidden();

    row = rowFor(page, citizenName);
    await row.getByRole("button", { name: "Isi Hasil Survei" }).click();
    dialog = page.getByRole("dialog", { name: /Input Hasil Verifikasi Lapangan/u });
    await dialog.getByLabel("Skor Hasil Asesmen").fill("91");
    await dialog.getByLabel("Desil Faktual").selectOption("1");
    await dialog.getByLabel("Catatan Faktual Surveyor").fill("Domisili dan kebutuhan perlindungan telah diverifikasi; warga layak dirujuk ke DP3A.");
    await dialog.getByRole("button", { name: "Simpan Hasil Survei" }).click();
    await expect(dialog).toBeHidden();

    row = rowFor(page, citizenName);
    await row.getByRole("button", { name: "Review & Approve" }).click();
    dialog = page.getByRole("dialog", { name: /Review Hasil Verifikasi Lapangan/u });
    await dialog.getByLabel("Rencana OPD / Program Tujuan").selectOption(dp3aFixture.programs["DEV-PRG-PPA-01"].id);
    await dialog.getByRole("button", { name: /Setujui Hasil Verifikasi/u }).click();
    await expect(dialog).toBeHidden();

    row = rowFor(page, citizenName);
    await row.getByRole("button", { name: "Kirim ke OPD" }).click();
    dialog = page.getByRole("dialog", { name: /Proses Verifikasi Kewilayahan/u });
    await expect(dialog.getByLabel("Program OPD Tujuan")).toHaveValue(dp3aFixture.programs["DEV-PRG-PPA-01"].id);
    await dialog.getByRole("button", { name: "Kirim Rujukan ke OPD" }).click();
    await expect(dialog).toBeHidden();

    await page.goto("/kecamatan/rujukan");
    row = rowFor(page, citizenName);
    await expect(row.getByText("Menunggu Respons OPD")).toBeVisible();
    await expect(row.getByText("Dinas Pemberdayaan Perempuan dan Perlindungan Anak")).toBeVisible();
  } finally {
    await context.close();
  }
}

async function dp3aCompletesReferral(browser: Browser, citizenName: string) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await login(page, process.env.E2E_DP3A_IDENTIFIER, process.env.E2E_DP3A_PASSWORD, "/dp3a");
    const row = rowFor(page, citizenName);
    await expect(row.getByText("Perlu Diproses")).toBeVisible();

    await row.getByRole("button", { name: "Proses Penanganan" }).click();
    let dialog = page.getByRole("dialog", { name: /Proses Penanganan DP3A/u });
    await dialog.getByLabel("Pilih Program Layanan DP3A").selectOption(dp3aFixture.programs["DEV-PRG-PPA-01"].id);
    await dialog.getByLabel("Unit Pelaksana / Tim Pendamping").selectOption(dp3aFixture.units["DEV-UNIT-PPA-01"].id);
    await dialog.getByLabel("Jadwal Pendampingan / Konseling").fill(today);
    await dialog.getByLabel("Rencana Penanganan & Catatan Rekomendasi").fill("DP3A menerima rujukan Kecamatan dan memulai asesmen perlindungan terpadu.");
    await dialog.getByRole("button", { name: "Simpan & Proses Penanganan" }).click();
    await expect(dialog).toBeHidden();

    await row.getByRole("button", { name: "Update Progress" }).click();
    dialog = page.getByRole("dialog", { name: /Update Progress Penanganan/u });
    await dialog.getByLabel("Persentase Progress (%)").fill("70");
    await dialog.getByLabel("Status Verifikasi Berkas").selectOption("LULUS");
    await dialog.getByLabel("Realisasi Pagu Bantuan (Rp)").fill("1500000");
    await dialog.getByLabel("Catatan Progress Penanganan DP3A").fill("Asesmen selesai dan pendampingan perlindungan sedang dilaksanakan bersama unit layanan.");
    await dialog.getByRole("button", { name: "Simpan & Update Progress" }).click();
    await expect(dialog).toBeHidden();

    await row.getByRole("button", { name: "Update Progress" }).click();
    dialog = page.getByRole("dialog", { name: /Update Progress Penanganan/u });
    await dialog.getByLabel("Status Penanganan Baru").selectOption("SELESAI");
    await dialog.getByLabel("Realisasi Pagu Bantuan (Rp)").fill("2500000");
    await dialog.getByLabel("Tanggal Penutupan Kasus").fill(today);
    await dialog.getByLabel("Catatan Progress Penanganan DP3A").fill("Pendampingan selesai dan hasil intervensi telah diteruskan kembali kepada Kecamatan.");
    await dialog.getByRole("button", { name: "Simpan & Selesaikan Penanganan" }).click();
    await expect(dialog).toBeHidden();
    await expect(row.getByText("Terintervensi / Selesai")).toBeVisible();
  } finally {
    await context.close();
  }
}

async function kecamatanSeesCompletion(browser: Browser, citizenName: string) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  try {
    await login(page, process.env.E2E_KECAMATAN_IDENTIFIER, process.env.E2E_KECAMATAN_PASSWORD, "/kecamatan");
    await page.goto("/kecamatan/rujukan");
    const row = rowFor(page, citizenName);
    await expect(row.getByText("Selesai / Intervensi")).toBeVisible();
    await row.getByRole("button", { name: "Detail" }).click();
    const drawer = page.getByRole("dialog", { name: /Detail Pelacakan Rujukan/u });
    await expect(drawer.getByText("Selesai / Intervensi")).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/u);
  } finally {
    await context.close();
  }
}

test.describe.serial("Integrasi Kecamatan ke DP3A", () => {
  test.beforeAll(() => {
    runFixture("scripts/dev/seed-kecamatan-fixtures.mjs");
    kecamatanSeeded = true;
    kecamatanFixture = JSON.parse(readFileSync(kecamatanStateFile, "utf8"));
    runFixture("scripts/dev/seed-dp3a-fixtures.mjs");
    dp3aSeeded = true;
    dp3aFixture = JSON.parse(readFileSync(dp3aStateFile, "utf8"));
  });

  test.afterAll(() => {
    const errors: unknown[] = [];
    if (kecamatanSeeded) {
      try { runFixture("scripts/dev/cleanup-kecamatan-fixtures.mjs"); }
      catch (error) { errors.push(error); }
    }
    if (dp3aSeeded) {
      try { runFixture("scripts/dev/cleanup-dp3a-fixtures.mjs"); }
      catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Cleanup fixture integrasi Kecamatan-DP3A gagal.");
  });

  test("status intervensi mengalir dari Kecamatan ke DP3A dan kembali", async ({ browser }) => {
    const citizenName = kecamatanFixture.citizens.waiting.nama_lengkap;
    await kecamatanCreatesReferral(browser, citizenName);
    await dp3aCompletesReferral(browser, citizenName);
    await kecamatanSeesCompletion(browser, citizenName);
  });
});
