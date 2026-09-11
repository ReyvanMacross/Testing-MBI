import { DisdaginDashboard } from "@/components/disdagin/dashboard/disdagin-dashboard";
import { getDisdaginDashboardData, getDisdaginMentors, getDisdaginPrograms } from "@/lib/disdagin/data";

export const dynamic = "force-dynamic";

export default async function DisdaginPage() {
  const [dashboard, programs, mentors] = await Promise.all([
    getDisdaginDashboardData(),
    getDisdaginPrograms(),
    getDisdaginMentors(),
  ]);
  return <DisdaginDashboard initialReferrals={dashboard.referrals} programs={programs} mentors={mentors} summary={dashboard.summary} preview={dashboard.preview} />;
}
