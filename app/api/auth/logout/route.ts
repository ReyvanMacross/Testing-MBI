import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await createClient();

    const { data: claimsData } = await supabase.auth.getClaims();
    const authUserId = claimsData?.claims?.sub;

    if (authUserId) {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("user_profiles")
        .select("id, nama_lengkap, role")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (profile) {
        await writeActivityLog({
          userId: profile.id,
          namaPengguna: profile.nama_lengkap,
          rolePengguna: profile.role,
          aktivitas: "Logout dari platform MBI",
          modul: "Autentikasi",
        });
      }
    }

    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "Logout failed", "Gagal keluar dari sistem.");
  }
}
