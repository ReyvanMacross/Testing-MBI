import { ProgramCatalog } from "@/components/diskop/program/program-catalog";
import { getDiskopMentors, getDiskopPrograms, getDiskopReferrals } from "@/lib/diskop/data";

export const dynamic = "force-dynamic";

export default async function ProgramPage() {
  const [programs, referrals, mentors] = await Promise.all([getDiskopPrograms(), getDiskopReferrals(), getDiskopMentors()]);
  return <ProgramCatalog initialPrograms={programs} referrals={referrals} mentors={mentors} />;
}
