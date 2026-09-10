import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveHomeRoute } from "@/lib/auth/resolve-home-route";

import LoginForm from "./login-form";
import styles from "./login.module.css";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();

  const authUserId = data?.claims?.sub;

  if (authUserId) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("user_profiles")
      .select("role, status, master_opd(kode_opd)")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (profile?.status === "AKTIF") {
      const opd = Array.isArray(profile.master_opd)
        ? profile.master_opd[0]
        : profile.master_opd;
      const home = resolveHomeRoute({
        role: profile.role,
        opdCode: opd?.kode_opd ?? null,
      });
      if (home) redirect(home);
    }
  }

  const { state } = await searchParams;
  const previewError = state === "error";

  return (
    <main className={styles.page}>
      <div className={styles.visualPanel} aria-hidden="true" />
      <section className={styles.formPanel} aria-labelledby="login-heading">
        <LoginForm
          key={previewError ? "error" : "default"}
          initialError={previewError}
        />
      </section>
    </main>
  );
}
