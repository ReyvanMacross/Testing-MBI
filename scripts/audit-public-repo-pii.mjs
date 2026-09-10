import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";

const git = spawnSync("git", ["ls-files", "-z"], {
  cwd: PROJECT_ROOT,
  encoding: "utf8",
});
if (git.status !== 0) throw new Error("Git tracked-file inventory is unavailable.");

const generatedPublicData = /^(?:data\/reference|lib\/diskominfo\/map-assets|public\/data|tools\/map-source)\//u;
const allowedEmail = /@(?:bandung\.go\.id|example\.invalid|example\.com|api\.fixture\.example)$/iu;
const patterns = [
  { label: "unmasked 16-digit identifier", expression: /\b\d{16}\b/gu },
  { label: "unmasked Indonesian phone", expression: /(?<!\d)(?:\+62|62|0)8\d{8,11}(?!\d)/gu },
  { label: "complete citizen address", expression: /\b(?:jalan|jl\.)\s+[A-Z][^\n,]{2,80}(?:no\.?\s*\d+|rt\s*\d+\s*\/\s*rw\s*\d+)/giu },
  { label: "email address", expression: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu },
];

const findings = [];
for (const file of git.stdout.split("\0").filter(Boolean)) {
  if (generatedPublicData.test(file)) continue;
  let content;
  try {
    content = await readFile(path.join(PROJECT_ROOT, file), "utf8");
  } catch {
    continue;
  }
  if (content.includes("\0")) continue;

  const lines = content.split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    for (const { label, expression } of patterns) {
      expression.lastIndex = 0;
      for (const match of line.matchAll(expression)) {
        if (label === "email address" && allowedEmail.test(match[0])) continue;
        findings.push(`${file}:${index + 1}: ${label}`);
      }
    }
  }
}

if (findings.length) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Public repository PII scan: 0 unmasked citizen PII findings");
}
