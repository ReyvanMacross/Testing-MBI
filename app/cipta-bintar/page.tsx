import { CiptaBintarDashboard } from "@/components/cipta-bintar/dashboard/cipta-bintar-dashboard";
import { getCiptaBintarDashboardData, getCiptaBintarOfficers, getCiptaBintarPrograms } from "@/lib/cipta-bintar/data";

export const dynamic = "force-dynamic";

export default async function CiptaBintarPage() {
  const [dashboard, programs, officers] = await Promise.all([
    getCiptaBintarDashboardData(),
    getCiptaBintarPrograms(),
    getCiptaBintarOfficers(),
  ]);
  return <CiptaBintarDashboard initialReferrals={dashboard.referrals} programs={programs} officers={officers} summary={dashboard.summary} preview={dashboard.preview} />;
}
