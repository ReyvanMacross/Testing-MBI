import { NextResponse } from "next/server";

import { requireAdminDiskominfo } from "@/lib/auth/require-admin-diskominfo";
import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCreateUserInput } from "@/lib/diskominfo/user-input";
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

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertBodySize(request);
    const actor = await requireAdminDiskominfo();
    const input = parseCreateUserInput(await request.json());
    const admin = createAdminClient();

    await assertUniqueUserIdentity(admin, input);

    const assignment = await validateUserAssignment(
      admin,
      input.role,
      input.opdId,
      input.wilayahId,
    );

    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      if (authError?.message.toLowerCase().includes("already")) {
        throw new UserValidationError("Email sudah digunakan.", 409);
      }

      throw new Error(authError?.message ?? "Auth user creation failed.");
    }

    const authUserId = authData.user.id;

    const { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .insert({
        auth_user_id: authUserId,
        email: input.email,
        nip: input.nip,
        username: input.username,
        nama_lengkap: input.namaLengkap,
        role: input.role,
        opd_id: assignment.opd?.id ?? null,
        wilayah_id: assignment.wilayah?.id ?? null,
        status: "AKTIF",
        wilayah: assignment.wilayahLegacy,
        instansi: assignment.instansi,
      })
      .select("id, nama_lengkap")
      .single();

    if (profileError || !profile) {
      await admin.auth.admin.deleteUser(authUserId);
      throw new Error(profileError?.message ?? "Profile creation failed.");
    }

    await writeActivityLog({
      userId: actor.profileId,
      namaPengguna: actor.namaLengkap,
      rolePengguna: actor.role,
      aktivitas: `Membuat akun baru: ${profile.nama_lengkap}`,
      modul: "Manajemen Akun",
      metadata: {
        targetUserId: profile.id,
        targetAuthUserId: authUserId,
      },
    });

    return NextResponse.json(
      { success: true, user: { id: profile.id } },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(
      error,
      "User creation failed",
      "Akun tidak dapat dibuat. Silakan coba lagi.",
    );
  }
}
