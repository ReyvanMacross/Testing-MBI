import { ProgramCatalog } from "@/components/dp3a/program/program-catalog";
import { getDp3aPrograms, getDp3aReferrals, getDp3aServiceUnits, previewEnabled } from "@/lib/dp3a/data";

export const dynamic = "force-dynamic";

export default async function ProgramPage() {
  const [programs, referrals, units] = await Promise.all([getDp3aPrograms(), getDp3aReferrals(), getDp3aServiceUnits()]);
  return <ProgramCatalog initialPrograms={programs} initialReferrals={referrals} units={units} preview={previewEnabled} />;
}
