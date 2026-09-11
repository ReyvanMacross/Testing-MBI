import { expect, test, type Browser, type Page } from "@playwright/test";

type Account = {
  name: string;
  identifier: string | undefined;
  password: string | undefined;
  home: string;
  blockedRoute: string;
  heading: string;
};

const accounts: Account[] = [
  {
    name: "Diskominfo",
    identifier: process.env.E2E_ADMIN_IDENTIFIER ?? "admin.mbi",
    password: process.env.E2E_ADMIN_PASSWORD ?? process.env.SUPABASE_TEST_PASSWORD,
    home: "/diskominfo",
    blockedRoute: "/dinsos",
    heading: "Dashboard Diskominfo",
  },
  {
    name: "Dinsos",
    identifier: process.env.E2E_DINSOS_IDENTIFIER ?? process.env.DINSOS_ADMIN_USERNAME,
    password: process.env.E2E_DINSOS_PASSWORD ?? process.env.DINSOS_ADMIN_PASSWORD,
    home: "/dinsos",
    blockedRoute: "/disnaker",
    heading: "Antrian Kerja Harian",
  },
  {
    name: "Disnaker",
    identifier: process.env.E2E_DISNAKER_IDENTIFIER,
    password: process.env.E2E_DISNAKER_PASSWORD,
    home: "/disnaker",
    blockedRoute: "/diskop",
    heading: "Rujukan Masuk & Intervensi",
  },
  {
    name: "Diskop UKM",
    identifier: process.env.E2E_DISKOP_IDENTIFIER,
    password: process.env.E2E_DISKOP_PASSWORD,
    home: "/diskop",
    blockedRoute: "/disdik",
    heading: "Rujukan Masuk & Intervensi",
  },
  {
    name: "Disdik",
    identifier: process.env.E2E_DISDIK_IDENTIFIER,
    password: process.env.E2E_DISDIK_PASSWORD,
    home: "/disdik",
    blockedRoute: "/diskominfo",
    heading: "Rujukan Masuk & Intervensi",
  },
  {
    name: "Kecamatan",
    identifier: process.env.E2E_KECAMATAN_IDENTIFIER || process.env.KECAMATAN_ADMIN_USERNAME || "admin.kecamatan",
    password: process.env.E2E_KECAMATAN_PASSWORD || process.env.KECAMATAN_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD,
    home: "/kecamatan",
    blockedRoute: "/dp3a",
    heading: "Antrian Kerja Kewilayahan",
  },
  {
    name: "DP3A",
    identifier: process.env.E2E_DP3A_IDENTIFIER || process.env.DP3A_ADMIN_USERNAME || "admin.dp3a",
    password: process.env.E2E_DP3A_PASSWORD || process.env.DP3A_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD,
    home: "/dp3a",
    blockedRoute: "/kecamatan",
    heading: "Rujukan Masuk & Penanganan Kasus",
  },
  {
    name: "Disdagin",
    identifier: process.env.E2E_DISDAGIN_IDENTIFIER || process.env.DISDAGIN_ADMIN_USERNAME || "admin.disdagin",
    password: process.env.E2E_DISDAGIN_PASSWORD || process.env.DISDAGIN_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD,
    home: "/disdagin",
    blockedRoute: "/dp3a",
    heading: "Rujukan Masuk & Intervensi",
  },
];

async function login(page: Page, account: Account) {
  if (!account.identifier || !account.password) {
    throw new Error(`Credential E2E ${account.name} belum tersedia.`);
  }
  await page.goto("/login");
  await page.getByLabel("Nama Pengguna atau NIP").fill(account.identifier);
  await page.getByLabel("Kata Sandi", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${account.home}$`, "u"), { timeout: 15_000 });
}

async function verifyAccountBoundary(browser: Browser, account: Account) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await login(page, account);
    await expect(page.getByRole("heading", { name: account.heading }).first()).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/u);

    await page.goto(account.blockedRoute);
    await expect(page).toHaveURL(new RegExp(`${account.home}$`, "u"));
  } finally {
    await context.close();
  }
}

test("routing dan isolasi peran seluruh OPD tetap konsisten setelah integrasi", async ({ browser }) => {
  for (const account of accounts) {
    await verifyAccountBoundary(browser, account);
  }
});
