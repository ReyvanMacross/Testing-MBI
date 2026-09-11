import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";
async function collect(directory) { const entries = await readdir(directory, { withFileTypes: true }); const files=[]; for (const entry of entries) { const full=path.join(directory,entry.name); if(entry.isDirectory()) files.push(...await collect(full)); else if(entry.name==="route.ts") files.push(full); } return files; }
const files = await collect(path.join(PROJECT_ROOT,"app","api","kecamatan"));
assert.ok(files.length >= 7, "Route API Kecamatan belum lengkap.");
for (const file of files) { const content=await readFile(file,"utf8"); if(!/export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)/u.test(content)) continue; assert.match(content,/assertSameOrigin\s*\(/u,`${file} belum memakai assertSameOrigin`); assert.match(content,/assertBodySize\s*\(/u,`${file} belum memakai assertBodySize`); assert.match(content,/requireKecamatanActor\s*\(/u,`${file} belum memakai requireKecamatanActor`); }
console.log(`Audit guard API Kecamatan: ${files.length} route PASS`);
