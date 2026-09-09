import { ProgramCatalog } from "@/components/disnaker/program/program-catalog";
import { getDisnakerPrograms, getDisnakerProviders, getDisnakerReferrals } from "@/lib/disnaker/data";

export const dynamic = "force-dynamic";

export default async function ProgramPage() {
  const [programs, referrals, providers] = await Promise.all([getDisnakerPrograms(), getDisnakerReferrals(), getDisnakerProviders()]);
  return <ProgramCatalog initialPrograms={programs} referrals={referrals} providers={providers} />;
}
