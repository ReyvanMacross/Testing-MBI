export const DINSOS_STAGES = [
  "MENUNGGU_ASESMEN",
  "MENUNGGU_PENETAPAN_DESIL",
  "STABILISASI_DIBUTUHKAN",
  "MENUNGGU_STABILISASI",
  "MENUNGGU_SPLIT_JALUR",
  "REFERRAL_TERKIRIM",
  "SELESAI",
  "DIBATALKAN",
] as const;

export type DinsosStage = (typeof DINSOS_STAGES)[number];

export function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    MENUNGGU_ASESMEN: "ASESMEN",
    MENUNGGU_PENETAPAN_DESIL: "VERIFIKASI SELESAI",
    STABILISASI_DIBUTUHKAN: "STABILISASI",
    MENUNGGU_STABILISASI: "STABILISASI",
    MENUNGGU_SPLIT_JALUR: "SPLIT JALUR",
    REFERRAL_TERKIRIM: "REFERRAL TERKIRIM",
    SELESAI: "SELESAI",
    DIBATALKAN: "DIBATALKAN",
  };
  return labels[stage] ?? stage.replaceAll("_", " ");
}

export function canOpenAssessment(stage: string, assessmentStatus?: string | null) {
  return stage === "MENUNGGU_ASESMEN" || assessmentStatus === "COMPLETED";
}

export function canOpenResult(assessmentStatus?: string | null) {
  return assessmentStatus === "COMPLETED";
}

export function canOpenReferral(resultStatus?: string | null) {
  return resultStatus === "CONFIRMED";
}
