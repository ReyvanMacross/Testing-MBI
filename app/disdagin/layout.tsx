import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DisdaginShell } from "@/components/disdagin/shell/disdagin-shell";
import { requireDisdaginActor } from "@/lib/auth/require-disdagin-actor";

export const metadata: Metadata = { title: "Disdagin | Platform MBI" };

async function getActor() {
  try { return await requireDisdaginActor(); } catch { return null; }
}

export default async function DisdaginLayout({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return <DisdaginShell namaLengkap={actor.namaLengkap}>{children}</DisdaginShell>;
}
