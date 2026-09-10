import { Dp3aDashboard } from "@/components/dp3a/dashboard/dp3a-dashboard";
import { getDp3aDashboardData, getDp3aPrograms, getDp3aServiceUnits } from "@/lib/dp3a/data";

export const dynamic = "force-dynamic";

export default async function Dp3aPage() {
  const [dashboard, programs, units] = await Promise.all([
    getDp3aDashboardData(),
    getDp3aPrograms(),
    getDp3aServiceUnits(),
  ]);
  return <Dp3aDashboard initialReferrals={dashboard.referrals} programs={programs} units={units} summary={dashboard.summary} preview={dashboard.preview} />;
}
