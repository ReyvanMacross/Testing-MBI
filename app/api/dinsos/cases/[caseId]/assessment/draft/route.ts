import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { parseAssessmentInput } from "@/lib/dinsos/assessment-input";
import { saveAssessment } from "@/lib/dinsos/assessment";
import { assertCaseId } from "@/lib/dinsos/request";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
export async function POST(request:Request,{params}:{params:Promise<{caseId:string}>}){try{assertSameOrigin(request);assertBodySize(request);const actor=await requireDinsosActor();const {caseId}=await params;assertCaseId(caseId);const values=parseAssessmentInput(await request.json(),false);const assessment=await saveAssessment(caseId,actor,values);await writeActivityLog({userId:actor.profileId,namaPengguna:actor.namaLengkap,rolePengguna:actor.role,aktivitas:"Menyimpan draft asesmen sosial",modul:"Dinas Sosial",metadata:{caseId,assessmentId:assessment.id,stage:"MENUNGGU_ASESMEN"}});return NextResponse.json({ok:true,assessmentId:assessment.id});}catch(error){return apiErrorResponse(error,"Dinsos assessment draft failed","Asesmen tidak dapat disimpan.")}}
