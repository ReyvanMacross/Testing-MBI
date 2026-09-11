import { DkppDashboard } from "@/components/dkpp/dashboard/dkpp-dashboard";
import { getDkppDashboardData, getDkppOfficers, getDkppPrograms } from "@/lib/dkpp/data";

export const dynamic = "force-dynamic";

export default async function DkppPage() {
  const [dashboard, programs, officers] = await Promise.all([
    getDkppDashboardData(),
    getDkppPrograms(),
    getDkppOfficers(),
  ]);
  return <DkppDashboard initialReferrals={dashboard.referrals} programs={programs} officers={officers} summary={dashboard.summary} preview={dashboard.preview} />;
}
