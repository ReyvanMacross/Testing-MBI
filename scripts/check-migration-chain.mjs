import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";

const migrationDirectory = path.join(PROJECT_ROOT, "supabase", "migrations");
const migrations = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith(".sql"))
  .sort();

assert.equal(migrations[0], "202609040000_initial_schema.sql");
assert.equal(
  migrations.at(-1),
  "202609060011_dinsos_split_path_foundation.sql",
);

for (const name of migrations) {
  const sql = await readFile(path.join(migrationDirectory, name), "utf8");
  assert.ok(sql.trim().length > 0, `${name} is empty`);
  assert.doesNotMatch(
    sql,
    /Fixture Development|@bandung\.go\.id|operator\.lapangan\.test/i,
    `${name} contains development fixture data`,
  );
}

console.log(`Migration chain static check: ${migrations.length} files PASS`);
