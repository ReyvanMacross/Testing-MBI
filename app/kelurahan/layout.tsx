import type { ReactNode } from "react";

import { KelurahanShell } from "@/components/kelurahan/shell/kelurahan-shell";
import { requireKelurahanActor } from "@/lib/auth/require-kelurahan-actor";

export default async function KelurahanLayout({children}:{children:ReactNode}) {
  const actor=await requireKelurahanActor();
  return <KelurahanShell namaLengkap={actor.namaLengkap} kelurahan={actor.kelurahanNama}>{children}</KelurahanShell>;
}
