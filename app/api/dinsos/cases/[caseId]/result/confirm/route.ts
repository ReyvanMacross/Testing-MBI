import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { assertCaseId } from "@/lib/dinsos/request";
import { confirmDinsosResult } from "@/lib/dinsos/results";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
export async function POST(request:Request,{params}:{params:Promise<{caseId:string}>}){try{assertSameOrigin(request);assertBodySize(request,1024);const actor=await requireDinsosActor();const {caseId}=await params;assertCaseId(caseId);const result=await confirmDinsosResult(caseId,actor);await writeActivityLog({userId:actor.profileId,namaPengguna:actor.namaLengkap,rolePengguna:actor.role,aktivitas:"Mengonfirmasi hasil desil operasional",modul:"Dinas Sosial",metadata:{caseId,newStage:result?.stage,operationalDesil:result?.operationalDesil}});return NextResponse.json({ok:true,...result});}catch(error){return apiErrorResponse(error,"Dinsos result confirm failed","Hasil Desil tidak dapat dikonfirmasi.")}}
