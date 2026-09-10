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

const root = path.join(PROJECT_ROOT, "app", "api", "disnaker");
const files = await collect(root);
assert.ok(files.length > 0, "No Disnaker API routes found.");
for (const file of files) {
  const source = await readFile(file, "utf8");
  if (!/export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)/u.test(source)) continue;
  assert.match(source, /assertSameOrigin\s*\(/u, `${file} misses assertSameOrigin`);
  assert.match(source, /assertBodySize\s*\(/u, `${file} misses assertBodySize`);
  assert.match(source, /requireDisnakerActor\s*\(/u, `${file} misses requireDisnakerActor`);
}
console.log(`Disnaker API guard audit: ${files.length} routes PASS`);
