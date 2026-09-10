import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { mapDinsosRpcError, saveAssessment } from "@/lib/dinsos/assessment";
import { parseAssessmentInput } from "@/lib/dinsos/assessment-input";
import { assertCaseId } from "@/lib/dinsos/request";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(request:Request,{params}:{params:Promise<{caseId:string}>}){try{assertSameOrigin(request);assertBodySize(request);const actor=await requireDinsosActor();const {caseId}=await params;assertCaseId(caseId);const values=parseAssessmentInput(await request.json(),true);const assessment=await saveAssessment(caseId,actor,values);const admin=createAdminClient();const {data,error}=await admin.rpc("dinsos_complete_assessment",{p_case_id:caseId,p_actor_id:actor.profileId});if(error)throw mapDinsosRpcError(error);await writeActivityLog({userId:actor.profileId,namaPengguna:actor.namaLengkap,rolePengguna:actor.role,aktivitas:"Menyelesaikan asesmen sosial",modul:"Dinas Sosial",metadata:{caseId,assessmentId:assessment.id,stage:data?.stage}});return NextResponse.json({ok:true,...data});}catch(error){return apiErrorResponse(error,"Dinsos assessment complete failed","Asesmen tidak dapat diselesaikan.")}}
