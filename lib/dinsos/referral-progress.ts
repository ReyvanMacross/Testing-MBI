import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getReferralById } from "./referrals";

export type ReferralTimelineItem = { type: string; title: string; happenedAt: string; targetDate: string | null; completed: boolean };

export async function getReferralProgress(referralId: string) {
  const referral = await getReferralById(referralId);
  if (!referral) return null;
  const admin = createAdminClient();
  const [assessment, decision, events] = await Promise.all([
    referral.assessmentId ? admin.from("dinsos_assessments").select("submitted_at").eq("id", referral.assessmentId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    referral.pathDecisionId ? admin.from("penentuan_jalur").select("finalized_at").eq("id", referral.pathDecisionId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    admin.from("referral_mbi_events").select("event_type,title,event_at,target_date").eq("referral_id", referralId)
      .in("event_type", ["RECEIVED", "PROCESS_STARTED", "PROGRAM_PLANNED", "COMPLETED", "CANCELLED"])
      .order("event_at", { ascending: true }).order("id", { ascending: true }),
  ]);
  if (assessment.error || decision.error || events.error) throw new Error("Gagal mengambil progres referral.");
  const timeline: ReferralTimelineItem[] = [];
  if (assessment.data?.submitted_at) timeline.push({ type: "ASSESSMENT_COMPLETED", title: "Asesmen Lapangan Selesai", happenedAt: assessment.data.submitted_at, targetDate: null, completed: true });
  if (decision.data?.finalized_at) timeline.push({ type: "PATH_FINALIZED", title: "Disetujui & Diterbitkan Jalur", happenedAt: decision.data.finalized_at, targetDate: null, completed: true });
  if (referral.sentAt) timeline.push({ type: "SENT", title: `Rujukan Dikirim ke ${referral.targetOpd}`, happenedAt: referral.sentAt, targetDate: null, completed: true });
  for (const event of events.data ?? []) timeline.push({ type: event.event_type, title: event.title, happenedAt: event.event_at, targetDate: event.target_date, completed: event.event_type !== "PROGRAM_PLANNED" });
  timeline.sort((a, b) => a.happenedAt.localeCompare(b.happenedAt));
  return {
    referralCode: referral.referralCode, referralId: referral.referralId,
    warga: { nama: referral.nama, maskedNik: referral.maskedNik },
    targetOpd: referral.targetOpd, jalur: referral.jalur, program: referral.program,
    status: referral.status, instruction: referral.instruction,
    referralDate: referral.referralDate, kelurahan: referral.kelurahan, timeline,
  };
}
