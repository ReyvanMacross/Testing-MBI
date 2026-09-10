import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Dp3aShell } from "@/components/dp3a/shell/dp3a-shell";
import { requireDp3aActor } from "@/lib/auth/require-dp3a-actor";

export const metadata: Metadata = { title: "DP3A | Platform MBI" };

async function getActor() {
  try { return await requireDp3aActor(); } catch { return null; }
}

export default async function Dp3aLayout({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return <Dp3aShell namaLengkap={actor.namaLengkap}>{children}</Dp3aShell>;
}
