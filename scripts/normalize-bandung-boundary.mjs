import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseCsv } from "./lib/csv.mjs";
import { PROJECT_ROOT } from "./lib/project-env.mjs";
import { normalizeWilayah } from "./lib/wilayah-reference.mjs";

const RAW_PATH = path.join(
  PROJECT_ROOT,
  "data/reference/bandung-kelurahan-boundary.raw.geojson",
);
const MASTER_PATH = path.join(
  PROJECT_ROOT,
  "data/reference/bandung-wilayah.csv",
);
const ALIAS_PATH = path.join(
  PROJECT_ROOT,
  "data/reference/boundary-name-aliases.json",
);
const OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  "lib/diskominfo/map-assets/bandung-kelurahan-boundary.json",
);

function readRequiredProperty(feature, name, index) {
  const value = feature.properties?.[name];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Feature ${index} is missing property ${name}.`);
  }

  return value.trim();
}

function assertAliasMap(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Alias section ${name} must be an object.`);
  }

  for (const [alias, canonical] of Object.entries(value)) {
    if (
      alias !== normalizeWilayah(alias) ||
      typeof canonical !== "string" ||
      !canonical.trim()
    ) {
      throw new Error(`Invalid ${name} alias entry: ${alias}.`);
    }
  }
}

async function main() {
  const [rawText, masterText, aliasText] = await Promise.all([
    readFile(RAW_PATH, "utf8"),
    readFile(MASTER_PATH, "utf8"),
    readFile(ALIAS_PATH, "utf8"),
  ]);
  const raw = JSON.parse(rawText);
  const aliases = JSON.parse(aliasText);
  const { rows: masterRows } = parseCsv(masterText);

  if (raw.type !== "FeatureCollection" || !Array.isArray(raw.features)) {
    throw new Error("Raw boundary is not a GeoJSON FeatureCollection.");
  }

  if (raw.features.length !== 151) {
    throw new Error(`Expected 151 features, got ${raw.features.length}.`);
  }

  assertAliasMap(aliases.kecamatan, "kecamatan");
  assertAliasMap(aliases.kelurahan, "kelurahan");

  const districts = masterRows.filter((row) => row.jenis === "KECAMATAN");
  const villages = masterRows.filter((row) => row.jenis === "KELURAHAN");
  const districtByCode = new Map(
    districts.map((row) => [row.kode_wilayah, row]),
  );
  const districtByName = new Map(
    districts.map((row) => [normalizeWilayah(row.nama), row]),
  );
  const villageByParentAndName = new Map(
    villages.map((row) => [
      `${row.parent_kode}\0${normalizeWilayah(row.nama)}`,
      row,
    ]),
  );
  const unknownFeatures = [];
  const normalizedFeatures = [];

  for (const [index, feature] of raw.features.entries()) {
    const rawDistrict = readRequiredProperty(feature, "WADMKC", index);
    const rawVillage = readRequiredProperty(feature, "WADMKD", index);
    const rawDistrictKey = normalizeWilayah(rawDistrict);
    const canonicalDistrictName =
      aliases.kecamatan[rawDistrictKey] ?? rawDistrict;
    const district = districtByName.get(
      normalizeWilayah(canonicalDistrictName),
    );

    if (!district) {
      unknownFeatures.push({ index, rawDistrict, rawVillage, reason: "district" });
      continue;
    }

    const rawVillageKey = normalizeWilayah(rawVillage);
    const scopedAliasKey = `${normalizeWilayah(district.nama)}|${rawVillageKey}`;
    const canonicalVillageName =
      aliases.kelurahan[scopedAliasKey] ?? rawVillage;
    const village = villageByParentAndName.get(
      `${district.kode_wilayah}\0${normalizeWilayah(canonicalVillageName)}`,
    );

    if (!village) {
      unknownFeatures.push({ index, rawDistrict, rawVillage, reason: "village" });
      continue;
    }

    if (
      !feature.geometry ||
      !["Polygon", "MultiPolygon"].includes(feature.geometry.type) ||
      !Array.isArray(feature.geometry.coordinates)
    ) {
      throw new Error(
        `Feature ${index} (${rawVillage}) has invalid polygon geometry.`,
      );
    }

    normalizedFeatures.push({
      type: "Feature",
      properties: {
        kode_wilayah: village.kode_wilayah,
        nama: village.nama,
        kecamatan_kode: district.kode_wilayah,
        kecamatan: district.nama,
      },
      geometry: feature.geometry,
    });
  }

  if (unknownFeatures.length > 0) {
    throw new Error(
      `Unknown boundary features: ${JSON.stringify(unknownFeatures)}`,
    );
  }

  const matchedCodes = normalizedFeatures.map(
    (feature) => feature.properties.kode_wilayah,
  );
  const uniqueCodes = new Set(matchedCodes);
  const uniqueVillageNames = new Set(
    normalizedFeatures.map((feature) =>
      normalizeWilayah(feature.properties.nama),
    ),
  );
  const uniqueDistrictCodes = new Set(
    normalizedFeatures.map((feature) => feature.properties.kecamatan_kode),
  );
  const duplicateCount = matchedCodes.length - uniqueCodes.size;
  const missingMasterVillages = villages.filter(
    (village) => !uniqueCodes.has(village.kode_wilayah),
  );
  const missingParents = normalizedFeatures.filter(
    (feature) =>
      !districtByCode.has(feature.properties.kecamatan_kode),
  );

  if (normalizedFeatures.length !== 151) {
    throw new Error(
      `Expected 151 normalized features, got ${normalizedFeatures.length}.`,
    );
  }

  if (uniqueVillageNames.size !== 151) {
    throw new Error(
      `Expected 151 unique kelurahan, got ${uniqueVillageNames.size}.`,
    );
  }

  if (uniqueDistrictCodes.size !== 30) {
    throw new Error(
      `Expected 30 unique kecamatan, got ${uniqueDistrictCodes.size}.`,
    );
  }

  if (duplicateCount !== 0) {
    throw new Error(`Duplicate boundary features: ${duplicateCount}.`);
  }

  if (missingMasterVillages.length !== 0) {
    throw new Error(
      `Missing master kelurahan: ${missingMasterVillages
        .map((row) => row.kode_wilayah)
        .join(", ")}.`,
    );
  }

  if (missingParents.length !== 0) {
    throw new Error(`Missing parent kecamatan: ${missingParents.length}.`);
  }

  normalizedFeatures.sort((left, right) =>
    left.properties.kode_wilayah.localeCompare(
      right.properties.kode_wilayah,
      "id-ID",
    ),
  );

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(
      { type: "FeatureCollection", features: normalizedFeatures },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log("Boundary normalization verified");
  console.log("Features: 151");
  console.log("Unique kecamatan: 30");
  console.log("Unique kelurahan: 151");
  console.log("Master match: 151/151");
  console.log("Unknown features: 0");
  console.log("Duplicate features: 0");
  console.log("Missing parents: 0");
  console.log(
    `Output: ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});