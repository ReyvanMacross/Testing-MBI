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
  {
    name: "DKPP",
    identifier: process.env.E2E_DKPP_IDENTIFIER || process.env.DKPP_ADMIN_USERNAME || "admin.dkpp",
    password: process.env.E2E_DKPP_PASSWORD || process.env.DKPP_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD,
    home: "/dkpp",
    blockedRoute: "/disdagin",
    heading: "Rujukan Masuk & Intervensi",
  },
  {
    name: "Disbudpar",
    identifier: process.env.E2E_DISBUDPAR_IDENTIFIER || process.env.DISBUDPAR_ADMIN_USERNAME || "admin.disbudpar",
    password: process.env.E2E_DISBUDPAR_PASSWORD || process.env.DISBUDPAR_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD,
    home: "/disbudpar",
    blockedRoute: "/dkpp",
    heading: "Rujukan Masuk & Intervensi",
  },
  {
    name: "Cipta Bintar",
    identifier: process.env.E2E_CIPTA_BINTAR_IDENTIFIER || process.env.CIPTA_BINTAR_ADMIN_USERNAME || "admin.cipta-bintar",
    password: process.env.E2E_CIPTA_BINTAR_PASSWORD || process.env.CIPTA_BINTAR_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD,
    home: "/cipta-bintar",
    blockedRoute: "/disbudpar",
    heading: "Rujukan Masuk & Intervensi",
  },
  {
    name: "Bapperida",
    identifier: process.env.E2E_BAPPERIDA_IDENTIFIER || process.env.BAPPERIDA_ADMIN_USERNAME || "admin.bapperida",
    password: process.env.E2E_BAPPERIDA_PASSWORD || process.env.BAPPERIDA_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD,
    home: "/bapperida",
    blockedRoute: "/cipta-bintar",
    heading: "Dashboard Outcome",
  },
  {
    name: "Wali Kota",
    identifier: process.env.E2E_WALIKOTA_IDENTIFIER || process.env.WALIKOTA_ADMIN_USERNAME || "admin.walikota",
    password: process.env.E2E_WALIKOTA_PASSWORD || process.env.WALIKOTA_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD,
    home: "/walikota",
    blockedRoute: "/bapperida",
    heading: "Dashboard Eksekutif",
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
  await expect(page).toHaveURL(new RegExp(`${account.home}$`, "u"), { timeout: 30_000 });
}

async function verifyDiskominfoMapRegression(page: Page) {
  for (const [url, heading] of [
    ["/diskominfo/peta", "Peta Sebaran Desil"],
    ["/diskominfo/peta?kecamatan=Coblong", "Peta Sebaran Desil"],
    ["/diskominfo/peta?kecamatan=Andir", "Peta Sebaran Desil"],
  ] as const) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  await page.setViewportSize({ width: 390, height: 844 });
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

    if (url === "/diskominfo/peta") {
      const labels = page.locator("[data-label-kecamatan]");
      await expect(labels).toHaveCount(30);
      const visibleLabels = await labels.evaluateAll((items) =>
        items.filter((item) => {
          const style = getComputedStyle(item);
          const bounds = item.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            bounds.width > 2 &&
            bounds.height > 2
          );
        }).length,
      );
      expect(visibleLabels, "Semua label kecamatan harus terlihat di mobile").toBe(30);
    }
  }
}

async function verifyAccountBoundary(browser: Browser, account: Account) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await login(page, account);
    await expect(page.getByRole("heading", { name: account.heading }).first()).toBeVisible();
    expect(await page.content()).not.toMatch(/\b\d{16}\b/u);

    if (account.name === "Diskominfo") {
      await verifyDiskominfoMapRegression(page);
    }

    await page.goto(account.blockedRoute);
    await expect(page).toHaveURL(new RegExp(`${account.home}$`, "u"));
  } finally {
    await context.close();
  }
}

test("routing dan isolasi peran seluruh OPD tetap konsisten setelah integrasi", async ({ browser }) => {
  test.setTimeout(180_000);
  for (const account of accounts) {
    await verifyAccountBoundary(browser, account);
  }
});
