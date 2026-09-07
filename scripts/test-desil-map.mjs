import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  combineDistributions,
  createDistribution,
  createDistributionFromCounts,
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
  const countedDistribution = createDistributionFromCounts([1, 2, 3, 4, 5]);
  assert.equal(countedDistribution[4].count, 5);
  assert.equal(
    combineDistributions([countedDistribution, countedDistribution])[4].count,
    10,
  );

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

  const publicReference = JSON.parse(
    await readFile(
      path.join(
        PROJECT_ROOT,
        "data/reference/bandung-public-desil-2025.json",
      ),
      "utf8",
    ),
  );
  assert.equal(publicReference.version, 1);
  assert.equal(publicReference.datasets.length, 3);

  const publicDistrictNames = new Set();
  for (const dataset of publicReference.datasets) {
    assert.ok(!publicDistrictNames.has(normalizeWilayah(dataset.district)));
    publicDistrictNames.add(normalizeWilayah(dataset.district));
    assert.match(dataset.sourceUrl, /^https:\/\/(multisite\.)?bandung\.go\.id\//);
    assert.ok(dataset.referencePeriod);
    assert.equal(dataset.unit, "JIWA");

    const district = districts.find(
      (row) => normalizeWilayah(row.nama) === normalizeWilayah(dataset.district),
    );
    assert.ok(district, `${dataset.district} must exist in master_wilayah`);

    const { data: officialChildren, error: officialChildrenError } =
      await supabase
        .from("master_wilayah")
        .select("nama")
        .eq("jenis", "KELURAHAN")
        .eq("parent_id", district.id);
    assert.ifError(officialChildrenError);
    const officialNames = new Set(
      (officialChildren ?? []).map((row) => normalizeWilayah(row.nama)),
    );
    const referenceNames = new Set();

    for (const subdistrict of dataset.subdistricts) {
      const normalizedName = normalizeWilayah(subdistrict.name);
      assert.ok(officialNames.has(normalizedName));
      assert.ok(!referenceNames.has(normalizedName));
      referenceNames.add(normalizedName);
      assert.equal(subdistrict.counts.length, 5);
      assert.ok(
        subdistrict.counts.every(
          (count) => Number.isSafeInteger(count) && count >= 0,
        ),
      );
    }

    assert.equal(referenceNames.size, officialNames.size);
  }

  console.log("normalizeWilayah: PASS");
  console.log("normalizeDesil: PASS");
  console.log("dominantDesil tie rule: PASS");
  console.log("district query: 30 kecamatan PASS");
  console.log("subdistrict query: Coblong 6 kelurahan PASS");
  console.log(`resolved Coblong rows: ${resolvedRows?.length ?? 0}`);
  console.log("boundary: Coblong 6 / Andir 6 PASS");
  console.log("public DTSEN reference: 3 kecamatan / 14 kelurahan PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
