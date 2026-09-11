import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DisbudparShell } from "@/components/disbudpar/shell/disbudpar-shell";
import { requireDisbudparActor } from "@/lib/auth/require-disbudpar-actor";

export const metadata: Metadata = { title: "Disbudpar | Platform MBI" };

async function getActor() {
  try { return await requireDisbudparActor(); } catch { return null; }
}

export default async function DisbudparLayout({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return <DisbudparShell namaLengkap={actor.namaLengkap}>{children}</DisbudparShell>;
}
