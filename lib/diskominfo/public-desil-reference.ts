import "server-only";

import publicReferenceData from "@/data/reference/bandung-public-desil-2025.json";
import {
  createDistributionFromCounts,
  type DesilBucket,
} from "@/lib/diskominfo/desil-statistics";
import { normalizeWilayah } from "@/lib/diskominfo/wilayah";

type PublicSubdistrictRecord = {
  name: string;
  counts: number[];
};

type PublicDistrictRecord = {
  district: string;
  referencePeriod: string;
  publishedAt: string;
  sourceTitle: string;
  sourceUrl: string;
  unit: "JIWA";
  subdistricts: PublicSubdistrictRecord[];
};

export type PublicDesilSource = {
  kind: "PUBLIC_REFERENCE";
  label: string;
  period: string;
  publishedAt: string;
  url: string;
};

export type PublicDesilAggregate = {
  distribution: DesilBucket[];
  total: number;
  source: PublicDesilSource;
};

type ValidatedDistrict = PublicDistrictRecord & {
  source: PublicDesilSource;
  distribution: DesilBucket[];
  total: number;
  subdistrictMap: Map<
    string,
    PublicSubdistrictRecord & {
      distribution: DesilBucket[];
      total: number;
    }
  >;
};

const districtMap = validateReferenceData(
  publicReferenceData.datasets as PublicDistrictRecord[],
);

export function getPublicDistrictDesilReference(
  district: string,
): PublicDesilAggregate | null {
  const record = districtMap.get(normalizeWilayah(district));

  if (!record) {
    return null;
  }

  return {
    distribution: record.distribution,
    total: record.total,
    source: record.source,
  };
}

export function getPublicSubdistrictDesilReference(
  district: string,
  subdistrict: string,
): PublicDesilAggregate | null {
  const districtRecord = districtMap.get(normalizeWilayah(district));
  const record = districtRecord?.subdistrictMap.get(
    normalizeWilayah(subdistrict),
  );

  if (!districtRecord || !record) {
    return null;
  }

  return {
    distribution: record.distribution,
    total: record.total,
    source: districtRecord.source,
  };
}

export function getPublicDesilDistrictCount() {
  return districtMap.size;
}

function validateReferenceData(records: PublicDistrictRecord[]) {
  const output = new Map<string, ValidatedDistrict>();

  for (const record of records) {
    const districtKey = normalizeWilayah(record.district);

    if (!districtKey || output.has(districtKey)) {
      throw new Error(`Referensi desil kecamatan duplikat: ${record.district}`);
    }

    if (!record.sourceUrl.startsWith("https://")) {
      throw new Error(`Sumber desil wajib HTTPS: ${record.district}`);
    }

    const subdistrictMap = new Map<
      string,
      PublicSubdistrictRecord & {
        distribution: DesilBucket[];
        total: number;
      }
    >();
    const districtCounts = [0, 0, 0, 0, 0];

    for (const subdistrict of record.subdistricts) {
      const key = normalizeWilayah(subdistrict.name);

      if (!key || subdistrictMap.has(key)) {
        throw new Error(
          `Referensi desil kelurahan duplikat: ${record.district}/${subdistrict.name}`,
        );
      }

      validateCounts(subdistrict.counts, record.district, subdistrict.name);
      subdistrict.counts.forEach((count, index) => {
        districtCounts[index] += count;
      });

      const distribution = createDistributionFromCounts(subdistrict.counts);
      subdistrictMap.set(key, {
        ...subdistrict,
        distribution,
        total: sumCounts(subdistrict.counts),
      });
    }

    const source: PublicDesilSource = {
      kind: "PUBLIC_REFERENCE",
      label: record.sourceTitle,
      period: record.referencePeriod,
      publishedAt: record.publishedAt,
      url: record.sourceUrl,
    };

    output.set(districtKey, {
      ...record,
      source,
      distribution: createDistributionFromCounts(districtCounts),
      total: sumCounts(districtCounts),
      subdistrictMap,
    });
  }

  return output;
}

function validateCounts(counts: number[], district: string, subdistrict: string) {
  if (
    counts.length !== 5 ||
    counts.some((count) => !Number.isSafeInteger(count) || count < 0)
  ) {
    throw new Error(
      `Hitungan desil publik tidak valid: ${district}/${subdistrict}`,
    );
  }
}

function sumCounts(counts: number[]) {
  return counts.reduce((total, count) => total + count, 0);
}
