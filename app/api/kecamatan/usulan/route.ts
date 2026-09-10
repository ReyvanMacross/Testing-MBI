import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireKecamatanActor } from "@/lib/auth/require-kecamatan-actor";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { mapKecamatanError } from "@/lib/kecamatan/api-error";
import { parseProposalInput } from "@/lib/kecamatan/input";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor = await requireKecamatanActor(); const input = parseProposalInput(await request.json());
    const { data, error } = await createAdminClient().rpc("kecamatan_create_proposal", {
      p_actor_id: actor.profileId, p_warga_id: input.wargaId, p_kelurahan_id: input.kelurahanId,
      p_rt: input.rt, p_rw: input.rw, p_initial_desil: input.initialDesil,
      p_target_program_id: input.targetProgramId, p_reason: input.reason, p_is_fixture: false,
    });
    if (error) throw mapKecamatanError(error, "Usulan warga tidak dapat disimpan.");
    await writeActivityLog({ userId: actor.profileId, namaPengguna: actor.namaLengkap, rolePengguna: actor.role, aktivitas: "Membuat usulan warga kewilayahan", modul: "Kecamatan", metadata: { proposalId: data.proposalId } });
    return NextResponse.json({ ok: true, ...data }, { status: 201 });
  } catch (error) { return apiErrorResponse(error, "Kecamatan proposal creation failed", "Usulan warga tidak dapat disimpan."); }
}
