import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireKelurahanActor } from "@/lib/auth/require-kelurahan-actor";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { mapKelurahanError } from "@/lib/kelurahan/api-error";
import { id, parseHandoff } from "@/lib/kelurahan/input";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request:Request,{params}:{params:Promise<{proposalId:string}>}) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor=await requireKelurahanActor(); const proposalId=id((await params).proposalId,"Usulan"); const input=parseHandoff(await request.json());
    const {data,error}=await createAdminClient().rpc("kelurahan_send_to_kecamatan",{
      p_proposal_id:proposalId,p_actor_id:actor.profileId,p_note:input.note,p_expected_version:input.expectedVersion,
    });
    if(error) throw mapKelurahanError(error,"Usulan tidak dapat dikirim ke Kecamatan.");
    await writeActivityLog({userId:actor.profileId,namaPengguna:actor.namaLengkap,rolePengguna:actor.role,aktivitas:"Mengirim usulan terverifikasi ke Kecamatan",modul:"Kelurahan",metadata:{proposalId,kecamatanProposalId:data?.kecamatanProposalId}});
    return NextResponse.json({ok:true,...data});
  } catch(error) { return apiErrorResponse(error,"Kelurahan handoff failed","Usulan tidak dapat dikirim ke Kecamatan."); }
}
