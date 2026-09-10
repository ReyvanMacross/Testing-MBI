import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(full));
    else if (entry.name === "route.ts") files.push(full);
  }
  return files;
}

const root = path.join(PROJECT_ROOT, "app", "api", "disdik");
const files = await collect(root);
assert.ok(files.length > 0, "Route API Disdik tidak ditemukan.");
for (const file of files) {
  const source = await readFile(file, "utf8");
  if (!/export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)/u.test(source)) continue;
  assert.match(source, /assertSameOrigin\s*\(/u, `${file} belum memakai assertSameOrigin`);
  assert.match(source, /assertBodySize\s*\(/u, `${file} belum memakai assertBodySize`);
  assert.match(source, /requireDisdikActor\s*\(/u, `${file} belum memakai requireDisdikActor`);
}
console.log(`Audit guard API Disdik: ${files.length} route PASS`);
