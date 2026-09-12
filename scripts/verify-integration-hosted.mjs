import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";

import {
  cleanupIntegrationBaseFixtures,
  seedIntegrationBaseFixtures,
} from "./dev/integration-base-fixture-lib.mjs";
import { seedStagingWargaDemo } from "./dev/staging-warga-demo-lib.mjs";
import { loadProjectEnvironment, PROJECT_ROOT } from "./lib/project-env.mjs";

await loadProjectEnvironment();
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "Jalankan verifikasi melalui npm run verify:integration-hosted.");
const baseUrl = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const testUrl = new URL(baseUrl);
const testPort = testUrl.port || "3000";
process.env.APP_ORIGIN ??= testUrl.origin;

assert.match(testPort, /^\d+$/u, "Port MBI_TEST_BASE_URL tidak valid.");
assert.equal(
  new URL(process.env.APP_ORIGIN).origin,
  testUrl.origin,
  "APP_ORIGIN harus sama dengan origin MBI_TEST_BASE_URL.",
);

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: "inherit",
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} berhenti dengan ${signal ?? `exit ${code}`}.`));
    });
  });
}

async function runNpmScript(script) {
  await runProcess(process.execPath, [npmCli, "run", script]);
}

async function serverIsReady() {
  try {
    const response = await fetch(`${baseUrl}/login`, { redirect: "manual" });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

async function startServer() {
  if (await serverIsReady()) return null;
  const nextCli = path.join(PROJECT_ROOT, "node_modules", "next", "dist", "bin", "next");
  const server = spawn(process.execPath, [nextCli, "start", "--port", testPort], {
    cwd: PROJECT_ROOT,
    env: process.env,
    stdio: "inherit",
  });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Server integrasi berhenti dengan exit ${server.exitCode}.`);
    if (await serverIsReady()) return server;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  server.kill();
  throw new Error("Server integrasi tidak siap dalam 60 detik.");
}

const workflowScripts = [
  "staging:audit-integration",
  "test:dinsos",
  "test:dinsos-warga",
  "test:dinsos-assessments",
  "test:dinsos-paths",
  "test:dinsos-referrals",
  "test:dinsos-concurrency",
  "test:disnaker",
  "test:disnaker-concurrency",
  "test:diskop",
  "test:diskop-concurrency",
  "test:disdik",
  "test:disdik-concurrency",
  "test:kecamatan",
  "test:kecamatan-concurrency",
  "test:dp3a",
  "test:dp3a-concurrency",
  "test:disdagin",
  "test:disdagin-concurrency",
  "test:dkpp",
  "test:dkpp-concurrency",
  "test:disbudpar",
  "test:disbudpar-concurrency",
  "test:cipta-bintar",
  "test:cipta-bintar-concurrency",
  "test:bapperida",
  "test:bapperida-concurrency",
  "staging:seed-bapperida-demo",
  "test:walikota",
  "test:walikota-concurrency",
  "staging:seed-walikota-demo",
  "test:e2e:integration",
  "test:e2e:kecamatan",
  "test:e2e:dp3a",
  "test:e2e:kecamatan-dp3a",
  "test:e2e:disdagin",
  "test:e2e:dkpp",
  "test:e2e:disbudpar",
  "test:e2e:cipta-bintar",
  "test:e2e:bapperida",
  "test:e2e:walikota",
];

let server;
let primaryError;
try {
  const demo = await seedStagingWargaDemo();
  console.log(`Warga prototype staging tersedia: ${demo.citizens}.`);
  const count = await seedIntegrationBaseFixtures();
  console.log(`Fixture dasar integrasi dibuat: ${count} warga sintetis.`);
  server = await startServer();
  for (const script of workflowScripts) await runNpmScript(script);
  const cleaned = await cleanupIntegrationBaseFixtures();
  console.log(`Fixture dasar integrasi dibersihkan: ${cleaned} warga sintetis.`);
  await runNpmScript("staging:audit-warga");
  await runNpmScript("staging:audit-integration");
} catch (error) {
  primaryError = error;
} finally {
  if (server) server.kill();
  try {
    await cleanupIntegrationBaseFixtures();
  } catch (cleanupError) {
    if (!primaryError) primaryError = cleanupError;
    else console.error("Cleanup fixture dasar juga gagal:", cleanupError);
  }
}
if (primaryError) throw primaryError;

console.log("Hosted integration workflow, concurrency, E2E, dan cleanup: PASS");
