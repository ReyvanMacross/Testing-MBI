import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseAdminEnvironment,
  loadProjectEnvironment,
} from "./lib/project-env.mjs";
import {
  normalizeWilayah,
  readBandungWilayahReference,
} from "./lib/wilayah-reference.mjs";

const EXPECTED_COBLONG_CHILDREN = [
  "Cipaganti",
  "Dago",
  "Lebak Gede",
  "Lebak Siliwangi",
  "Sadang Serang",
  "Sekeloa",
];

async function upsertRows(supabase, rows, label) {
  const { error } = await supabase
    .from("master_wilayah")
    .upsert(rows, { onConflict: "kode_wilayah" });

  if (error) {
    throw new Error(`Failed to upsert ${label}: ${error.message}`);
  }
}

async function getMasterRows(supabase) {
  const { data, error } = await supabase
    .from("master_wilayah")
    .select("id, kode_wilayah, nama, jenis, parent_id, is_active")
    .order("kode_wilayah", { ascending: true });

  if (error) {
    throw new Error(`Failed to read master_wilayah: ${error.message}`);
  }

  return data ?? [];
}

function verifySeededMaster(rows) {
  const counts = { KOTA: 0, KECAMATAN: 0, KELURAHAN: 0 };

  for (const row of rows) {
    if (!(row.jenis in counts)) {
      throw new Error(`Unexpected jenis in database: ${row.jenis}.`);
    }

    counts[row.jenis] += 1;
  }

  if (
    rows.length !== 182 ||
    counts.KOTA !== 1 ||
    counts.KECAMATAN !== 30 ||
    counts.KELURAHAN !== 151
  ) {
    throw new Error(
      `Unexpected master counts: KOTA=${counts.KOTA}, KECAMATAN=${counts.KECAMATAN}, KELURAHAN=${counts.KELURAHAN}, TOTAL=${rows.length}.`,
    );
  }

  const city = rows.find((row) => row.kode_wilayah === "BDG");

  if (!city || city.jenis !== "KOTA" || city.parent_id !== null) {
    throw new Error("Seeded city hierarchy is invalid.");
  }

  const districts = rows.filter((row) => row.jenis === "KECAMATAN");
  const districtIds = new Set(districts.map((row) => row.id));
  const villages = rows.filter((row) => row.jenis === "KELURAHAN");

  if (districts.some((row) => row.parent_id !== city.id)) {
    throw new Error("One or more kecamatan have an invalid parent_id.");
  }

  if (villages.some((row) => !districtIds.has(row.parent_id))) {
    throw new Error("One or more kelurahan have an invalid parent_id.");
  }

  const villageCounts = new Map(districts.map((row) => [row.id, 0]));

  for (const village of villages) {
    villageCounts.set(village.parent_id, villageCounts.get(village.parent_id) + 1);
  }

  const emptyDistricts = districts
    .filter((row) => villageCounts.get(row.id) === 0)
    .map((row) => row.nama);

  if (emptyDistricts.length > 0) {
    throw new Error(
      `Kecamatan without kelurahan after seed: ${emptyDistricts.join(", ")}.`,
    );
  }

  const coblong = districts.find(
    (row) => normalizeWilayah(row.nama) === "coblong",
  );

  if (!coblong) {
    throw new Error("Coblong was not found after seed.");
  }

  const coblongChildren = villages
    .filter((row) => row.parent_id === coblong.id)
    .map((row) => row.nama)
    .sort((left, right) => left.localeCompare(right, "id-ID"));
  const expectedChildren = [...EXPECTED_COBLONG_CHILDREN].sort((left, right) =>
    left.localeCompare(right, "id-ID"),
  );

  if (coblongChildren.join("\0") !== expectedChildren.join("\0")) {
    throw new Error(
      `Unexpected Coblong children: ${coblongChildren.join(", ")}.`,
    );
  }

  return { counts, coblongChildren };
}

async function main() {
  // All source validation happens before a Supabase client is created or any
  // database write can occur.
  const reference = await readBandungWilayahReference();

  await loadProjectEnvironment();

  const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const city = reference.kota[0];

  await upsertRows(
    supabase,
    [
      {
        kode_wilayah: city.kode_wilayah,
        nama: city.nama,
        jenis: city.jenis,
        parent_id: null,
        is_active: true,
      },
    ],
    "Kota Bandung",
  );

  const { data: cityRow, error: cityError } = await supabase
    .from("master_wilayah")
    .select("id, kode_wilayah")
    .eq("kode_wilayah", city.kode_wilayah)
    .single();

  if (cityError || !cityRow) {
    throw new Error(
      `Failed to resolve city parent: ${cityError?.message ?? "not found"}`,
    );
  }

  await upsertRows(
    supabase,
    reference.kecamatan.map((row) => ({
      kode_wilayah: row.kode_wilayah,
      nama: row.nama,
      jenis: row.jenis,
      parent_id: cityRow.id,
      is_active: true,
    })),
    "30 kecamatan",
  );

  const { data: districtRows, error: districtError } = await supabase
    .from("master_wilayah")
    .select("id, kode_wilayah")
    .eq("jenis", "KECAMATAN");

  if (districtError) {
    throw new Error(`Failed to resolve kecamatan: ${districtError.message}`);
  }

  const districtIds = new Map(
    (districtRows ?? []).map((row) => [row.kode_wilayah, row.id]),
  );

  for (const district of reference.kecamatan) {
    if (!districtIds.has(district.kode_wilayah)) {
      throw new Error(
        `Seeded kecamatan could not be resolved: ${district.kode_wilayah}.`,
      );
    }
  }

  await upsertRows(
    supabase,
    reference.kelurahan.map((row) => ({
      kode_wilayah: row.kode_wilayah,
      nama: row.nama,
      jenis: row.jenis,
      parent_id: districtIds.get(row.parent_kode),
      is_active: true,
    })),
    "151 kelurahan",
  );

  const verification = verifySeededMaster(await getMasterRows(supabase));

  console.log("master_wilayah seed verified");
  console.log(`KOTA: ${verification.counts.KOTA}`);
  console.log(`KECAMATAN: ${verification.counts.KECAMATAN}`);
  console.log(`KELURAHAN: ${verification.counts.KELURAHAN}`);
  console.log("TOTAL: 182");
  console.log(`Coblong children: ${verification.coblongChildren.join(", ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});