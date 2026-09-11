import { ProgramCatalog } from "@/components/dkpp/program/program-catalog";
import { getDkppOfficers, getDkppPrograms, getDkppReferrals } from "@/lib/dkpp/data";

export const dynamic = "force-dynamic";

export default async function ProgramPage() {
  const [programs, referrals, officers] = await Promise.all([getDkppPrograms(), getDkppReferrals(), getDkppOfficers()]);
  return <ProgramCatalog initialPrograms={programs} referrals={referrals} officers={officers} />;
}
