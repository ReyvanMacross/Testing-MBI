import { expect, test } from "@playwright/test";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  const identifier = process.env.E2E_ADMIN_IDENTIFIER ?? "admin.mbi";
  const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.SUPABASE_TEST_PASSWORD;
  if (!password) throw new Error("E2E admin password is missing.");

  await page.getByLabel("Nama Pengguna atau NIP").fill(identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/diskominfo$/);
}

test("Admin Diskominfo can traverse all frozen MVP modules and logout", async ({
  page,
}) => {
  await page.goto("/diskominfo");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Masuk" })).toBeVisible();

  await loginAsAdmin(page);
  await expect(
    page.getByRole("heading", { name: "Dashboard Diskominfo" }),
  ).toBeVisible();

  for (const [url, heading] of [
    ["/diskominfo/peta", "Peta Sebaran Desil"],
    ["/diskominfo/peta?kecamatan=Coblong", "Peta Sebaran Desil"],
    ["/diskominfo/peta?kecamatan=Andir", "Peta Sebaran Desil"],
    ["/diskominfo/pengguna", "Manajemen Pengguna"],
    ["/diskominfo/log-aktivitas", "Log Aktivitas"],
    ["/diskominfo/integrasi-api", "Integrasi API"],
  ] as const) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Masuk" })).toBeVisible();
});

test("Frozen MVP routes do not overflow a 390px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await loginAsAdmin(page);

  for (const url of [
    "/diskominfo",
    "/diskominfo/peta",
    "/diskominfo/peta?kecamatan=Coblong",
    "/diskominfo/pengguna",
    "/diskominfo/log-aktivitas",
    "/diskominfo/integrasi-api",
  ]) {
    await page.goto(url);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${url} has horizontal overflow`).toBeLessThanOrEqual(1);
  }

  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
