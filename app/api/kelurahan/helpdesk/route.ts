import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireKelurahanActor } from "@/lib/auth/require-kelurahan-actor";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { mapKelurahanError } from "@/lib/kelurahan/api-error";
import { parseHelpdesk } from "@/lib/kelurahan/input";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request:Request) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor=await requireKelurahanActor(); const input=parseHelpdesk(await request.json());
    const {data,error}=await createAdminClient().rpc("kelurahan_create_helpdesk_ticket",{p_actor_id:actor.profileId,p_category:input.category,p_description:input.description,p_is_fixture:false});
    if(error) throw mapKelurahanError(error,"Tiket helpdesk tidak dapat dikirim.");
    await writeActivityLog({userId:actor.profileId,namaPengguna:actor.namaLengkap,rolePengguna:actor.role,aktivitas:"Mengirim tiket helpdesk Kelurahan",modul:"Kelurahan",metadata:{ticketId:data?.ticketId}});
    return NextResponse.json({ok:true,...data},{status:201});
  } catch(error) { return apiErrorResponse(error,"Kelurahan helpdesk failed","Tiket helpdesk tidak dapat dikirim."); }
}
