import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const artifactDir = path.join(process.cwd(), "artifacts", "dinsos");
let createdWargaId: string | undefined;
let createdCaseId: string | undefined;

async function login(page: import("@playwright/test").Page) {
  const identifier = process.env.E2E_DINSOS_IDENTIFIER ?? process.env.DINSOS_ADMIN_USERNAME;
  const password = process.env.E2E_DINSOS_PASSWORD ?? process.env.DINSOS_ADMIN_PASSWORD;
  if (!identifier || !password) throw new Error("Credential E2E Dinsos belum tersedia.");

  await page.goto("/login");
  await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dinsos$/, { timeout: 15_000 });
}

test.describe("Pendaftaran warga Dinas Sosial", () => {
  test.afterAll(async () => {
    if (
      !createdWargaId ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SECRET_KEY
    ) return;

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    if (createdCaseId) {
      await admin.from("dinsos_cases").delete().eq("id", createdCaseId);
    }
    await admin
      .from("log_aktivitas")
      .delete()
      .eq("aktivitas", "Mendaftarkan warga baru")
      .contains("metadata", { wargaId: createdWargaId });
    await admin.from("warga").delete().eq("id", createdWargaId);
  });

  test("admin dapat mendaftarkan warga baru dari halaman Data Warga", async ({ page }) => {
    mkdirSync(artifactDir, { recursive: true });
    await login(page);
    await page.goto("/dinsos/warga");

    await page.getByRole("link", { name: "Daftarkan Warga Baru" }).click();
    const dialog = page.getByRole("dialog", { name: "Daftarkan Warga Baru" });
    await expect(dialog).toBeVisible();
    await page.screenshot({
      path: path.join(artifactDir, "25-daftar-warga-baru.png"),
      fullPage: true,
    });

    const uniqueDigits = `${Date.now()}`.slice(-11).padStart(11, "0");
    const nik = `32750${uniqueDigits}`;
    await dialog.getByLabel("Nomor Induk Kependudukan (NIK) *").fill("327314210703008");
    await dialog.getByRole("button", { name: "Daftarkan Warga", exact: true }).click();
    await expect(dialog.getByText("NIK harus terdiri dari tepat 16 digit.")).toBeVisible();
    await expect(dialog.getByText("Nomor KK wajib diisi.")).toBeAttached();
    await expect(dialog.getByText("Email wajib diisi.")).toBeAttached();
    await expect(dialog.locator('[aria-invalid="true"]')).toHaveCount(15);

    await dialog.getByLabel("Nomor Induk Kependudukan (NIK) *").fill(nik);
    await dialog.getByLabel("Nomor Kartu Keluarga *").fill(`32730${uniqueDigits}`);
    await dialog.getByLabel("Nama Lengkap *").fill("Warga Uji Pendaftaran");
    await dialog.getByLabel("Tempat Lahir *").fill("Bandung");
    await dialog.getByLabel("Tanggal Lahir *").fill("1990-05-17");
    await dialog.getByLabel("Jenis Kelamin *").selectOption("Perempuan");
    await dialog.getByLabel("Status Perkawinan *").selectOption("Menikah");
    await dialog.getByLabel("Nomor Telepon *").fill(["0812", "3456", "7890"].join(""));
    await expect(dialog.getByLabel("Nomor Telepon *")).toHaveValue("81234567890");
    await dialog.getByLabel("Email *").fill(`warga.${uniqueDigits}@example.invalid`);
    await dialog.getByLabel("Kelurahan *").selectOption({ index: 1 });
    await dialog.getByLabel("Alamat Domisili *").fill("Alamat pengujian pendaftaran warga Dinsos");
    await dialog.getByLabel("Pendidikan Terakhir *").fill("SMA/SMK sederajat");
    await dialog.getByLabel("Pekerjaan Utama *").fill("Wiraswasta");
    await dialog.getByLabel("Jumlah Anggota Keluarga *").fill("3");
    await dialog.getByLabel("Status Kepemilikan Rumah *").fill("Milik sendiri");

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/dinsos/warga") &&
        response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Daftarkan Warga", exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const body = (await response.json()) as { wargaId: string; caseId: string };
    createdWargaId = body.wargaId;
    createdCaseId = body.caseId;

    await expect(page).toHaveURL(new RegExp(`warga=${createdWargaId}`));
    await expect(page.getByRole("dialog", { name: /Profil Warga.*Warga Uji Pendaftaran/ })).toBeVisible();

    await page.goto("/dinsos");
    await page.getByRole("textbox", { name: "Cari NIK atau nama" }).fill("Warga Uji Pendaftaran");
    await page.getByRole("button", { name: "Terapkan", exact: true }).click();
    await expect(page.getByRole("table").getByText("Warga Uji Pendaftaran", { exact: true })).toBeVisible();
    await expect(page.getByRole("table").getByRole("img", { name: "Foto Warga Uji Pendaftaran" })).toBeVisible();
  });
});
