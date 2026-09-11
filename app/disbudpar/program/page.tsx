import { ProgramCatalog } from "@/components/disbudpar/program/program-catalog";
import { getDisbudparOfficers, getDisbudparPrograms, getDisbudparReferrals } from "@/lib/disbudpar/data";

export const dynamic = "force-dynamic";

export default async function ProgramPage() {
  const [programs, referrals, officers] = await Promise.all([getDisbudparPrograms(), getDisbudparReferrals(), getDisbudparOfficers()]);
  return <ProgramCatalog initialPrograms={programs} referrals={referrals} officers={officers} />;
}
