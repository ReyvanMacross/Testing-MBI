import { ProgramCatalog } from "@/components/cipta-bintar/program/program-catalog";
import { getCiptaBintarOfficers, getCiptaBintarPrograms, getCiptaBintarReferrals } from "@/lib/cipta-bintar/data";

export const dynamic = "force-dynamic";

export default async function ProgramPage() {
  const [programs, referrals, officers] = await Promise.all([getCiptaBintarPrograms(), getCiptaBintarReferrals(), getCiptaBintarOfficers()]);
  return <ProgramCatalog initialPrograms={programs} referrals={referrals} officers={officers} />;
}
