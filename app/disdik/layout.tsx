import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DisdikShell } from "@/components/disdik/shell/disdik-shell";
import { requireDisdikActor } from "@/lib/auth/require-disdik-actor";

export const metadata: Metadata = { title: "Disdik | Platform MBI" };

async function getActor() {
  try { return await requireDisdikActor(); } catch { return null; }
}

export default async function DisdikLayout({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return <DisdikShell namaLengkap={actor.namaLengkap}>{children}</DisdikShell>;
}
