import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { stringifyCsv } from "./lib/csv.mjs";
import {
  getSupabaseAdminEnvironment,
  loadProjectEnvironment,
  PROJECT_ROOT,
} from "./lib/project-env.mjs";
import { normalizeWilayah } from "./lib/wilayah-reference.mjs";

const OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  "supabase/audits/20260906_warga_wilayah_validation.csv",
);
const OUTPUT_HEADERS = [
  "raw_kecamatan",
  "raw_kelurahan",
  "normalized_kecamatan",
  "normalized_kelurahan",
  "matched_kecamatan",
  "matched_kelurahan",
  "classification",
  "reason",
  "warga_count",
];
const PAGE_SIZE = 1000;

async function readAllRows(supabase, table, columns) {
  const rows = [];

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(start, start + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to read ${table}: ${error.message}`);
    }

    rows.push(...(data ?? []));

    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

function aggregateWargaPairs(wargaRows) {
  const pairs = new Map();

  for (const row of wargaRows) {
    const rawKecamatan = String(row.kecamatan ?? "").trim();
    const rawKelurahan = String(row.kelurahan ?? "").trim();
    const key = `${rawKecamatan}\0${rawKelurahan}`;
    const existing = pairs.get(key);

    if (existing) {
      existing.warga_count += 1;
    } else {
      pairs.set(key, {
        raw_kecamatan: rawKecamatan,
        raw_kelurahan: rawKelurahan,
        warga_count: 1,
      });
    }
  }

  const collator = new Intl.Collator("id-ID", { sensitivity: "base" });

  return [...pairs.values()].sort(
    (left, right) =>
      collator.compare(left.raw_kecamatan, right.raw_kecamatan) ||
      collator.compare(left.raw_kelurahan, right.raw_kelurahan),
  );
}

function validatePair(pair, indexes) {
  const normalizedKecamatan = normalizeWilayah(pair.raw_kecamatan);
  const normalizedKelurahan = normalizeWilayah(pair.raw_kelurahan);
  const base = {
    ...pair,
    normalized_kecamatan: normalizedKecamatan,
    normalized_kelurahan: normalizedKelurahan,
    matched_kecamatan: "",
    matched_kelurahan: "",
  };

  if (!normalizedKecamatan) {
    return {
      ...base,
      classification: "UNRESOLVED",
      reason: "kecamatan_empty",
    };
  }

  const district = indexes.districtsByName.get(normalizedKecamatan);

  if (!district) {
    return {
      ...base,
      classification: "UNRESOLVED",
      reason: "kecamatan_not_found",
    };
  }

  base.matched_kecamatan = district.nama;

  if (!normalizedKelurahan) {
    return {
      ...base,
      classification: "UNRESOLVED",
      reason: "kelurahan_empty",
    };
  }

  const childKey = `${district.id}\0${normalizedKelurahan}`;
  const exactVillage = indexes.villagesByParentAndName.get(childKey);

  if (exactVillage) {
    return {
      ...base,
      matched_kelurahan: exactVillage.nama,
      classification: "MATCH",
      reason: "exact_normalized_match",
    };
  }

  const aliasTarget = indexes.aliasesByParentAndName.get(childKey);

  if (aliasTarget) {
    return {
      ...base,
      matched_kelurahan: aliasTarget.nama,
      classification: "ALIAS",
      reason: "verified_alias",
    };
  }

  return {
    ...base,
    classification: "UNRESOLVED",
    reason: indexes.allMasterNames.has(normalizedKelurahan)
      ? "kelurahan_not_child_of_kecamatan"
      : "kelurahan_not_found",
  };
}

function createMasterIndexes(masterRows, aliasRows) {
  const districts = masterRows.filter((row) => row.jenis === "KECAMATAN");
  const villages = masterRows.filter((row) => row.jenis === "KELURAHAN");
  const masterById = new Map(masterRows.map((row) => [row.id, row]));
  const districtsByName = new Map();
  const villagesByParentAndName = new Map();
  const aliasesByParentAndName = new Map();
  const allMasterNames = new Set(
    masterRows.map((row) => normalizeWilayah(row.nama)),
  );

  for (const district of districts) {
    const key = normalizeWilayah(district.nama);

    if (districtsByName.has(key)) {
      throw new Error(`Duplicate normalized kecamatan in master: ${district.nama}.`);
    }

    districtsByName.set(key, district);
  }

  for (const village of villages) {
    const key = `${village.parent_id}\0${normalizeWilayah(village.nama)}`;

    if (villagesByParentAndName.has(key)) {
      throw new Error(
        `Duplicate normalized kelurahan in master parent ${village.parent_id}: ${village.nama}.`,
      );
    }

    villagesByParentAndName.set(key, village);
  }

  for (const alias of aliasRows) {
    const target = masterById.get(alias.wilayah_id);

    if (!target || target.jenis !== "KELURAHAN") {
      continue;
    }

    const key = `${target.parent_id}\0${normalizeWilayah(alias.alias)}`;
    const existing = aliasesByParentAndName.get(key);

    if (existing && existing.id !== target.id) {
      throw new Error(
        `Ambiguous alias ${alias.alias} within parent ${target.parent_id}.`,
      );
    }

    aliasesByParentAndName.set(key, target);
  }

  return {
    districtsByName,
    villagesByParentAndName,
    aliasesByParentAndName,
    allMasterNames,
  };
}

async function main() {
  await loadProjectEnvironment();

  const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const [wargaRows, masterRows, aliasRows] = await Promise.all([
    readAllRows(supabase, "warga", "kecamatan, kelurahan"),
    readAllRows(
      supabase,
      "master_wilayah",
      "id, kode_wilayah, nama, jenis, parent_id",
    ),
    readAllRows(supabase, "wilayah_alias", "wilayah_id, alias"),
  ]);

  const typeCounts = masterRows.reduce(
    (counts, row) => {
      counts[row.jenis] = (counts[row.jenis] ?? 0) + 1;
      return counts;
    },
    {},
  );

  if (
    masterRows.length !== 182 ||
    typeCounts.KOTA !== 1 ||
    typeCounts.KECAMATAN !== 30 ||
    typeCounts.KELURAHAN !== 151
  ) {
    throw new Error(
      "master_wilayah must contain exactly 1 city, 30 kecamatan, and 151 kelurahan before audit.",
    );
  }

  const indexes = createMasterIndexes(masterRows, aliasRows);
  const pairs = aggregateWargaPairs(wargaRows);
  const results = pairs.map((pair) => validatePair(pair, indexes));

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, stringifyCsv(OUTPUT_HEADERS, results), "utf8");

  const counts = results.reduce(
    (summary, result) => {
      summary[result.classification] += 1;
      return summary;
    },
    { MATCH: 0, ALIAS: 0, UNRESOLVED: 0 },
  );

  console.log(`Warga rows: ${wargaRows.length}`);
  console.log(`Distinct pairs: ${results.length}`);
  console.log(`MATCH: ${counts.MATCH}`);
  console.log(`ALIAS: ${counts.ALIAS}`);
  console.log(`UNRESOLVED: ${counts.UNRESOLVED}`);
  console.log(`Audit report: ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});