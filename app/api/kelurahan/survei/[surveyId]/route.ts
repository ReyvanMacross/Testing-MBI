import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireKelurahanActor } from "@/lib/auth/require-kelurahan-actor";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { mapKelurahanError } from "@/lib/kelurahan/api-error";
import { id, parseSurvey } from "@/lib/kelurahan/input";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request:Request,{params}:{params:Promise<{surveyId:string}>}) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor=await requireKelurahanActor(); const surveyId=id((await params).surveyId,"Survei"); const input=parseSurvey(await request.json());
    const {data,error}=await createAdminClient().rpc("kelurahan_complete_survey",{
      p_survey_id:surveyId,p_actor_id:actor.profileId,p_score:input.score,p_factual_desil:input.factualDesil,
      p_notes:input.notes,p_expected_version:input.expectedVersion,
    });
    if(error) throw mapKelurahanError(error,"Hasil survei tidak dapat disimpan.");
    await writeActivityLog({userId:actor.profileId,namaPengguna:actor.namaLengkap,rolePengguna:actor.role,aktivitas:"Menyelesaikan survei faktual Kelurahan",modul:"Kelurahan",metadata:{surveyId}});
    return NextResponse.json({ok:true,...data});
  } catch(error) { return apiErrorResponse(error,"Kelurahan survey completion failed","Hasil survei tidak dapat disimpan."); }
}
