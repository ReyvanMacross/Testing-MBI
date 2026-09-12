import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireKelurahanActor } from "@/lib/auth/require-kelurahan-actor";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { mapKelurahanError } from "@/lib/kelurahan/api-error";
import { parseProposal } from "@/lib/kelurahan/input";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor=await requireKelurahanActor(); const input=parseProposal(await request.json());
    const {data,error}=await createAdminClient().rpc("kelurahan_create_proposal",{
      p_actor_id:actor.profileId,p_warga_id:input.citizenId,p_rt:input.rt,p_rw:input.rw,
      p_estimated_desil:input.estimatedDesil,p_target_program_id:input.targetProgramId,p_reason:input.reason,p_is_fixture:false,
    });
    if(error) throw mapKelurahanError(error,"Usulan tidak dapat disimpan.");
    await writeActivityLog({userId:actor.profileId,namaPengguna:actor.namaLengkap,rolePengguna:actor.role,aktivitas:"Membuat usulan warga Kelurahan",modul:"Kelurahan",metadata:{proposalId:data?.proposalId}});
    return NextResponse.json({ok:true,...data},{status:201});
  } catch(error) { return apiErrorResponse(error,"Kelurahan proposal creation failed","Usulan tidak dapat disimpan."); }
}
