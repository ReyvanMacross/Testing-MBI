import { readFileSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "@playwright/test";

function loadEnvironmentFile(file: string) {
  try {
    for (const sourceLine of readFileSync(path.join(process.cwd(), file), "utf8").split(/\r?\n/u)) {
      const line = sourceLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const name = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[name] ??= value;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

loadEnvironmentFile(".env.test.local");
loadEnvironmentFile(".env.local");

const baseURL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const testPort = new URL(baseURL).port || "3000";

if (!/^\d+$/u.test(testPort)) {
  throw new Error("Port MBI_TEST_BASE_URL tidak valid.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run start -- --port ${testPort}`,
    url: `${baseURL}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
