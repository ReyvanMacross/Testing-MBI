import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

type FixtureState={workflow:string;override:string;referral:string};
const artifactDir=path.join(process.cwd(),"artifacts","dinsos");
let fixture:FixtureState;

async function login(page:import("@playwright/test").Page,identifier:string,password:string){await page.goto("/login");await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);await page.getByLabel("Kata Sandi",{exact:true}).fill(password);await page.getByRole("button",{name:"Masuk",exact:true}).click();await expect(page).toHaveURL(/\/(?:diskominfo|dinsos)$/);}
async function logout(page:import("@playwright/test").Page){await page.locator('button[aria-haspopup="menu"]').click();await page.getByRole("menuitem",{name:"Keluar"}).click();await expect(page).toHaveURL(/\/login$/);}
test.use({ viewport: { width: 1024, height: 1024 } });

test.describe.serial("Dinas Sosial workflow",()=>{
  test.beforeAll(()=>{mkdirSync(artifactDir,{recursive:true});execFileSync(process.execPath,["scripts/dev/seed-dinsos-fixtures.mjs"],{cwd:process.cwd(),env:process.env,stdio:"pipe"});fixture=JSON.parse(readFileSync(path.join(artifactDir,"fixture-state.json"),"utf8"));});
  test.afterAll(()=>{execFileSync(process.execPath,["scripts/dev/cleanup-dinsos-fixtures.mjs"],{cwd:process.cwd(),env:process.env,stdio:"pipe"});});

  test("Admin Dinsos completes assessment and stabilization handoff",async({page})=>{const identifier=process.env.E2E_DINSOS_IDENTIFIER??process.env.DINSOS_ADMIN_USERNAME;const password=process.env.E2E_DINSOS_PASSWORD??process.env.DINSOS_ADMIN_PASSWORD;if(!identifier||!password)throw new Error("Credential E2E Dinsos belum tersedia.");await login(page,identifier,password);await expect(page).toHaveURL(/\/dinsos$/);await expect(page.getByRole("heading",{name:"Antrian Kerja Harian"})).toBeVisible();await page.screenshot({path:path.join(artifactDir,"01-antrian-desktop.png"),fullPage:true});
    await page.goto(`/dinsos/kasus/${fixture.workflow}`);await expect(page.getByRole("heading",{level:2,name:"Identitas Pribadi"})).toBeVisible();const fotoProfil=page.getByRole("region",{name:"Identitas kasus"}).getByRole("img");await expect(fotoProfil).toBeVisible();await expect.poll(()=>fotoProfil.locator("img").first().evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);await page.screenshot({path:path.join(artifactDir,"02-data-warga-desktop.png"),fullPage:true});
    await page.getByRole("navigation",{name:"Tahapan kasus"}).getByRole("link",{name:"Asesmen Sosial"}).click();await expect(page.getByRole("heading",{name:"Formulir Asesmen Sosial"})).toBeVisible();for(const section of ["2. Pekerjaan","3. Pendidikan","4. Kesehatan","5. Kondisi Keluarga","6. Tempat Tinggal","7. Administrasi","8. Kapasitas Individu"]){const button=page.getByRole("button",{name:new RegExp(section.replace(".","\\."))});if(await button.getAttribute("aria-expanded")==="false")await button.click();}
    await page.getByLabel("Rentang Pendapatan").fill("Rentang sesuai verifikasi lokal");await page.getByLabel("Tidak Bekerja").check();await page.getByLabel("Penghasilan Bulanan *").fill("Belum berpenghasilan");await page.getByLabel("Pendidikan Tertinggi *").fill("SMA");await page.getByLabel("Literasi Digital *").selectOption("CUKUP");await page.getByRole("radio",{name:"Tidak Ada",exact:true}).check();await page.getByLabel("Balita Stunting *").selectOption("TIDAK_ADA_BALITA");await page.getByLabel("Lansia/Disabilitas Tanpa Pendamping *").selectOption("TIDAK");await page.getByLabel("Anak Putus Sekolah *").fill("0");await page.getByLabel("Kelayakan Rumah *").selectOption("LAYAK");await page.getByLabel("Akses Air Bersih & Sanitasi *").selectOption("MEMADAI");for(const label of ["NIK Valid","KK Terbaru","BPJS Aktif"]){await page.getByLabel(label).check();}await page.getByLabel("Motivasi Perubahan (1–5) *").fill("4");await page.getByLabel("Keterampilan yang Dimiliki *").fill("Keterampilan warga terverifikasi");await page.getByRole("button",{name:"Simpan sebagai Draft"}).click();await expect(page.getByText("Draft asesmen berhasil disimpan.")).toBeVisible();await page.screenshot({path:path.join(artifactDir,"03-asesmen-desktop.png"),fullPage:true});await page.getByRole("button",{name:"Selesaikan Asesmen"}).click();await expect(page).toHaveURL(new RegExp(`/dinsos/kasus/${fixture.workflow}/hasil$`));await expect(page.getByText(/Desil [12]/)).toBeVisible();await page.screenshot({path:path.join(artifactDir,"04-hasil-desktop.png"),fullPage:true});await page.getByRole("button",{name:"Konfirmasi Hasil Desil"}).click();await expect(page).toHaveURL(new RegExp(`/dinsos/kasus/${fixture.workflow}/referral$`));await page.screenshot({path:path.join(artifactDir,"05-referral-desktop.png"),fullPage:true});await page.getByRole("button",{name:"Kirim ke Proteksi & Stabilisasi"}).click();await expect(page.getByRole("heading",{name:"Referral Proteksi & Stabilisasi Telah Dikirim"})).toBeVisible();
    await page.setViewportSize({width:390,height:844});for(const [name,url] of [["antrian","/dinsos"],["data-warga",`/dinsos/kasus/${fixture.workflow}`],["asesmen",`/dinsos/kasus/${fixture.workflow}/asesmen`],["hasil",`/dinsos/kasus/${fixture.workflow}/hasil`],["referral",`/dinsos/kasus/${fixture.workflow}/referral`]] as const){await page.goto(url);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);expect(overflow,`${name} overflow`).toBeLessThanOrEqual(1);await page.screenshot({path:path.join(artifactDir,`mobile-${name}.png`),fullPage:true});}
    await logout(page);
  });

  test("Role and API isolation are enforced",async({browser,request})=>{const appOrigin=process.env.APP_ORIGIN??"http://localhost:3000";const unauth=await request.post(`${appOrigin}/api/dinsos/cases/${fixture.workflow}/assessment/draft`,{headers:{Origin:appOrigin,"Sec-Fetch-Site":"same-origin"},data:{}});expect(unauth.status()).toBe(401);const unauthDocument=await request.get(`${appOrigin}/api/dinsos/cases/${fixture.workflow}/documents/ktp`);expect(unauthDocument.status()).toBe(401);
    const diskPage=await browser.newPage();const adminPassword=process.env.E2E_ADMIN_PASSWORD??process.env.SUPABASE_TEST_PASSWORD;if(!adminPassword)throw new Error("Credential Diskominfo hilang.");await login(diskPage,process.env.E2E_ADMIN_IDENTIFIER??"admin.mbi",adminPassword);const diskApiStatus=await diskPage.evaluate(async(caseId)=>{const response=await fetch(`/api/dinsos/cases/${caseId}/assessment/draft`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});return response.status;},fixture.workflow);expect(diskApiStatus).toBe(403);await diskPage.goto("/dinsos");await expect(diskPage).toHaveURL(/\/diskominfo$/);await diskPage.close();
    const dinsosPage=await browser.newPage();const dinsosPassword=process.env.E2E_DINSOS_PASSWORD??process.env.DINSOS_ADMIN_PASSWORD;if(!dinsosPassword)throw new Error("Credential Dinsos hilang.");await login(dinsosPage,process.env.E2E_DINSOS_IDENTIFIER??"admin.dinsos",dinsosPassword);const dinsosApiStatus=await dinsosPage.evaluate(async()=>{const response=await fetch("/api/admin/integrations",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});return response.status;});expect(dinsosApiStatus).toBe(403);await dinsosPage.goto("/diskominfo");await expect(dinsosPage).toHaveURL(/\/dinsos$/);await dinsosPage.close();
  });

  test("Admin Dinsos can inspect the citizen registry without exposing identifiers",async({page})=>{
    const identifier=process.env.E2E_DINSOS_IDENTIFIER??process.env.DINSOS_ADMIN_USERNAME;
    const password=process.env.E2E_DINSOS_PASSWORD??process.env.DINSOS_ADMIN_PASSWORD;
    if(!identifier||!password)throw new Error("Credential E2E Dinsos belum tersedia.");
    await login(page,identifier,password);
    await page.goto("/dinsos/warga");
    await expect(page.getByRole("heading",{name:"Data Warga"})).toBeVisible();
    await expect(page.getByText("Total Warga Terdaftar")).toBeVisible();
    const firstRow=page.getByRole("table").locator("tbody tr").first();
    const citizenName=(await firstRow.locator("td").nth(1).innerText()).trim();
    await page.getByLabel("Cari Warga").fill(citizenName);
    await page.getByRole("button",{name:/Filter/}).click();
    await expect(page.getByRole("table").getByText(citizenName,{exact:true}).first()).toBeVisible();
    await page.screenshot({path:path.join(artifactDir,"06-data-warga-registry-desktop.png"),fullPage:true});
    await Promise.all([
      page.waitForURL(/warga=/),
      page.getByRole("link",{name:/Detail/}).first().click(),
    ]);
    const drawer=page.getByRole("dialog",{name:new RegExp(`Profil Warga.*${citizenName}`)});
    await expect(drawer).toBeVisible();
    const drawerText=await drawer.innerText();
    expect(drawerText).toMatch(/x{4,}/);
    expect(drawerText).not.toMatch(/\b\d{16}\b/);
    await page.screenshot({path:path.join(artifactDir,"07-data-warga-profile-desktop.png"),fullPage:true});
    await Promise.all([
      page.waitForURL(/mode=edit/),
      drawer.getByRole("link",{name:"Edit Data"}).click(),
    ]);
    const dialog=page.getByRole("dialog",{name:"Edit Data Warga"});
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Nomor Induk Kependudukan (NIK)")).toHaveAttribute("readonly","");
    await page.screenshot({path:path.join(artifactDir,"08-edit-warga-desktop.png"),fullPage:true});
    await dialog.getByRole("button",{name:"Tutup Edit Data Warga"}).click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link",{name:"Tutup profil warga"}).click();
    await page.setViewportSize({width:390,height:844});
    await page.goto("/dinsos/warga");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:path.join(artifactDir,"09-data-warga-registry-mobile.png"),fullPage:true});
    await Promise.all([
      page.waitForURL(/warga=/),
      page.getByRole("link",{name:"Detail",exact:true}).first().click(),
    ]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:path.join(artifactDir,"10-data-warga-profile-mobile.png")});
    await Promise.all([
      page.waitForURL(/mode=edit/),
      page.getByRole("link",{name:"Edit Data"}).click(),
    ]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:path.join(artifactDir,"11-edit-warga-mobile.png")});
    await page.getByRole("button",{name:"Tutup Edit Data Warga"}).click();
    await page.getByRole("link",{name:"Tutup profil warga"}).click();
    await logout(page);
  });
});

