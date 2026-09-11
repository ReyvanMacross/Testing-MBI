import { ProgramCatalog } from "@/components/disdagin/program/program-catalog";
import { getDisdaginMentors, getDisdaginPrograms, getDisdaginReferrals } from "@/lib/disdagin/data";

export const dynamic = "force-dynamic";

export default async function ProgramPage() {
  const [programs, referrals, mentors] = await Promise.all([getDisdaginPrograms(), getDisdaginReferrals(), getDisdaginMentors()]);
  return <ProgramCatalog initialPrograms={programs} referrals={referrals} mentors={mentors} />;
}
