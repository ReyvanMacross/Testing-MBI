import "server-only";

import { maskNik } from "@/lib/privacy/mask-nik";
import { createAdminClient } from "@/lib/supabase/admin";

export type DisnakerReferralStatus = "PERLU_DIPROSES" | "SEDANG_PELATIHAN" | "BEKERJA_SELESAI";

export type DisnakerReferral = {
  id: string;
  code: string;
  name: string;
  maskedNik: string;
  date: string;
  program: string;
  institution: string;
  desil: number;
  kelurahan: string;
  status: DisnakerReferralStatus;
  instruction: string;
  attendance: number | null;
  placementPartner: string | null;
  placementDate: string | null;
  evaluation: string | null;
  isPreview: boolean;
};

export type DisnakerProgram = {
  id: string;
  code: string;
  name: string;
  category: string;
  institution: string;
  duration: string;
  filled: number;
  capacity: number;
  status: "AKTIF" | "PENUH";
  location: string;
  qualification: string;
  isPreview: boolean;
};

export type PlacementPartner = {
  id: string;
  name: string;
  sector: string;
  absorbed: number;
  program: string;
  status: "AKTIF";
};

const PREVIEW_REFERRALS: DisnakerReferral[] = [
  {
    id: "preview-ref-003", code: "REF-2026-003", name: "Asep Suryana",
    maskedNik: "32731102xxxx1234", date: "18 Feb 2026", program: "Pelatihan Vokasi & Magang",
    institution: "BLK Kota Bandung (Bidang Teknik & Manufaktur)", desil: 2, kelurahan: "Sekeloa",
    status: "PERLU_DIPROSES", instruction: "Peserta diwajibkan membawa kelengkapan administrasi fisik dan hadir pada orientasi pembekalan.",
    attendance: null, placementPartner: null, placementDate: null, evaluation: null, isPreview: true,
  },
  {
    id: "preview-ref-015", code: "REF-2026-015", name: "Budi Gunawan",
    maskedNik: "32731209xxxx5678", date: "10 Feb 2026", program: "Pelatihan Otomotif & Las",
    institution: "LPK Otomotif Mandiri", desil: 2, kelurahan: "Sukajadi",
    status: "SEDANG_PELATIHAN", instruction: "Peserta mengikuti modul praktik teknik dan tahap magang.",
    attendance: 100, placementPartner: "PT Pindad (Persero) - Divisi Manufaktur", placementDate: "21/08/2026",
    evaluation: "Peserta dinyatakan lulus sertifikasi Welder B1 dan resmi diterima bekerja per Agustus 2026.", isPreview: true,
  },
  {
    id: "preview-ref-022", code: "REF-2026-022", name: "Dedi Kurnia",
    maskedNik: "32730514xxxx9012", date: "01 Feb 2026", program: "Sertifikasi Mengemudi B1",
    institution: "LPK Otomotif & Mengemudi Mandiri", desil: 2, kelurahan: "Sekeloa",
    status: "BEKERJA_SELESAI", instruction: "Peserta mengikuti sertifikasi pengemudi operasional.",
    attendance: 100, placementPartner: "PT Blue Bird Tbk - Pool Bandung", placementDate: "01 Feb 2026",
    evaluation: "Peserta telah menyelesaikan pelatihan mengemudi, memperoleh SIM B1 Umum, dan resmi diterima sebagai pengemudi operasional per 01 Februari 2026.", isPreview: true,
  },
];

export const PREVIEW_PROGRAMS: DisnakerProgram[] = [
  { id: "preview-prg-vok-01", code: "PRG-VOK-01", name: "Pelatihan Vokasi & Magang Kerja", category: "Teknik & Manufaktur", institution: "BLK Kota Bandung (Teknik)", duration: "3 Bulan", filled: 64, capacity: 70, status: "AKTIF", location: "BLK Kota Bandung", qualification: "Sertifikat kompetensi dan kesiapan magang", isPreview: true },
  { id: "preview-prg-oto-02", code: "PRG-OTO-02", name: "Pelatihan Otomotif & Las", category: "Otomotif", institution: "LPK Otomotif Mandiri", duration: "2 Bulan", filled: 25, capacity: 30, status: "AKTIF", location: "LPK Otomotif Mandiri", qualification: "Sertifikasi teknik otomotif dan pengelasan", isPreview: true },
  { id: "preview-prg-drv-03", code: "PRG-DRV-03", name: "Sertifikasi Mengemudi B1", category: "Jasa & Transportasi", institution: "LPK Mengemudi Bandung", duration: "1 Bulan", filled: 20, capacity: 20, status: "PENUH", location: "BLK Kiaracondong & Trek Mengemudi", qualification: "Sertifikasi SIM B1 Umum & Pengemudi Operasional", isPreview: true },
];

