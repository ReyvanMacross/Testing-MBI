import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DiskopShell } from "@/components/diskop/shell/diskop-shell";
import { requireDiskopActor } from "@/lib/auth/require-diskop-actor";

export const metadata: Metadata = { title: "Diskop UKM | Platform MBI" };

async function getActor() {
  try { return await requireDiskopActor(); } catch { return null; }
}

export default async function DiskopLayout({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return <DiskopShell namaLengkap={actor.namaLengkap}>{children}</DiskopShell>;
}
