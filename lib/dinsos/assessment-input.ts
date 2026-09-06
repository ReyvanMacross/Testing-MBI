import { ApiError } from "@/lib/http/api-error-response";

const optionalString = (value: unknown, max: number) => {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) throw new ApiError("Data asesmen tidak valid.", 400);
  return value.trim();
};
const enumValue = <T extends string>(value: unknown, values: readonly T[]) => {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !values.includes(value as T)) throw new ApiError("Pilihan asesmen tidak valid.", 400);
  return value as T;
};
const nullableBoolean = (value: unknown) => value === true ? true : value === false ? false : null;

export function parseAssessmentInput(body: unknown, complete = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Data asesmen tidak valid.", 400);
  const source = body as Record<string, unknown>;
  const childCount = source.anakPutusSekolahCount === "" || source.anakPutusSekolahCount == null ? null : Number(source.anakPutusSekolahCount);
  const motivation = source.motivasiPerubahan === "" || source.motivasiPerubahan == null ? null : Number(source.motivasiPerubahan);
  if (childCount !== null && (!Number.isInteger(childCount) || childCount < 0)) throw new ApiError("Jumlah anak putus sekolah tidak valid.", 400);
  if (motivation !== null && (!Number.isInteger(motivation) || motivation < 1 || motivation > 5)) throw new ApiError("Motivasi perubahan harus 1 sampai 5.", 400);
  const data = {
    rentang_pendapatan: optionalString(source.rentangPendapatan, 100),
    status_bekerja: enumValue(source.statusBekerja, ["BEKERJA", "TIDAK_BEKERJA"] as const),
    jenis_pekerjaan: optionalString(source.jenisPekerjaan, 200),
    penghasilan_bulanan: optionalString(source.penghasilanBulanan, 100),
    pendidikan_tertinggi: optionalString(source.pendidikanTertinggi, 100),
    literasi_digital: enumValue(source.literasiDigital, ["MAHIR", "CUKUP", "KURANG"] as const),
    penyakit_kronis_disabilitas: enumValue(source.penyakitKronisDisabilitas, ["ADA", "TIDAK_ADA"] as const),
    penyakit_detail: optionalString(source.penyakitDetail, 1000),
    balita_stunting: enumValue(source.balitaStunting, ["YA", "TIDAK", "TIDAK_ADA_BALITA"] as const),
    lansia_disabilitas_tanpa_pendamping: enumValue(source.lansiaTanpaPendamping, ["YA", "TIDAK"] as const),
    anak_putus_sekolah_count: childCount,
    kelayakan_rumah: enumValue(source.kelayakanRumah, ["LAYAK", "TIDAK_LAYAK"] as const),
    air_sanitasi: enumValue(source.airSanitasi, ["MEMADAI", "TIDAK_MEMADAI"] as const),
    nik_valid: nullableBoolean(source.nikValid), kk_terbaru: nullableBoolean(source.kkTerbaru),
    bpjs_aktif: nullableBoolean(source.bpjsAktif), rekening_bank: nullableBoolean(source.rekeningBank),
    motivasi_perubahan: motivation, keterampilan: optionalString(source.keterampilan, 2000),
    catatan_petugas: optionalString(source.catatanPetugas, 3000),
  };
  if (complete) {
    const required = [data.rentang_pendapatan,data.status_bekerja,data.penghasilan_bulanan,data.pendidikan_tertinggi,data.literasi_digital,data.penyakit_kronis_disabilitas,data.balita_stunting,data.lansia_disabilitas_tanpa_pendamping,data.anak_putus_sekolah_count,data.kelayakan_rumah,data.air_sanitasi,data.nik_valid,data.kk_terbaru,data.bpjs_aktif,data.rekening_bank,data.motivasi_perubahan,data.keterampilan];
    if (required.some((item) => item === null) || (data.status_bekerja === "BEKERJA" && !data.jenis_pekerjaan) || (data.penyakit_kronis_disabilitas === "ADA" && !data.penyakit_detail)) {
      throw new ApiError("Lengkapi seluruh field wajib sebelum menyelesaikan asesmen.", 400);
    }
  }
  return data;
}
