import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireKelurahanActor } from "@/lib/auth/require-kelurahan-actor";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { mapKelurahanError } from "@/lib/kelurahan/api-error";
import { id, parseAssignment } from "@/lib/kelurahan/input";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request:Request,{params}:{params:Promise<{proposalId:string}>}) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor=await requireKelurahanActor(); const proposalId=id((await params).proposalId,"Usulan"); const input=parseAssignment(await request.json());
    const {data,error}=await createAdminClient().rpc("kelurahan_assign_survey",{
      p_proposal_id:proposalId,p_actor_id:actor.profileId,p_surveyor_profile_id:input.surveyorProfileId,
      p_surveyor_name:input.surveyorName,p_instruction:input.instruction,p_expected_version:input.expectedVersion,
    });
    if(error) throw mapKelurahanError(error,"Surveyor tidak dapat ditugaskan.");
    await writeActivityLog({userId:actor.profileId,namaPengguna:actor.namaLengkap,rolePengguna:actor.role,aktivitas:"Menugaskan survei faktual Kelurahan",modul:"Kelurahan",metadata:{proposalId}});
    return NextResponse.json({ok:true,...data});
  } catch(error) { return apiErrorResponse(error,"Kelurahan survey assignment failed","Surveyor tidak dapat ditugaskan."); }
}
