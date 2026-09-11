import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { KecamatanShell } from "@/components/kecamatan/shell/kecamatan-shell";
import { requireKecamatanActor } from "@/lib/auth/require-kecamatan-actor";

export const metadata: Metadata = { title: "Kecamatan | Platform MBI" };

export default async function KecamatanLayout({ children }: { children: ReactNode }) {
  let actor;
  try { actor = await requireKecamatanActor(); } catch { redirect("/login"); }
  return <KecamatanShell namaLengkap={actor.namaLengkap} kecamatan={actor.kecamatanNama}>{children}</KecamatanShell>;
}
