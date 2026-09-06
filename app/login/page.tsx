import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
      .select("role, status")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (
      profile?.status === "AKTIF" &&
      profile.role === "Admin Diskominfo"
    ) {
      redirect("/diskominfo");
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
