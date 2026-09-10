import { ProgramCatalog } from "@/components/disdik/program/program-catalog";
import { getDisdikPrograms, getDisdikReferrals, getDisdikSchools, previewEnabled } from "@/lib/disdik/data";

export const dynamic = "force-dynamic";

export default async function ProgramPage() {
  const [programs, referrals, schools] = await Promise.all([getDisdikPrograms(), getDisdikReferrals(), getDisdikSchools()]);
  return <ProgramCatalog initialPrograms={programs} referrals={referrals} schools={schools} preview={previewEnabled} />;
}
