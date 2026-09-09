import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DisnakerShell } from "@/components/disnaker/shell/disnaker-shell";
import { requireDisnakerActor } from "@/lib/auth/require-disnaker-actor";

export const metadata: Metadata = { title: "Dinas Tenaga Kerja | Platform MBI" };

async function getActor() {
  try { return await requireDisnakerActor(); } catch { return null; }
}

export default async function DisnakerLayout({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return <DisnakerShell namaLengkap={actor.namaLengkap}>{children}</DisnakerShell>;
}
