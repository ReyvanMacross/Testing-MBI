import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { BapperidaShell } from "@/components/bapperida/shell/bapperida-shell";
import { requireBapperidaActor } from "@/lib/auth/require-bapperida-actor";

export const metadata: Metadata = { title: "Bapperida | Platform MBI" };

async function getActor() {
  try { return await requireBapperidaActor(); } catch { return null; }
}

export default async function Layout({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return <BapperidaShell namaLengkap={actor.namaLengkap}>{children}</BapperidaShell>;
}
