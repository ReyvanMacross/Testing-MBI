import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireKecamatanActor } from "@/lib/auth/require-kecamatan-actor";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { mapKecamatanError } from "@/lib/kecamatan/api-error";
import { assertKecamatanId, parseReferralInput } from "@/lib/kecamatan/input";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor = await requireKecamatanActor(); const proposalId = assertKecamatanId((await params).proposalId, "Usulan");
    const input = parseReferralInput(await request.json());
    const { data, error } = await createAdminClient().rpc("kecamatan_send_referral", { p_proposal_id: proposalId, p_actor_id: actor.profileId, p_program_id: input.programId, p_category: input.category, p_instruction: input.instruction, p_sla_hours: input.slaHours });
    if (error) throw mapKecamatanError(error, "Rujukan tidak dapat dikirim.");
    await writeActivityLog({ userId: actor.profileId, namaPengguna: actor.namaLengkap, rolePengguna: actor.role, aktivitas: "Mengirim rujukan kewilayahan ke OPD", modul: "Kecamatan", metadata: { proposalId, referralId: data.referralId } });
    return NextResponse.json({ ok: true, ...data }, { status: 201 });
  } catch (error) { return apiErrorResponse(error, "Kecamatan referral failed", "Rujukan tidak dapat dikirim."); }
}
