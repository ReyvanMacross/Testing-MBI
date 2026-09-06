import { NextResponse } from "next/server";

import { requireAdminDiskominfo } from "@/lib/auth/require-admin-diskominfo";
import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseUpdateUserInput } from "@/lib/diskominfo/user-input";
import {
  assertUniqueUserIdentity,
} from "@/lib/diskominfo/user-mutation-helpers";
import {
  UserValidationError,
  validateUserAssignment,
} from "@/lib/diskominfo/validate-user-assignment";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    assertBodySize(request);
    const actor = await requireAdminDiskominfo();
    const { id } = await context.params;

    if (!UUID_PATTERN.test(id)) {
      throw new UserValidationError("Akun pengguna tidak valid.");
    }

    const admin = createAdminClient();
    const { data: current, error: currentError } = await admin
      .from("user_profiles")
      .select(
        "id, auth_user_id, email, nip, username, nama_lengkap, role, opd_id, wilayah_id, status, wilayah, instansi",
      )
      .eq("id", id)
      .maybeSingle();

    if (currentError) {
      throw new Error(currentError.message);
    }

    if (!current) {
      return NextResponse.json(
        { error: "Akun pengguna tidak ditemukan." },
        { status: 404 },
      );
    }

    const input = parseUpdateUserInput(await request.json());

    if (input.email !== current.email.toLowerCase()) {
      throw new UserValidationError(
        "Email tidak dapat diubah melalui formulir ini.",
      );
    }

    if (
      input.status === "NONAKTIF" &&
      current.auth_user_id === actor.authUserId
    ) {
      throw new UserValidationError(
        "Anda tidak dapat menonaktifkan akun sendiri.",
      );
    }

    await assertUniqueUserIdentity(admin, {
      email: input.email,
      username: input.username,
      nip: input.nip,
      excludeId: id,
    });

    const assignment = await validateUserAssignment(
      admin,
      input.role,
      input.opdId,
      input.wilayahId,
      { allowUnchangedLegacyRole: current.role },
    );

    const nextValues = {
      nama_lengkap: input.namaLengkap,
      username: input.username,
      nip: input.nip,
      role: input.role,
      opd_id: assignment.opd?.id ?? null,
      wilayah_id: assignment.wilayah?.id ?? null,
      status: input.status,
      wilayah: assignment.wilayahLegacy,
      instansi: assignment.instansi,
    };

    const changedFields = Object.entries(nextValues)
      .filter(([key, value]) => {
        const currentValue = current[key as keyof typeof current];
        return (currentValue ?? null) !== (value ?? null);
      })
      .map(([key]) => key);

    const { data: updated, error: updateError } = await admin
      .from("user_profiles")
      .update(nextValues)
      .eq("id", id)
      .select("id, nama_lengkap")
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "Profile update failed.");
    }

    await writeActivityLog({
      userId: actor.profileId,
      namaPengguna: actor.namaLengkap,
      rolePengguna: actor.role,
      aktivitas: `Memperbarui akun: ${updated.nama_lengkap}`,
      modul: "Manajemen Akun",
      metadata: {
        targetUserId: current.id,
        changedFields,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(
      error,
      "User update failed",
      "Perubahan akun tidak dapat disimpan. Silakan coba lagi.",
    );
  }
}
