import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { WalikotaShell } from "@/components/walikota/shell/walikota-shell";
import { requireWalikotaActor } from "@/lib/auth/require-walikota-actor";

export const metadata: Metadata = { title: "Wali Kota | Platform MBI" };

async function getActor() { try { return await requireWalikotaActor(); } catch { return null; } }

export default async function Layout({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return <WalikotaShell namaLengkap={actor.namaLengkap}>{children}</WalikotaShell>;
}
