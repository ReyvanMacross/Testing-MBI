import "server-only";

import {
  combineDistributions,
  createDistribution,
  getDominantDesil,
  parseDesil,
  type DesilBucket,
  type DesilValue,
} from "@/lib/diskominfo/desil-statistics";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeWilayah } from "@/lib/diskominfo/wilayah";
import {
  getPublicDistrictDesilReference,
  getPublicSubdistrictDesilReference,
} from "@/lib/diskominfo/public-desil-reference";

export type { DesilBucket } from "@/lib/diskominfo/desil-statistics";

type CurrentDesilRow = {
  kecamatan: string | null;
  kelurahan: string | null;
  desil_dtsen: number | null;
};

export type DesilDataQuality = {
  totalWarga: number;
  withDesil: number;
  withoutDesil: number;
  withoutKecamatan: number;
  withoutKelurahan: number;
  publicReferenceIndividuals: number;
};

export type DesilSourceInfo = {
  kind: "INTERNAL_MBI" | "PUBLIC_REFERENCE";
  label: string;
  period: string;
  publishedAt: string | null;
  url: string | null;
};

export type CityDesilSummary = {
  totalWarga: number;
  totalWithDesil: number;
  distribution: DesilBucket[];
  dataQuality: DesilDataQuality;
};

export type DistrictDesilSummary = {
  kecamatan: string;
  totalWarga: number;
  totalWithDesil: number;
  dominantDesil: DesilValue | null;
  distribution: DesilBucket[];
  source: DesilSourceInfo | null;
};

export type SubdistrictDesilSummary = {
  kelurahan: string;
  totalWarga: number;
  totalWithDesil: number;
  dominantDesil: DesilValue | null;
  distribution: DesilBucket[];
};

export type KelurahanDrilldownItem = {
  id: string;
  kode: string;
  nama: string;
  totalWarga: number;
  totalWithDesil: number;
  dominantDesil: DesilValue | null;
  distribution: DesilBucket[];
  source: DesilSourceInfo | null;
};

export type KelurahanDrilldown = {
  kecamatan: {
    id: string;
    kode: string;
    nama: string;
  };
  kelurahan: KelurahanDrilldownItem[];
  dataQuality: {
    resolvedWarga: number;
    unresolvedWarga: number;
    publicReferenceIndividuals: number;
  };
  sources: DesilSourceInfo[];
};

const INTERNAL_SOURCE: DesilSourceInfo = {
  kind: "INTERNAL_MBI",
  label: "Data warga MBI",
  period: "Terkini",
  publishedAt: null,
  url: null,
};

function getAreaName(value: string | null) {
  const areaName = value?.trim();

  return areaName || null;
}

function sortAreaNames(left: string, right: string) {
  return left.localeCompare(right, "id-ID", {
    sensitivity: "base",
  });
}

export async function getCityDesilDistribution(): Promise<CityDesilSummary> {
  const supabase = createAdminClient();

  const [desilResult, districtResult] = await Promise.all([
    supabase
      .from("v_warga_desil_current")
      .select("kecamatan, kelurahan, desil_dtsen"),
    supabase
      .from("master_wilayah")
      .select("nama")
      .eq("jenis", "KECAMATAN")
      .eq("is_active", true),
  ]);

  if (desilResult.error) {
    throw new Error("Gagal mengambil distribusi desil Kota Bandung.", {
      cause: desilResult.error,
    });
  }

  if (districtResult.error) {
    throw new Error("Gagal mengambil daftar kecamatan Kota Bandung.", {
      cause: districtResult.error,
    });
  }

  const rows = (desilResult.data ?? []) as CurrentDesilRow[];
  const internalDistribution = createDistribution(
    rows.map((row) => row.desil_dtsen),
  );
  const internalDistrictsWithDesil = new Set(
    rows
      .filter((row) => parseDesil(row.desil_dtsen) !== null)
      .map((row) => normalizeWilayah(row.kecamatan ?? ""))
      .filter(Boolean),
  );
  const publicReferences = (districtResult.data ?? [])
    .filter(
      (district) =>
        !internalDistrictsWithDesil.has(normalizeWilayah(district.nama)),
    )
    .map((district) => getPublicDistrictDesilReference(district.nama))
    .filter((reference) => reference !== null);
  const distribution = combineDistributions([
    internalDistribution,
    ...publicReferences.map((reference) => reference.distribution),
  ]);
  const totalWithDesil = distribution.reduce(
    (total, bucket) => total + bucket.count,
    0,
  );
  const publicReferenceIndividuals = publicReferences.reduce(
    (total, reference) => total + reference.total,
    0,
  );

  return {
    totalWarga: rows.length + publicReferenceIndividuals,
    totalWithDesil,
    distribution,
    dataQuality: {
      totalWarga: rows.length,
      withDesil: internalDistribution.reduce(
        (total, bucket) => total + bucket.count,
        0,
      ),
      withoutDesil:
        rows.length -
        internalDistribution.reduce(
          (total, bucket) => total + bucket.count,
          0,
        ),
      withoutKecamatan: rows.filter(
        (row) => getAreaName(row.kecamatan) === null,
      ).length,
      withoutKelurahan: rows.filter(
        (row) => getAreaName(row.kelurahan) === null,
      ).length,
      publicReferenceIndividuals,
    },
  };
}

