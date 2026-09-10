import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { apiErrorResponse, ApiError } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { resolveHomeRoute } from "@/lib/auth/resolve-home-route";

const LOGIN_ERROR =
  "Kombinasi Nama Pengguna/NIP atau Kata Sandi salah. Silakan coba lagi atau hubungi Admin.";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertBodySize(request, 8192);
    const body = await request.json();

    const identifier =
      typeof body.identifier === "string" ? body.identifier.trim() : "";

    const password = typeof body.password === "string" ? body.password : "";

    if (
      !identifier ||
      !password ||
      identifier.length > 100 ||
      password.length > 1024
    ) {
      return NextResponse.json({ error: LOGIN_ERROR }, { status: 400 });
    }

    const admin = createAdminClient();

    const isNip = /^\d{18}$/.test(identifier);

    let profileQuery = admin
      .from("user_profiles")
      .select("id, auth_user_id, email, nama_lengkap, status, role, opd_id, master_opd(kode_opd)");

    if (isNip) {
      profileQuery = profileQuery.eq("nip", identifier);
    } else {
      profileQuery = profileQuery.eq("username", identifier.toLowerCase());
    }

    const { data: profile, error: profileError } =
      await profileQuery.maybeSingle();

    if (
      profileError ||
      !profile ||
      !profile.auth_user_id ||
      !profile.email ||
      profile.status !== "AKTIF"
    ) {
      return NextResponse.json({ error: LOGIN_ERROR }, { status: 401 });
    }

    const opd = Array.isArray(profile.master_opd)
      ? profile.master_opd[0]
      : profile.master_opd;
    const redirectTo = resolveHomeRoute({
      role: profile.role,
      opdCode: opd?.kode_opd ?? null,
    });

    if (!redirectTo) {
      return NextResponse.json({ error: LOGIN_ERROR }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
      });

    if (
      authError ||
      !authData.user ||
      authData.user.id !== profile.auth_user_id
    ) {
      await supabase.auth.signOut();

      return NextResponse.json({ error: LOGIN_ERROR }, { status: 401 });
    }

    await writeActivityLog({
      userId: profile.id,
      namaPengguna: profile.nama_lengkap,
      rolePengguna: profile.role,
      aktivitas: "Login berhasil",
      modul: "Autentikasi",
    });

    return NextResponse.json({ ok: true, redirectTo });
  } catch (error) {
    if (error instanceof ApiError) {
      return apiErrorResponse(error, "Login request rejected");
    }
    return NextResponse.json({ error: LOGIN_ERROR }, { status: 500 });
  }
}
