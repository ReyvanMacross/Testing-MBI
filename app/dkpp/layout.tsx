import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DkppShell } from "@/components/dkpp/shell/dkpp-shell";
import { requireDkppActor } from "@/lib/auth/require-dkpp-actor";

export const metadata: Metadata = { title: "Dkpp | Platform MBI" };

async function getActor() {
  try { return await requireDkppActor(); } catch { return null; }
}

export default async function DkppLayout({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return <DkppShell namaLengkap={actor.namaLengkap}>{children}</DkppShell>;
}