export async function getDistrictDesilDistribution(): Promise<
  DistrictDesilSummary[]
> {
  const supabase = createAdminClient();

  const [desilResult, districtResult] = await Promise.all([
    supabase
      .from("v_warga_desil_current")
      .select("kecamatan, desil_dtsen")
      .not("kecamatan", "is", null),
    supabase
      .from("master_wilayah")
      .select("nama")
      .eq("jenis", "KECAMATAN")
      .eq("is_active", true)
      .order("nama", { ascending: true }),
  ]);

  if (desilResult.error) {
    throw new Error("Gagal mengambil distribusi desil per kecamatan.", {
      cause: desilResult.error,
    });
  }

  if (districtResult.error) {
    throw new Error("Gagal mengambil daftar kecamatan Kota Bandung.", {
      cause: districtResult.error,
    });
  }

  const groups = new Map<
    string,
    { label: string; values: Array<number | null> }
  >();

  for (const row of desilResult.data ?? []) {
    const kecamatan = getAreaName(row.kecamatan);

    if (!kecamatan) {
      continue;
    }

    const key = normalizeWilayah(kecamatan);
    const group = groups.get(key) ?? {
      label: kecamatan,
      values: [],
    };

    group.values.push(row.desil_dtsen);
    groups.set(key, group);
  }

  return (districtResult.data ?? [])
    .map((district) => {
      const group = groups.get(normalizeWilayah(district.nama)) ?? {
        label: district.nama,
        values: [],
      };
      const distribution = createDistribution(group.values);
      const internalTotalWithDesil = distribution.reduce(
        (total, bucket) => total + bucket.count,
        0,
      );

      if (internalTotalWithDesil > 0) {
        return {
          kecamatan: district.nama,
          totalWarga: group.values.length,
          totalWithDesil: internalTotalWithDesil,
          dominantDesil: getDominantDesil(distribution),
          distribution,
          source: INTERNAL_SOURCE,
        };
      }

      const publicReference = getPublicDistrictDesilReference(district.nama);

      return {
        kecamatan: district.nama,
        totalWarga: publicReference?.total ?? group.values.length,
        totalWithDesil: publicReference?.total ?? 0,
        dominantDesil: publicReference
          ? getDominantDesil(publicReference.distribution)
          : null,
        distribution: publicReference?.distribution ?? distribution,
        source: publicReference?.source ?? null,
      };
    });
}

