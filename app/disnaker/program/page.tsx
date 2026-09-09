import { ProgramCatalog } from "@/components/disnaker/program/program-catalog";
import { getDisnakerPrograms, getDisnakerReferrals } from "@/lib/disnaker/data";

export const dynamic = "force-dynamic";

export default async function ProgramPage() {
  const [programs, referrals] = await Promise.all([getDisnakerPrograms(), getDisnakerReferrals()]);
  return <ProgramCatalog initialPrograms={programs} referrals={referrals} />;
}
