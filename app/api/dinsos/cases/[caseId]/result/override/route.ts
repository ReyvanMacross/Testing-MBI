import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { assertCaseId } from "@/lib/dinsos/request";
import { overrideDinsosResult } from "@/lib/dinsos/results";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
export async function POST(request:Request,{params}:{params:Promise<{caseId:string}>}){try{assertSameOrigin(request);assertBodySize(request,8192);const actor=await requireDinsosActor();const {caseId}=await params;assertCaseId(caseId);const body=await request.json();const result=await overrideDinsosResult(caseId,actor,Number(body.newDesil),typeof body.reason==="string"?body.reason:"");await writeActivityLog({userId:actor.profileId,namaPengguna:actor.namaLengkap,rolePengguna:actor.role,aktivitas:"Melakukan override desil operasional",modul:"Dinas Sosial",metadata:{caseId,oldDesil:result?.oldDesil,newDesil:result?.newDesil}});return NextResponse.json({ok:true,...result});}catch(error){return apiErrorResponse(error,"Dinsos result override failed","Override tidak dapat diproses.")}}
