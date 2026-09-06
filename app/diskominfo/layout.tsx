import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/diskominfo/dashboard-shell";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard Diskominfo | Platform MBI",
};

export default async function DiskominfoLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();

  const authUserId = data?.claims?.sub;

  if (error || !authUserId) {
    redirect("/login");
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("nama_lengkap, role, email, instansi, wilayah, status")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (
    !profile ||
    profile.status !== "AKTIF" ||
    profile.role !== "Admin Diskominfo"
  ) {
    redirect("/login");
  }

  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}
