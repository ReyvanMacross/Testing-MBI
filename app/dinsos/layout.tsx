import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DinsosShell } from "@/components/dinsos/dinsos-shell";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";

export const metadata: Metadata = { title: "Dinas Sosial | Platform MBI" };

async function getActor() {
  try { return await requireDinsosActor(); } catch { return null; }
}

export default async function DinsosLayout({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return <DinsosShell namaLengkap={actor.namaLengkap}>{children}</DinsosShell>;
}
