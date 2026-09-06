import "server-only";

import {
  createDistribution,
  getDominantDesil,
  type DesilBucket,
  type DesilValue,
} from "@/lib/diskominfo/desil-statistics";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeWilayah } from "@/lib/diskominfo/wilayah";

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
  };
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

  const { data, error } = await supabase
    .from("v_warga_desil_current")
    .select("kecamatan, kelurahan, desil_dtsen");

  if (error) {
    throw new Error("Gagal mengambil distribusi desil Kota Bandung.", {
      cause: error,
    });
  }

  const rows = (data ?? []) as CurrentDesilRow[];
  const distribution = createDistribution(
    rows.map((row) => row.desil_dtsen),
  );
  const totalWithDesil = distribution.reduce(
    (total, bucket) => total + bucket.count,
    0,
  );

  return {
    totalWarga: rows.length,
    totalWithDesil,
    distribution,
    dataQuality: {
      totalWarga: rows.length,
      withDesil: totalWithDesil,
      withoutDesil: rows.length - totalWithDesil,
      withoutKecamatan: rows.filter(
        (row) => getAreaName(row.kecamatan) === null,
      ).length,
      withoutKelurahan: rows.filter(
        (row) => getAreaName(row.kelurahan) === null,
      ).length,
    },
  };
}

export async function getDistrictDesilDistribution(): Promise<
  DistrictDesilSummary[]
> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("v_warga_desil_current")
    .select("kecamatan, desil_dtsen")
    .not("kecamatan", "is", null);

  if (error) {
    throw new Error("Gagal mengambil distribusi desil per kecamatan.", {
      cause: error,
    });
  }

  const groups = new Map<
    string,
    { label: string; values: Array<number | null> }
  >();

  for (const row of data ?? []) {
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

  return Array.from(groups.values())
    .map((group) => {
      const distribution = createDistribution(group.values);
      const totalWithDesil = distribution.reduce(
        (total, bucket) => total + bucket.count,
        0,
      );

      return {
        kecamatan: group.label,
        totalWarga: group.values.length,
        totalWithDesil,
        dominantDesil: getDominantDesil(distribution),
        distribution,
      };
    })
    .sort((left, right) => sortAreaNames(left.kecamatan, right.kecamatan));
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

  return {
    kecamatan: {
      id: district.id,
      kode: district.kode_wilayah,
      nama: district.nama,
    },
    kelurahan: children.map((child) => {
      const values = valuesByVillageId.get(child.id) ?? [];
      const distribution = createDistribution(values);
      const totalWithDesil = distribution.reduce(
        (total, bucket) => total + bucket.count,
        0,
      );

      return {
        id: child.id,
        kode: child.kode_wilayah,
        nama: child.nama,
        totalWarga: values.length,
        totalWithDesil,
        dominantDesil: getDominantDesil(distribution),
        distribution,
      };
    }),
    dataQuality: {
      resolvedWarga: resolvedResult.data?.length ?? 0,
      unresolvedWarga: unresolvedResult.count ?? 0,
    },
  };
}
