import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseCsv } from "./csv.mjs";
import { PROJECT_ROOT } from "./project-env.mjs";

const EXPECTED_HEADERS = ["kode_wilayah", "jenis", "nama", "parent_kode"];
const VALID_TYPES = new Set(["KOTA", "KECAMATAN", "KELURAHAN"]);

export const BANDUNG_REFERENCE_PATH = path.join(
  PROJECT_ROOT,
  "data/reference/bandung-wilayah.csv",
);

export function normalizeWilayah(value) {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("id-ID");
}

function assertReference(rows, headers) {
  if (headers.join("\0") !== EXPECTED_HEADERS.join("\0")) {
    throw new Error(
      `Expected CSV headers ${EXPECTED_HEADERS.join(",")}, got ${headers.join(",")}.`,
    );
  }

  const normalizedRows = rows.map((row, index) => {
    const normalized = Object.fromEntries(
      EXPECTED_HEADERS.map((header) => [header, row[header].trim()]),
    );

    if (!normalized.kode_wilayah) {
      throw new Error(`Row ${index + 2}: kode_wilayah is required.`);
    }

    if (!normalized.nama) {
      throw new Error(`Row ${index + 2}: nama is required.`);
    }

    if (!VALID_TYPES.has(normalized.jenis)) {
      throw new Error(
        `Row ${index + 2}: invalid jenis ${normalized.jenis || "(empty)"}.`,
      );
    }

    return normalized;
  });

  const codes = new Set();

  for (const row of normalizedRows) {
    if (codes.has(row.kode_wilayah)) {
      throw new Error(`Duplicate kode_wilayah: ${row.kode_wilayah}.`);
    }

    codes.add(row.kode_wilayah);
  }

  const kota = normalizedRows.filter((row) => row.jenis === "KOTA");
  const kecamatan = normalizedRows.filter((row) => row.jenis === "KECAMATAN");
  const kelurahan = normalizedRows.filter((row) => row.jenis === "KELURAHAN");

  if (kota.length !== 1) {
    throw new Error("Expected exactly 1 city");
  }

  if (kecamatan.length !== 30) {
    throw new Error(`Expected 30 kecamatan, got ${kecamatan.length}`);
  }

  if (kelurahan.length !== 151) {
    throw new Error(`Expected 151 kelurahan, got ${kelurahan.length}`);
  }

  if (normalizedRows.length !== 182) {
    throw new Error(`Expected 182 total rows, got ${normalizedRows.length}`);
  }

  const city = kota[0];

  if (city.kode_wilayah !== "BDG" || city.parent_kode) {
    throw new Error("City must use code BDG and must not have a parent.");
  }

  const districtsByCode = new Map(
    kecamatan.map((row) => [row.kode_wilayah, row]),
  );

  for (const district of kecamatan) {
    if (district.parent_kode !== city.kode_wilayah) {
      throw new Error(
        `Kecamatan ${district.kode_wilayah} must have parent ${city.kode_wilayah}.`,
      );
    }
  }

  for (const village of kelurahan) {
    if (!districtsByCode.has(village.parent_kode)) {
      throw new Error(
        `Kelurahan ${village.kode_wilayah} has invalid parent ${village.parent_kode || "(empty)"}.`,
      );
    }
  }

  const namesWithinParent = new Set();

  for (const row of normalizedRows) {
    const key = `${row.parent_kode}\0${normalizeWilayah(row.nama)}`;

    if (namesWithinParent.has(key)) {
      throw new Error(
        `Duplicate normalized name within parent ${row.parent_kode || "(root)"}: ${row.nama}.`,
      );
    }

    namesWithinParent.add(key);
  }

  const childCount = new Map(kecamatan.map((row) => [row.kode_wilayah, 0]));

  for (const village of kelurahan) {
    childCount.set(village.parent_kode, childCount.get(village.parent_kode) + 1);
  }

  const emptyDistricts = kecamatan
    .filter((district) => childCount.get(district.kode_wilayah) === 0)
    .map((district) => district.nama);

  if (emptyDistricts.length > 0) {
    throw new Error(
      `Kecamatan without kelurahan: ${emptyDistricts.join(", ")}.`,
    );
  }

  return { rows: normalizedRows, kota, kecamatan, kelurahan };
}

export async function readBandungWilayahReference() {
  const content = await readFile(BANDUNG_REFERENCE_PATH, "utf8");
  const { headers, rows } = parseCsv(content);

  return assertReference(rows, headers);
}