export async function getSubdistrictDesilDistribution(
  kecamatan: string,
): Promise<SubdistrictDesilSummary[]> {
  const requestedDistrict = getAreaName(kecamatan);

  if (!requestedDistrict) {
    return [];
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("v_warga_desil_current")
    .select("kelurahan, desil_dtsen")
    .ilike("kecamatan", requestedDistrict)
    .not("kelurahan", "is", null);

  if (error) {
    throw new Error("Gagal mengambil distribusi desil per kelurahan.", {
      cause: error,
    });
  }

  const groups = new Map<
    string,
    { label: string; values: Array<number | null> }
  >();

  for (const row of data ?? []) {
    const kelurahan = getAreaName(row.kelurahan);

    if (!kelurahan) {
      continue;
    }

    const key = normalizeWilayah(kelurahan);
    const group = groups.get(key) ?? {
      label: kelurahan,
      values: [],
    };

    group.values.push(row.desil_dtsen);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => {
      const distribution = createDistribution(group.values);
      const totalWithDesil = distribution.reduce(
        (total, bucket) => total + bucket.count,
        0,
      );

      return {
        kelurahan: group.label,
        totalWarga: group.values.length,
        totalWithDesil,
        dominantDesil: getDominantDesil(distribution),
        distribution,
        source: totalWithDesil > 0 ? INTERNAL_SOURCE : null,
      };
    })
    .sort((left, right) => sortAreaNames(left.kelurahan, right.kelurahan));
}

export async function getDistrictDrilldown(
  kecamatan: string,
): Promise<KelurahanDrilldown | null> {
  const requestedDistrict = getAreaName(kecamatan);

  if (!requestedDistrict) {
    return null;
  }

  const supabase = createAdminClient();
  const { data: districtRows, error: districtError } = await supabase
    .from("master_wilayah")
    .select("id, kode_wilayah, nama")
    .eq("jenis", "KECAMATAN")
    .eq("is_active", true);

  if (districtError) {
    throw new Error("Gagal memvalidasi kecamatan terpilih.", {
      cause: districtError,
    });
  }

  const district = (districtRows ?? []).find(
    (row) =>
      normalizeWilayah(row.nama) === normalizeWilayah(requestedDistrict),
  );

  if (!district) {
    return null;
  }

  const [childrenResult, resolvedResult, unresolvedResult] =
    await Promise.all([
      supabase
        .from("master_wilayah")
        .select("id, kode_wilayah, nama")
        .eq("jenis", "KELURAHAN")
        .eq("is_active", true)
        .eq("parent_id", district.id)
        .order("nama", { ascending: true }),
      supabase
        .from("v_warga_desil_current_resolved")
        .select("kelurahan_id, desil_dtsen")
        .eq("kecamatan_id", district.id)
        .not("kelurahan_id", "is", null),
      supabase
        .from("v_warga_desil_current_resolved")
        .select("*", { count: "exact", head: true })
        .ilike("kecamatan_legacy", district.nama)
        .is("kelurahan_id", null),
    ]);

  if (childrenResult.error) {
    throw new Error("Gagal mengambil master kelurahan.", {
      cause: childrenResult.error,
    });
  }

  if (resolvedResult.error) {
    throw new Error("Gagal mengambil data desil kelurahan terverifikasi.", {
      cause: resolvedResult.error,
    });
  }

  if (unresolvedResult.error) {
    throw new Error("Gagal menghitung data wilayah yang belum terverifikasi.", {
      cause: unresolvedResult.error,
    });
  }

  const children = childrenResult.data ?? [];
  const valuesByVillageId = new Map<string, Array<number | null>>(
    children.map((child) => [child.id, []]),
  );

  for (const row of resolvedResult.data ?? []) {
    const values = row.kelurahan_id
      ? valuesByVillageId.get(row.kelurahan_id)
      : null;

    if (!values) {
      throw new Error(
        "Ditemukan kelurahan terverifikasi yang bukan anak kecamatan terpilih.",
      );
    }

    values.push(row.desil_dtsen);
  }

  const kelurahan = children.map((child) => {
    const values = valuesByVillageId.get(child.id) ?? [];
    const internalDistribution = createDistribution(values);
    const internalTotalWithDesil = internalDistribution.reduce(
      (total, bucket) => total + bucket.count,
      0,
    );

    if (internalTotalWithDesil > 0) {
      return {
        id: child.id,
        kode: child.kode_wilayah,
        nama: child.nama,
        totalWarga: values.length,
        totalWithDesil: internalTotalWithDesil,
        dominantDesil: getDominantDesil(internalDistribution),
        distribution: internalDistribution,
        source: INTERNAL_SOURCE,
      };
    }

    const publicReference = getPublicSubdistrictDesilReference(
      district.nama,
      child.nama,
    );

    return {
      id: child.id,
      kode: child.kode_wilayah,
      nama: child.nama,
      totalWarga: publicReference?.total ?? values.length,
      totalWithDesil: publicReference?.total ?? 0,
      dominantDesil: publicReference
        ? getDominantDesil(publicReference.distribution)
        : null,
      distribution: publicReference?.distribution ?? internalDistribution,
      source: publicReference?.source ?? null,
    };
  });
  const sources = Array.from(
    new Map(
      kelurahan
        .map((item) => item.source)
        .filter((source) => source !== null)
        .map((source) => [`${source.kind}:${source.url ?? source.label}`, source]),
    ).values(),
  );

  return {
    kecamatan: {
      id: district.id,
      kode: district.kode_wilayah,
      nama: district.nama,
    },
    kelurahan,
    dataQuality: {
      resolvedWarga: resolvedResult.data?.length ?? 0,
      unresolvedWarga: unresolvedResult.count ?? 0,
      publicReferenceIndividuals: kelurahan
        .filter((item) => item.source?.kind === "PUBLIC_REFERENCE")
        .reduce((total, item) => total + item.totalWithDesil, 0),
    },
    sources,
  };
}
