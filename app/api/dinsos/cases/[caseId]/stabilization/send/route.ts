import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { sendStabilizationReferral } from "@/lib/dinsos/referrals";
import { assertCaseId } from "@/lib/dinsos/request";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
export async function POST(request:Request,{params}:{params:Promise<{caseId:string}>}){try{assertSameOrigin(request);assertBodySize(request,1024);const actor=await requireDinsosActor();const {caseId}=await params;assertCaseId(caseId);const result=await sendStabilizationReferral(caseId,actor);await writeActivityLog({userId:actor.profileId,namaPengguna:actor.namaLengkap,rolePengguna:actor.role,aktivitas:"Mengirim referral Proteksi dan Stabilisasi",modul:"Dinas Sosial",metadata:{caseId,referralId:result?.referralId,oldStage:"STABILISASI_DIBUTUHKAN",newStage:result?.stage}});return NextResponse.json({ok:true,...result});}catch(error){return apiErrorResponse(error,"Dinsos stabilization referral failed","Referral tidak dapat dikirim.")}}
