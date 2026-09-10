import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireDiskopActor } from "@/lib/auth/require-diskop-actor";
import { parseProgramInput } from "@/lib/diskop/input";
import { apiErrorResponse, ApiError } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor = await requireDiskopActor();
    const input = parseProgramInput(await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("diskop_create_program", {
      p_actor_id: actor.profileId, p_actor_opd_id: actor.opdId, p_code: input.code,
      p_name: input.name, p_category: input.category, p_pendamping_id: input.pendampingId,
      p_duration_value: input.duration, p_duration_unit: input.durationUnit,
      p_capacity: input.capacity, p_description: input.description,
    });
    if (error?.message.includes("PROGRAM_CODE_EXISTS")) throw new ApiError("Kode program sudah digunakan.", 409);
    if (error?.message.includes("DISKOP_ACTOR_REQUIRED")) throw new ApiError("Akses ditolak.", 403);
    if (error) throw new ApiError("Program tidak dapat disimpan.", 400);
    await writeActivityLog({ userId: actor.profileId, namaPengguna: actor.namaLengkap, rolePengguna: actor.role, aktivitas: "Menambahkan program pendampingan", modul: "Diskop UKM", metadata: { programId: data.programId } });
    return NextResponse.json({ ok: true, ...data }, { status: 201 });
  } catch (error) { return apiErrorResponse(error, "Diskop program creation failed", "Program tidak dapat disimpan."); }
}
