import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

type CaseFixture = {
  caseId: string;
  wargaId: string;
  citizenName: string;
  desil: number;
};

type WorkflowFixture = {
  high: CaseFixture;
  low: CaseFixture;
  programId: string;
  targetOpdId: string;
};

const fixtureStateFile = path.join(
  process.cwd(),
  "artifacts",
  "dinsos",
  "full-workflow-fixture-state.json",
);

let fixture: WorkflowFixture;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Konfigurasi Supabase untuk E2E belum tersedia.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function login(page: Page) {
  const identifier = process.env.E2E_DINSOS_IDENTIFIER ?? process.env.DINSOS_ADMIN_USERNAME;
  const password = process.env.E2E_DINSOS_PASSWORD ?? process.env.DINSOS_ADMIN_PASSWORD;
  if (!identifier || !password) throw new Error("Credential E2E Admin Dinsos belum tersedia.");
  await page.goto("/login");
  await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dinsos$/);
}

async function logout(page: Page) {
  await page.locator('button[aria-haspopup="menu"]').click();
  await page.getByRole("menuitem", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function assertNoFullNikInDom(page: Page) {
  expect(await page.content()).not.toMatch(/\b\d{16}\b/);
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function fillStructuredAssessment(page: Page, readiness: "high" | "low") {
  for (const section of [
    "2. Pekerjaan",
    "3. Pendidikan",
    "4. Kesehatan",
    "5. Kondisi Keluarga",
    "6. Tempat Tinggal",
    "7. Administrasi",
    "8. Kapasitas Individu",
  ]) {
    const button = page.getByRole("button", { name: new RegExp(section.replace(".", "\\.")) });
    if (await button.getAttribute("aria-expanded") === "false") await button.click();
  }
  await page.getByLabel("Rentang Pendapatan").fill(
    readiness === "high" ? "Pendapatan usaha terverifikasi" : "Belum memiliki pendapatan tetap",
  );
  await page.getByLabel(readiness === "high" ? "Bekerja" : "Tidak Bekerja", { exact: true }).check();
  if (readiness === "high") await page.getByLabel("Jenis Pekerjaan").fill("Usaha mikro mandiri");
  await page.getByLabel("Penghasilan Bulanan *").fill(readiness === "high" ? "Pendapatan stabil" : "Belum berpenghasilan");
  await page.getByLabel("Pendidikan Tertinggi *").fill(readiness === "high" ? "SMA" : "SD");
  await page.getByLabel("Literasi Digital *").selectOption(readiness === "high" ? "MAHIR" : "KURANG");
  await page.getByRole("radio", { name: "Tidak Ada", exact: true }).check();
  await page.getByLabel("Balita Stunting *").selectOption("TIDAK_ADA_BALITA");
  await page.getByLabel("Lansia/Disabilitas Tanpa Pendamping *").selectOption(readiness === "high" ? "TIDAK" : "YA");
  await page.getByLabel("Anak Putus Sekolah *").fill(readiness === "high" ? "0" : "1");
  await page.getByLabel("Kelayakan Rumah *").selectOption(readiness === "high" ? "LAYAK" : "TIDAK_LAYAK");
  await page.getByLabel("Akses Air Bersih & Sanitasi *").selectOption(readiness === "high" ? "MEMADAI" : "TIDAK_MEMADAI");
  await page.getByLabel("NIK Valid").check();
  await page.getByLabel("KK Terbaru").check();
  await page.getByLabel("BPJS Aktif").check();
  await page.getByLabel("Motivasi Perubahan (1–5) *").fill(readiness === "high" ? "5" : "2");
  await page.getByLabel("Keterampilan yang Dimiliki *").fill(
    readiness === "high" ? "Pengelolaan usaha mikro" : "Keterampilan dasar terverifikasi",
  );
  await page.getByLabel("Catatan Petugas").fill(
    readiness === "high"
      ? "Warga existing siap mengikuti inkubasi sosial dan pendampingan usaha."
      : "Warga existing membutuhkan perlindungan dan stabilisasi terlebih dahulu.",
  );
}

function collectSafeApiResponses(page: Page) {
  const payloads: string[] = [];
  page.on("response", async (response) => {
    if (!response.url().includes("/api/dinsos/") || !response.headers()["content-type"]?.includes("application/json")) return;
    try {
      payloads.push(await response.text());
    } catch {
      // A navigation can dispose an already validated response body.
    }
  });
  return payloads;
}

function assertSafeApiPayloads(payloads: string[]) {
  expect(payloads.length).toBeGreaterThan(0);
  for (const payload of payloads) {
    expect(payload).not.toMatch(/\b\d{16}\b/);
    expect(payload).not.toMatch(/"(?:nomor_kk|nomorKk|nomor_hp|nomorHp)"\s*:/i);
  }
}

test.use({ viewport: { width: 1024, height: 1024 } });

test.describe.serial("Dinsos full workflow and final regression", () => {
  test.beforeAll(() => {
    execFileSync(process.execPath, ["scripts/dev/seed-dinsos-full-workflow-fixture.mjs"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe",
    });
    fixture = JSON.parse(readFileSync(fixtureStateFile, "utf8"));
  });

  test.afterAll(() => {
    execFileSync(process.execPath, ["scripts/dev/cleanup-dinsos-full-workflow-fixture.mjs"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe",
    });
  });

  test("visual desktop, mobile, and accessibility smoke", async ({ page }) => {
    await login(page);
    const screens = [
      ["dinsos-antrian", "/dinsos"],
      ["dinsos-warga", "/dinsos/warga"],
      ["dinsos-asesmen", "/dinsos/asesmen"],
      ["dinsos-referral", "/dinsos/referral"],
    ] as const;

    for (const [name, url] of screens) {
      await page.setViewportSize({ width: 1024, height: 1024 });
      await page.goto(url);
      await assertNoFullNikInDom(page);
      await expect(page).toHaveScreenshot(`${name}-1024.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
        maskColor: "#e5e7eb",
        mask: [page.locator("tbody"), page.locator('[class*="mobile"] article')],
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url);
      await assertNoHorizontalOverflow(page);
      await assertNoFullNikInDom(page);
      await expect(page).toHaveScreenshot(`${name}-390.png`, {
        fullPage: false,
        maxDiffPixelRatio: 0.02,
        maskColor: "#e5e7eb",
        mask: [page.locator("tbody"), page.locator('[class*="mobile"] article')],
      });
    }

    await page.setViewportSize({ width: 1024, height: 1024 });
    await page.goto("/dinsos/warga");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).not.toHaveCount(0);
    const registerLink = page.getByRole("link", { name: "Daftarkan Warga Baru" });
    await registerLink.focus();
    await registerLink.click();
    const dialog = page.getByRole("dialog", { name: "Daftarkan Warga Baru" });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog.locator(":focus")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(registerLink).toBeFocused();

    await page.goto(`/dinsos/kasus/${fixture.high.caseId}/asesmen`);
    const kemiskinan = page.getByRole("button", { name: /1\. Kemiskinan/ });
    await expect(kemiskinan).toHaveAttribute("aria-expanded", "true");
    await kemiskinan.click();
    await expect(kemiskinan).toHaveAttribute("aria-expanded", "false");
    await kemiskinan.click();
    await expect(kemiskinan).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("navigation", { name: "Tahapan kasus" }).getByRole("link", { name: "Asesmen Sosial" })).toHaveAttribute("aria-current", "page");
    await logout(page);
  });

  test("full high-readiness path reaches a sent referral", async ({ page }) => {
    const apiPayloads = collectSafeApiResponses(page);
    const db = adminClient();
    await login(page);
    await page.goto(`/dinsos?q=${encodeURIComponent(fixture.high.citizenName)}`);
    await expect(page.getByText(fixture.high.citizenName, { exact: true }).first()).toBeVisible();
    await page.getByRole("row").filter({ hasText: fixture.high.citizenName }).getByRole("link", { name: "Proses" }).click();
    await expect(page.getByRole("heading", { name: "Identitas Pribadi" })).toBeVisible();
    await assertNoFullNikInDom(page);

    await page.getByRole("navigation", { name: "Tahapan kasus" }).getByRole("link", { name: "Asesmen Sosial" }).click();
    await fillStructuredAssessment(page, "high");
    const completionResponse = page.waitForResponse((response) =>
      response.url().includes(`/api/dinsos/cases/${fixture.high.caseId}/assessment/complete`) &&
      response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Selesaikan Asesmen" }).click();
    const completion = await completionResponse;
    expect(completion.status()).toBe(200);
    const completionBody = await completion.json() as { registryAssessmentId: string };
    await expect(page).toHaveURL(new RegExp(`/dinsos/kasus/${fixture.high.caseId}/hasil$`));
    await assertNoFullNikInDom(page);

    const beforeReview = await db.from("dinsos_assessments").select("status").eq("id", completionBody.registryAssessmentId).single();
    expect(beforeReview.error).toBeNull();
    expect(beforeReview.data?.status).toBe("PERLU_REVIEW");

    await page.goto(`/dinsos/asesmen?assessment=${completionBody.registryAssessmentId}&mode=review`);
    const review = page.getByRole("dialog", { name: /Review Asesmen/ });
    await expect(review).toHaveAttribute("aria-modal", "true");
    await review.getByLabel("Tetapkan Jalur MBI *").selectOption("WIRAUSAHA");
    await review.getByLabel("Rencana OPD Rujukan *").selectOption(fixture.targetOpdId);
    await review.getByLabel("Catatan Persetujuan *").fill(
      "Jalur wirausaha disetujui berdasarkan asesmen lapangan terstruktur.",
    );
    const reviewResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/api/dinsos/assessments/${completionBody.registryAssessmentId}/review`) &&
      response.request().method() === "POST",
    );
    await review.getByRole("button", { name: "Setujui & Terbitkan Jalur" }).click();
    expect((await reviewResponse).status()).toBe(200);
    await expect(page.getByRole("dialog", { name: /Detail Asesmen/ })).toBeVisible();

    await page.goto(`/dinsos/kasus/${fixture.high.caseId}/hasil`);
    const confirmResponse = page.waitForResponse((response) =>
      response.url().includes(`/api/dinsos/cases/${fixture.high.caseId}/result/confirm`) &&
      response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Konfirmasi Hasil Desil" }).click();
    expect((await confirmResponse).status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`/dinsos/kasus/${fixture.high.caseId}/referral$`));
    await expect(page.getByText("Hasil Analisis Jalur")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Tahapan kasus" }).getByRole("link", { name: "Split Jalur & Referral" })).toHaveAttribute("aria-current", "page");

    const publishResponse = page.waitForResponse((response) =>
      response.url().includes(`/api/dinsos/cases/${fixture.high.caseId}/path/publish`) &&
      response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Finalisasi Jalur" }).click();
    expect((await publishResponse).status()).toBe(201);
    await expect(page.getByRole("heading", { name: "Menunggu Rujukan" })).toBeVisible();

    const waiting = await db.from("dinsos_cases").select("current_stage").eq("id", fixture.high.caseId).single();
    expect(waiting.error).toBeNull();
    expect(waiting.data?.current_stage).toBe("MENUNGGU_RUJUKAN");

    await page.getByRole("link", { name: "Proses Rujukan" }).click();
    const process = page.getByRole("dialog", { name: /Proses Rujukan Warga/ });
    await expect(process).toHaveAttribute("aria-modal", "true");
    await process.getByLabel("Program Intervensi Spesifik *").selectOption(fixture.programId);
    await process.getByLabel("Catatan Instruksi untuk OPD").fill(
      "Lakukan verifikasi kebutuhan program sesuai hasil asesmen terstruktur.",
    );
    const sendResponse = page.waitForResponse((response) =>
      response.url().includes("/api/dinsos/referrals/") && response.url().endsWith("/send") &&
      response.request().method() === "POST",
    );
    await process.getByRole("button", { name: "Kirim Rujukan ke OPD" }).click();
    expect((await sendResponse).status()).toBe(200);

    const progress = page.getByRole("dialog", { name: /Lacak Progress Referral/ });
    await expect(progress.getByText("TERKIRIM", { exact: true })).toBeVisible();
    await expect(progress.getByText("Asesmen Lapangan Selesai")).toBeVisible();
    await expect(progress.getByText("Disetujui & Diterbitkan Jalur")).toBeVisible();
    await expect(progress.getByText(/Rujukan Dikirim ke/)).toBeVisible();
    await expect(progress.locator('[aria-current="step"]')).toHaveCount(1);
    await assertNoFullNikInDom(page);

    const printHref = await progress.getByRole("link", { name: "Cetak Surat Rujukan" }).getAttribute("href");
    expect(printHref).toBeTruthy();
    const printResponse = await page.request.get(printHref!);
    expect(printResponse.status()).toBe(200);
    expect(await printResponse.text()).not.toMatch(/\b\d{16}\b/);

    const finalState = await db
      .from("dinsos_cases")
      .select("current_stage")
      .eq("id", fixture.high.caseId)
      .single();
    expect(finalState.error).toBeNull();
    expect(finalState.data?.current_stage).toBe("REFERRAL_TERKIRIM");
    assertSafeApiPayloads(apiPayloads);
    await progress.getByRole("link", { name: "Tutup pelacakan referral" }).click();
    await logout(page);
  });

  test("low-readiness path stops at stabilization", async ({ page }) => {
    const db = adminClient();
    await login(page);
    await page.goto(`/dinsos/kasus/${fixture.low.caseId}/asesmen`);
    await fillStructuredAssessment(page, "low");
    await page.getByRole("button", { name: "Selesaikan Asesmen" }).click();
    await expect(page).toHaveURL(new RegExp(`/dinsos/kasus/${fixture.low.caseId}/hasil$`));
    await expect(page.getByText(`Desil ${fixture.low.desil}`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Konfirmasi Hasil Desil" }).click();
    await expect(page).toHaveURL(new RegExp(`/dinsos/kasus/${fixture.low.caseId}/referral$`));
    await expect(page.getByRole("heading", { name: "Perlu Stabilisasi Terlebih Dahulu" })).toBeVisible();
    await page.getByRole("button", { name: "Kirim ke Proteksi & Stabilisasi" }).click();
    await expect(page.getByRole("heading", { name: "Referral Proteksi & Stabilisasi Telah Dikirim" })).toBeVisible();
    const state = await db.from("dinsos_cases").select("current_stage").eq("id", fixture.low.caseId).single();
    expect(state.error).toBeNull();
    expect(state.data?.current_stage).toBe("MENUNGGU_STABILISASI");
    await assertNoFullNikInDom(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await assertNoHorizontalOverflow(page);
    await logout(page);
  });
});