export const PREVIEW_PARTNERS: PlacementPartner[] = [
  { id: "partner-bluebird", name: "PT Blue Bird Tbk - Pool Bandung", sector: "Transportasi & Logistik", absorbed: 42, program: "Sertifikasi Mengemudi B1", status: "AKTIF" },
  { id: "partner-pindad", name: "PT Pindad (Persero)", sector: "Manufaktur & Teknik", absorbed: 35, program: "Pelatihan Otomotif & Las", status: "AKTIF" },
  { id: "partner-len", name: "PT Len Industri (Persero)", sector: "Teknologi & Elektronika", absorbed: 18, program: "Pelatihan Vokasi & Magang", status: "AKTIF" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function mapStatus(status: string): DisnakerReferralStatus {
  if (status === "SELESAI") return "BEKERJA_SELESAI";
  if (status === "DITERIMA" || status === "DIPROSES") return "SEDANG_PELATIHAN";
  return "PERLU_DIPROSES";
}

export async function getDisnakerReferrals() {
  const admin = createAdminClient();
  const { data: opd } = await admin.from("master_opd").select("id").eq("kode_opd", "DISNAKER").maybeSingle();
  if (!opd) return PREVIEW_REFERRALS;
  const { data: rows, error } = await admin.from("referral_mbi")
    .select("id,referral_code,warga_id,program_id,status,referral_date,sent_at,target_program,instruction")
    .eq("target_opd_id", opd.id).eq("jalur", "PEKERJA").neq("status", "DIBATALKAN")
    .order("created_at", { ascending: false }).limit(100);
  if (error || !rows?.length) return PREVIEW_REFERRALS;

  const wargaIds = [...new Set(rows.map((row) => row.warga_id))];
  const programIds = [...new Set(rows.map((row) => row.program_id).filter(Boolean))] as string[];
  const [{ data: wargaRows }, { data: programRows }] = await Promise.all([
    admin.from("warga").select("id,nik,nama_lengkap,kelurahan").in("id", wargaIds),
    programIds.length ? admin.from("master_program_layanan").select("id,nama_program").in("id", programIds) : Promise.resolve({ data: [] }),
  ]);
  const wargaMap = new Map((wargaRows ?? []).map((row) => [row.id, row]));
  const programMap = new Map((programRows ?? []).map((row) => [row.id, row.nama_program]));
  return rows.flatMap((row): DisnakerReferral[] => {
    const warga = wargaMap.get(row.warga_id);
    if (!warga) return [];
    return [{
      id: row.id, code: row.referral_code, name: warga.nama_lengkap, maskedNik: maskNik(warga.nik),
      date: formatDate(row.referral_date ?? row.sent_at), program: (row.program_id ? programMap.get(row.program_id) : null) ?? row.target_program ?? "Program vokasi",
      institution: "Mitra pelaksana ditentukan saat intervensi", desil: 0, kelurahan: warga.kelurahan ?? "—",
      status: mapStatus(row.status), instruction: row.instruction ?? "", attendance: null,
      placementPartner: null, placementDate: null, evaluation: null, isPreview: false,
    }];
  });
}

export async function getDisnakerPrograms(): Promise<DisnakerProgram[]> {
  const admin = createAdminClient();
  const { data: opd } = await admin.from("master_opd").select("id").eq("kode_opd", "DISNAKER").maybeSingle();
  if (!opd) return PREVIEW_PROGRAMS;
  const { data, error } = await admin.from("master_program_layanan")
    .select("id,kode_program,nama_program,is_active")
    .eq("opd_id", opd.id).or("jalur.eq.PEKERJA,jalur.is.null").order("nama_program");
  if (error || !data?.length) return PREVIEW_PROGRAMS;
  return data.map((row) => ({
    id: row.id, code: row.kode_program, name: row.nama_program, category: "Vokasi",
    institution: "Mitra pelaksana", duration: "—", filled: 0, capacity: 0,
    status: row.is_active ? "AKTIF" : "PENUH", location: "Kota Bandung",
    qualification: "Sesuai kurikulum program", isPreview: false,
  }));
}

export async function getDisnakerDashboardData() {
  const referrals = await getDisnakerReferrals();
  const preview = referrals.every((item) => item.isPreview);
  return {
    referrals,
    summary: preview ? { newReferrals: 12, inTraining: 48, placed: 185 } : {
      newReferrals: referrals.filter((item) => item.status === "PERLU_DIPROSES").length,
      inTraining: referrals.filter((item) => item.status === "SEDANG_PELATIHAN").length,
      placed: referrals.filter((item) => item.status === "BEKERJA_SELESAI").length,
    },
    preview,
  };
}