type AssessmentFixtureState = {
  needsReview: { id: string; assessment_code: string; warga_id: string };
};

test.describe.serial("Dinas Sosial assessment registry", () => {
  let assessmentFixture: AssessmentFixtureState;
  let createdAssessmentId: string | undefined;

  test.beforeAll(() => {
    execFileSync(process.execPath, ["scripts/dev/seed-dinsos-assessment-fixtures.mjs"], {
      cwd: process.cwd(), env: process.env, stdio: "pipe",
    });
    assessmentFixture = JSON.parse(
      readFileSync(path.join(artifactDir, "assessment-fixture-state.json"), "utf8"),
    );
  });

  test.afterAll(async () => {
    if (createdAssessmentId && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      await admin.from("dinsos_assessments").delete().eq("id", createdAssessmentId);
    }
    execFileSync(process.execPath, ["scripts/dev/cleanup-dinsos-assessment-fixtures.mjs"], {
      cwd: process.cwd(), env: process.env, stdio: "pipe",
    });
  });

  test("Admin Dinsos creates, reviews, inspects, and prints an assessment", async ({ page, context }) => {
    const identifier = process.env.E2E_DINSOS_IDENTIFIER ?? process.env.DINSOS_ADMIN_USERNAME;
    const password = process.env.E2E_DINSOS_PASSWORD ?? process.env.DINSOS_ADMIN_PASSWORD;
    if (!identifier || !password) throw new Error("Credential E2E Dinsos belum tersedia.");
    await login(page, identifier, password);

    await page.goto("/dinsos/asesmen");
    await expect(page.getByRole("heading", { name: "Asesmen Sosial" })).toBeVisible();
    await expect(page.getByText("Total Asesmen Tahun Ini")).toBeVisible();
    await page.screenshot({ path: path.join(artifactDir, "12-asesmen-registry-desktop.png"), fullPage: true });

    await page.goto(`/dinsos/warga?warga=${assessmentFixture.needsReview.warga_id}`);
    const profileDrawer = page.getByRole("dialog", { name: /Profil Warga/ });
    await expect(profileDrawer).toBeVisible();
    await profileDrawer.getByRole("link", { name: "Buat Asesmen Baru" }).click();
    const createDialog = page.getByRole("dialog", { name: "Buat Asesmen Baru" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Jenis Asesmen *").selectOption("INTERVENSI_MBI");
    await createDialog.getByLabel("Catatan/Hasil Observasi *").fill(
      "Observasi E2E terverifikasi untuk alur registry dan review supervisor Dinsos.",
    );
    await createDialog.getByLabel("Rekomendasi Jalur Intervensi *").selectOption("WIRAUSAHA");
    const createResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/dinsos/assessments") && response.request().method() === "POST",
    );
    await createDialog.getByRole("button", { name: "Simpan Asesmen" }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();
    createdAssessmentId = created.assessmentId;
    await expect(page).toHaveURL(new RegExp(`assessment=${createdAssessmentId}`));
    await page.screenshot({ path: path.join(artifactDir, "13-asesmen-detail-desktop.png"), fullPage: true });

    await page.getByRole("link", { name: "Tutup detail asesmen" }).click();
    await page.getByLabel("Cari Asesmen").fill(created.assessmentCode);
    await page.getByLabel("Status").selectOption("PERLU_REVIEW");
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    await page.getByRole("link", { name: `Review ${created.assessmentCode}` }).click();
    const reviewDrawer = page.getByRole("dialog", { name: created.assessmentCode });
    await expect(reviewDrawer).toBeVisible();
    await reviewDrawer.getByLabel("Tetapkan Jalur MBI *").selectOption("WIRAUSAHA");
    await reviewDrawer.getByLabel("Rencana OPD Rujukan *").selectOption({ index: 1 });
    await reviewDrawer.getByLabel("Catatan Persetujuan *").fill(
      "Jalur Wirausaha disetujui berdasarkan observasi yang telah direview.",
    );
    await page.screenshot({ path: path.join(artifactDir, "14-asesmen-review-desktop.png"), fullPage: true });
    await reviewDrawer.getByRole("button", { name: "Setujui & Terbitkan Jalur" }).click();
    const detailDrawer = page.getByRole("dialog", { name: created.assessmentCode });
    await expect(detailDrawer.getByText("WIRAUSAHA", { exact: true }).last()).toBeVisible();

    const [printPage] = await Promise.all([
      context.waitForEvent("page"),
      detailDrawer.getByRole("link", { name: "Cetak Laporan (PDF)" }).click(),
    ]);
    await printPage.waitForLoadState("domcontentloaded");
    await expect(printPage.getByRole("heading", { name: "Laporan Asesmen Sosial" })).toBeVisible();
    await printPage.close();

    await detailDrawer.getByRole("link", { name: "Tutup detail asesmen" }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dinsos/asesmen");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(artifactDir, "15-asesmen-registry-mobile.png"), fullPage: true });
    await page.getByRole("link", { name: /Detail|Review/ }).first().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(artifactDir, "16-asesmen-detail-mobile.png"), fullPage: true });
    await page.getByRole("link", { name: /Tutup (detail|review) asesmen/ }).click();
    await logout(page);
  });
});

type PathFixtureState = {
  wirausaha: {
    caseId: string;
    assessmentId: string;
    assessmentCode: string;
    targetOpdId: string;
  };
};

test.describe.serial("Dinas Sosial split path", () => {
  let pathFixture: PathFixtureState;

  test.beforeAll(() => {
    execFileSync(process.execPath, ["scripts/dev/seed-dinsos-program-fixtures.mjs"], {
      cwd: process.cwd(), env: process.env, stdio: "pipe",
    });
    execFileSync(process.execPath, ["scripts/dev/seed-dinsos-path-fixtures.mjs"], {
      cwd: process.cwd(), env: process.env, stdio: "pipe",
    });
    pathFixture = JSON.parse(
      readFileSync(path.join(artifactDir, "path-fixture-state.json"), "utf8"),
    );
  });

  test.afterAll(() => {
    execFileSync(process.execPath, ["scripts/dev/cleanup-dinsos-path-fixtures.mjs"], {
      cwd: process.cwd(), env: process.env, stdio: "pipe",
    });
    execFileSync(process.execPath, ["scripts/dev/cleanup-dinsos-program-fixtures.mjs"], {
      cwd: process.cwd(), env: process.env, stdio: "pipe",
    });
  });

  test("Admin Dinsos publishes an approved path referral", async ({ page }) => {
    const identifier = process.env.E2E_DINSOS_IDENTIFIER ?? process.env.DINSOS_ADMIN_USERNAME;
    const password = process.env.E2E_DINSOS_PASSWORD ?? process.env.DINSOS_ADMIN_PASSWORD;
    if (!identifier || !password) throw new Error("Credential E2E Dinsos belum tersedia.");
    await login(page, identifier, password);

    await page.goto(`/dinsos/asesmen?assessment=${pathFixture.wirausaha.assessmentId}`);
    const detail = page.getByRole("dialog", { name: pathFixture.wirausaha.assessmentCode });
    await expect(detail).toBeVisible();
    await detail.getByRole("link", { name: "Lanjut ke Split Jalur" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/dinsos/kasus/${pathFixture.wirausaha.caseId}/referral$`),
    );
    await expect(page.getByText("Hasil Analisis Jalur")).toBeVisible();
    await expect(page.getByText("Jalur Wirausaha", { exact: true })).toBeVisible();
    await expect(page.getByText("85/100")).toBeVisible();
    await expect(page.getByLabel("Jalur Intervensi *")).toHaveValue("WIRAUSAHA");
    await expect(page.getByLabel("Ditujukan ke OPD *")).toHaveValue(
      pathFixture.wirausaha.targetOpdId,
    );
    await page.screenshot({
      path: path.join(artifactDir, "17-split-jalur-desktop.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: path.join(artifactDir, "18-split-jalur-mobile.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    const publishResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/dinsos/cases/${pathFixture.wirausaha.caseId}/path/publish`) &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Finalisasi Jalur" }).click();
    expect((await publishResponse).status()).toBe(201);
    await expect(page.getByRole("heading", { name: "Menunggu Rujukan" })).toBeVisible();
    await expect(page.getByText(/REF-\d{4}-\d{6}/)).toBeVisible();
    await page.screenshot({
      path: path.join(artifactDir, "19-referral-menunggu-desktop.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: path.join(artifactDir, "20-referral-menunggu-mobile.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("link", { name: "Proses Rujukan" }).click();
    await expect(page.getByRole("heading", { name: "Split Jalur & Referral" })).toBeVisible();
    const processDialog = page.getByRole("dialog", { name: /REF-\d{4}-\d{6}/ });
    await expect(processDialog).toBeVisible();
    await processDialog.getByLabel("Program Intervensi Spesifik *").selectOption({ label: "DEV Pendampingan Modal UMKM" });
    await processDialog.getByLabel("Catatan Instruksi untuk OPD").fill("Instruksi E2E minimal tanpa data pribadi warga.");
    await page.screenshot({ path: path.join(artifactDir, "21-proses-rujukan-desktop.png"), fullPage: true });
    const sendResponse = page.waitForResponse((response) => response.url().includes("/api/dinsos/referrals/") && response.url().endsWith("/send") && response.request().method() === "POST");
    await processDialog.getByRole("button", { name: "Kirim Rujukan ke OPD" }).click();
    expect((await sendResponse).status()).toBe(200);
    const progressDialog = page.getByRole("dialog", { name: /REF-\d{4}-\d{6}/ });
    await expect(progressDialog.getByText("TERKIRIM", { exact: true })).toBeVisible();
    await expect(progressDialog.getByText("Asesmen Lapangan Selesai")).toBeVisible();
    await expect(progressDialog.getByText("Disetujui & Diterbitkan Jalur")).toBeVisible();
    await expect(progressDialog.getByText(/Rujukan Dikirim ke/)).toBeVisible();
    const printHref = await progressDialog.getByRole("link", { name: "Cetak Surat Rujukan" }).getAttribute("href");
    expect(printHref).toBeTruthy();
    const printResponse = await page.request.get(printHref!);
    expect(printResponse.status()).toBe(200);
    await page.screenshot({ path: path.join(artifactDir, "22-progress-referral-desktop.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(artifactDir, "23-progress-referral-mobile.png"), fullPage: true });

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const result = await admin
        .from("dinsos_cases")
        .select("current_stage")
        .eq("id", pathFixture.wirausaha.caseId)
        .single();
      expect(result.error).toBeNull();
      expect(result.data?.current_stage).toBe("REFERRAL_TERKIRIM");
    }

    await page.getByRole("link", { name: "Tutup pelacakan referral" }).click();
    await logout(page);
  });
});
