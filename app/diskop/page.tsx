import { DiskopDashboard } from "@/components/diskop/dashboard/diskop-dashboard";
import { getDiskopDashboardData, getDiskopMentors, getDiskopPrograms } from "@/lib/diskop/data";

export const dynamic = "force-dynamic";

export default async function DiskopPage() {
  const [dashboard, programs, mentors] = await Promise.all([
    getDiskopDashboardData(),
    getDiskopPrograms(),
    getDiskopMentors(),
  ]);
  return <DiskopDashboard initialReferrals={dashboard.referrals} programs={programs} mentors={mentors} summary={dashboard.summary} preview={dashboard.preview} />;
}
