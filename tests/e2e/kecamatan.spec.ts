import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

type Fixture = {
  program: { id: string; nama_program: string };
  citizens: Record<string, { id: string; nik: string; nama_lengkap: string }>;
};

const artifactDir = path.join(process.cwd(), "artifacts", "kecamatan");
const fixtureStateFile = path.join(artifactDir, "fixture-state.json");
let fixture: Fixture;
let fixtureSeeded = false;

async function login(page: Page) {
  const identifier = process.env.E2E_KECAMATAN_IDENTIFIER || process.env.KECAMATAN_ADMIN_USERNAME || "admin.kecamatan";
  const password = process.env.E2E_KECAMATAN_PASSWORD || process.env.KECAMATAN_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD;
  if (!identifier || !password) throw new Error("Credential E2E Kecamatan belum tersedia.");
  await page.goto("/login");
  await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/kecamatan$/u, { timeout: 15_000 });
}

function rowFor(page: Page, name: string) {
  return page.getByRole("row").filter({ hasText: name });
}

test.describe.serial("Kecamatan real database workflow", () => {
  test.beforeAll(() => {
    mkdirSync(artifactDir, { recursive: true });
    execFileSync(process.execPath, ["scripts/dev/seed-kecamatan-fixtures.mjs"], {
      cwd: process.cwd(), env: process.env, stdio: "pipe",
    });
    fixture = JSON.parse(readFileSync(fixtureStateFile, "utf8"));
    fixtureSeeded = true;
  });

  test.afterAll(() => {
    if (!fixtureSeeded) return;
    execFileSync(process.execPath, ["scripts/dev/cleanup-kecamatan-fixtures.mjs"], {
      cwd: process.cwd(), env: process.env, stdio: "pipe",
    });
  });

  test("alur survei hingga rujukan OPD selesai dari dashboard", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await login(page);
    await expect(page.getByRole("heading", { name: "Antrian Kerja Kewilayahan" })).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/u);

    let row = rowFor(page, fixture.citizens.waiting.nama_lengkap);
    await row.getByRole("button", { name: "Tugaskan Survei" }).click();
    let dialog = page.getByRole("dialog", { name: /Penugasan Survei Lapangan/u });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Pilih Petugas Surveyor").fill("PSM E2E Kecamatan");
    await dialog.getByLabel("Catatan & Instruksi Perintah Tugas").fill("Verifikasi faktual warga untuk pengujian E2E workflow Kecamatan.");
    await dialog.getByRole("button", { name: "Kirim Penugasan Survei" }).click();
    await expect(dialog).toBeHidden();
    row = rowFor(page, fixture.citizens.waiting.nama_lengkap);
    await expect(row.getByRole("button", { name: "Isi Hasil Survei" })).toBeVisible();

    await row.getByRole("button", { name: "Isi Hasil Survei" }).click();
    dialog = page.getByRole("dialog", { name: /Input Hasil Verifikasi Lapangan/u });
    await dialog.getByLabel("Skor Hasil Asesmen").fill("88");
    await dialog.getByLabel("Desil Faktual").selectOption("1");
    await dialog.getByLabel("Catatan Faktual Surveyor").fill("Data domisili dan kondisi faktual telah diperiksa; warga layak memperoleh rujukan OPD.");
    await dialog.getByRole("button", { name: "Simpan Hasil Survei" }).click();
    await expect(dialog).toBeHidden();
    row = rowFor(page, fixture.citizens.waiting.nama_lengkap);
    await expect(row.getByRole("button", { name: "Review & Approve" })).toBeVisible();

    await row.getByRole("button", { name: "Review & Approve" }).click();
    dialog = page.getByRole("dialog", { name: /Review Hasil Verifikasi Lapangan/u });
    await dialog.getByLabel("Rencana OPD / Program Tujuan").selectOption(fixture.program.id);
    await dialog.getByRole("button", { name: /Setujui Hasil Verifikasi/u }).click();
    await expect(dialog).toBeHidden();
    row = rowFor(page, fixture.citizens.waiting.nama_lengkap);
    await expect(row.getByRole("button", { name: "Kirim ke OPD" })).toBeVisible();

    await row.getByRole("button", { name: "Kirim ke OPD" }).click();
    dialog = page.getByRole("dialog", { name: /Proses Verifikasi Kewilayahan/u });
    await expect(dialog.getByLabel("Program OPD Tujuan")).toHaveValue(fixture.program.id);
    await dialog.getByRole("button", { name: "Kirim Rujukan ke OPD" }).click();
    await expect(dialog).toBeHidden();
    row = rowFor(page, fixture.citizens.waiting.nama_lengkap);
    await expect(row.getByRole("button", { name: "Detail" })).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/u);
  });

  test("master warga, verifikasi, dan pelacakan memakai data staging", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Data Warga" }).click();
    await expect(page.getByRole("heading", { name: /Master Data Warga MBI/u })).toBeVisible();
    await page.getByRole("button", { name: "Tambah Usulan Warga" }).click();
    let dialog = page.getByRole("dialog", { name: "Tambah Usulan Warga MBI Baru" });
    await dialog.getByLabel("Nomor Induk Kependudukan (NIK)").fill(fixture.citizens.unassigned.nik);
    await dialog.getByRole("button", { name: "Cek Data Warga MBI" }).click();
    await expect(dialog.getByText(fixture.citizens.unassigned.nama_lengkap, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Hubungi Helpdesk" }).click();
    dialog = page.getByRole("dialog", { name: "Hubungi Helpdesk Operator MBI" });
    await expect(dialog.getByLabel("Kategori Kendala")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(rowFor(page, fixture.citizens.referred.nama_lengkap)).toBeVisible();
    await rowFor(page, fixture.citizens.referred.nama_lengkap).getByRole("button", { name: "Detail" }).click();
    await expect(page.getByRole("dialog", { name: /Profil Master Warga/u })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("link", { name: "Verifikasi Lapangan" }).click();
    await expect(page.getByRole("heading", { name: "Verifikasi Lapangan Kewilayahan" })).toBeVisible();
    await expect(rowFor(page, fixture.citizens.assigned.nama_lengkap)).toBeVisible();

    await page.getByRole("link", { name: "Pelacakan Rujukan" }).click();
    await expect(page.getByRole("heading", { name: "Pelacakan Rujukan Kewilayahan" })).toBeVisible();
    await expect(rowFor(page, fixture.citizens.referred.nama_lengkap)).toBeVisible();
    await rowFor(page, fixture.citizens.referred.nama_lengkap).getByRole("button", { name: "Detail" }).click();
    const drawer = page.getByRole("dialog", { name: /Detail Pelacakan Rujukan/u });
    await expect(drawer.getByText("Dinas Pendidikan", { exact: true })).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/u);
  });

  test("seluruh halaman Kecamatan tidak overflow pada mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    for (const url of ["/kecamatan", "/kecamatan/warga", "/kecamatan/verifikasi", "/kecamatan/rujukan"]) {
      await page.goto(url);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.content()).not.toMatch(/\b\d{16}\b/u);
    }
  });
});
