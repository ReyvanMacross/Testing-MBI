import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { loadProjectEnvironment, PROJECT_ROOT } from "./lib/project-env.mjs";

await loadProjectEnvironment();

const git = spawnSync("git", ["ls-files", "-z"], {
  cwd: PROJECT_ROOT,
  encoding: "utf8",
});
assert.equal(git.status, 0, "Git tracked-file inventory is unavailable.");

const files = git.stdout.split("\0").filter(Boolean);
const secretValues = Object.entries(process.env)
  .filter(
    ([name, value]) =>
      /(SECRET|PASSWORD|TOKEN|PRIVATE|API_KEY)/i.test(name) &&
      typeof value === "string" &&
      value.length >= 8,
  )
  .map(([, value]) => value);

const findings = [];
const genericPatterns = [
  /sb_secret_[A-Za-z0-9_-]{16,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /Authorization\s*:\s*Bearer\s+[A-Za-z0-9._-]{16,}/i,
];

for (const file of files) {
  let content;
  try {
    content = await readFile(path.join(PROJECT_ROOT, file), "utf8");
  } catch {
    continue;
  }
  if (content.includes("\0")) continue;

  if (secretValues.some((value) => content.includes(value))) {
    findings.push(`${file}: exact local secret value`);
  }
  if (genericPatterns.some((pattern) => pattern.test(content))) {
    findings.push(`${file}: credential-like literal`);
  }
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Tracked secret scan: ${files.length} files, 0 findings`);
}
