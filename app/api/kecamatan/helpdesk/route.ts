import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireKecamatanActor } from "@/lib/auth/require-kecamatan-actor";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { mapKecamatanError } from "@/lib/kecamatan/api-error";
import { parseHelpdeskInput } from "@/lib/kecamatan/input";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor = await requireKecamatanActor(); const input = parseHelpdeskInput(await request.json());
    const { data, error } = await createAdminClient().rpc("kecamatan_create_helpdesk_ticket", { p_actor_id: actor.profileId, p_warga_id: input.wargaId, p_category: input.category, p_description: input.description, p_is_fixture: false });
    if (error) throw mapKecamatanError(error, "Laporan helpdesk tidak dapat dikirim.");
    await writeActivityLog({ userId: actor.profileId, namaPengguna: actor.namaLengkap, rolePengguna: actor.role, aktivitas: "Mengirim laporan kendala kewilayahan", modul: "Kecamatan", metadata: { ticketId: data.ticketId } });
    return NextResponse.json({ ok: true, ...data }, { status: 201 });
  } catch (error) { return apiErrorResponse(error, "Kecamatan helpdesk ticket failed", "Laporan helpdesk tidak dapat dikirim."); }
}
