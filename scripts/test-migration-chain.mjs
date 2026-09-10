import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";

const migrationDirectory = path.join(PROJECT_ROOT, "supabase", "migrations");
const migrations = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith(".sql"))
  .sort();

assert.ok(migrations.length > 0, "Migration directory is empty.");
assert.equal(migrations[0], "202609040000_initial_schema.sql");
assert.equal(
  migrations.at(-1),
  "202609100003_disdik_final_hardening.sql",
);
assert.equal(new Set(migrations).size, migrations.length, "Duplicate filename found.");

const versions = migrations.map((name) => {
  const match = /^(\d{12})_[a-z0-9_]+\.sql$/u.exec(name);
  assert.ok(match, `Invalid migration filename: ${name}`);
  return match[1];
});
assert.equal(new Set(versions).size, versions.length, "Duplicate migration version found.");
assert.deepEqual(versions, [...versions].sort(), "Migration versions are not monotonic.");

const availableFunctions = new Set();
for (const name of migrations) {
  const sql = await readFile(path.join(migrationDirectory, name), "utf8");
  assert.ok(sql.trim().length > 0, `${name} is empty.`);
  assert.doesNotMatch(
    sql,
    /Fixture Development|operator\.lapangan\.test/i,
    `${name} contains development fixture data.`,
  );

  for (const match of sql.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)/giu,
  )) {
    availableFunctions.add(match[1].toLowerCase());
  }
  for (const match of sql.matchAll(
    /execute\s+function\s+public\.([a-z0-9_]+)/giu,
  )) {
    const functionName = match[1].toLowerCase();
    assert.ok(
      availableFunctions.has(functionName),
      `${name} references ${functionName} before it is created.`,
    );
  }
}

console.log(`Migration chain: ${migrations.length} unique, monotonic files PASS`);
console.log("Referenced trigger function ordering: PASS");
