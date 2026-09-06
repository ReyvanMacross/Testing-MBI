import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  createDistribution,
  getDominantDesil,
  normalizeDesil,
} from "../lib/diskominfo/desil-statistics.ts";
import { normalizeWilayah } from "../lib/diskominfo/wilayah.ts";
import {
  getSupabaseAdminEnvironment,
  loadProjectEnvironment,
  PROJECT_ROOT,
} from "./lib/project-env.mjs";

const EXPECTED_COBLONG = [
  "Cipaganti",
  "Dago",
  "Lebak Gede",
  "Lebak Siliwangi",
  "Sadang Serang",
  "Sekeloa",
];

async function main() {
  assert.equal(normalizeWilayah("  COBLONG   "), "coblong");
  assert.equal(normalizeWilayah("Lebak   Siliwangi"), "lebak siliwangi");
  assert.equal(normalizeDesil(1), 1);
  assert.equal(normalizeDesil(4), 4);
  assert.equal(normalizeDesil(5), 5);
  assert.equal(normalizeDesil(9), 5);

  const tiedDistribution = createDistribution([1, 1, 2, 2, 4]);
  assert.equal(getDominantDesil(tiedDistribution), 1);
  assert.equal(getDominantDesil(createDistribution([])), null);

  await loadProjectEnvironment();
  const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: districts, error: districtError } = await supabase
    .from("master_wilayah")
    .select("id, kode_wilayah, nama")
    .eq("jenis", "KECAMATAN")
    .eq("is_active", true);

  assert.ifError(districtError);
  assert.equal(districts?.length, 30);

  const coblong = districts?.find(
    (row) => normalizeWilayah(row.nama) === "coblong",
  );
  assert.ok(coblong, "Coblong must exist in master_wilayah");

  const { data: children, error: childrenError } = await supabase
    .from("master_wilayah")
    .select("id, kode_wilayah, nama")
    .eq("jenis", "KELURAHAN")
    .eq("parent_id", coblong.id)
    .order("nama", { ascending: true });

  assert.ifError(childrenError);
  assert.deepEqual(
    (children ?? []).map((row) => row.nama),
    EXPECTED_COBLONG,
  );

  const childIds = new Set((children ?? []).map((row) => row.id));
  const { data: resolvedRows, error: resolvedError } = await supabase
    .from("v_warga_desil_current_resolved")
    .select("kecamatan_id, kelurahan_id, desil_dtsen")
    .eq("kecamatan_id", coblong.id)
    .not("kelurahan_id", "is", null);

  assert.ifError(resolvedError);
  assert.ok(
    (resolvedRows ?? []).every(
      (row) => row.kelurahan_id && childIds.has(row.kelurahan_id),
    ),
    "Every resolved kelurahan must be a child of the selected kecamatan",
  );

  const { data: legacyRows, error: legacyError } = await supabase
    .from("v_warga_desil_current")
    .select("kecamatan, desil_dtsen")
    .not("kecamatan", "is", null);

  assert.ifError(legacyError);
  assert.ok((legacyRows?.length ?? 0) > 0, "District data query must return rows");

  const boundary = JSON.parse(
    await readFile(
      path.join(
        PROJECT_ROOT,
        "lib/diskominfo/map-assets/bandung-kelurahan-boundary.json",
      ),
      "utf8",
    ),
  );
  const coblongFeatures = boundary.features.filter(
    (feature) => normalizeWilayah(feature.properties.kecamatan) === "coblong",
  );
  const andirFeatures = boundary.features.filter(
    (feature) => normalizeWilayah(feature.properties.kecamatan) === "andir",
  );

  assert.equal(coblongFeatures.length, 6);
  assert.equal(andirFeatures.length, 6);

  console.log("normalizeWilayah: PASS");
  console.log("normalizeDesil: PASS");
  console.log("dominantDesil tie rule: PASS");
  console.log("district query: 30 kecamatan PASS");
  console.log("subdistrict query: Coblong 6 kelurahan PASS");
  console.log(`resolved Coblong rows: ${resolvedRows?.length ?? 0}`);
  console.log("boundary: Coblong 6 / Andir 6 PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});