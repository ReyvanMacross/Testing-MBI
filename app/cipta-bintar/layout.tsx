import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { CiptaBintarShell } from "@/components/cipta-bintar/shell/cipta-bintar-shell";
import { requireCiptaBintarActor } from "@/lib/auth/require-cipta-bintar-actor";

export const metadata: Metadata = { title: "Cipta Bintar | Platform MBI" };

async function getActor() {
  try { return await requireCiptaBintarActor(); } catch { return null; }
}

export default async function CiptaBintarLayout({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return <CiptaBintarShell namaLengkap={actor.namaLengkap}>{children}</CiptaBintarShell>;
}
