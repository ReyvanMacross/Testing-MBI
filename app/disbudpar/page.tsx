import { DisbudparDashboard } from "@/components/disbudpar/dashboard/disbudpar-dashboard";
import { getDisbudparDashboardData, getDisbudparOfficers, getDisbudparPrograms } from "@/lib/disbudpar/data";

export const dynamic = "force-dynamic";

export default async function DisbudparPage() {
  const [dashboard, programs, officers] = await Promise.all([
    getDisbudparDashboardData(),
    getDisbudparPrograms(),
    getDisbudparOfficers(),
  ]);
  return <DisbudparDashboard initialReferrals={dashboard.referrals} programs={programs} officers={officers} summary={dashboard.summary} preview={dashboard.preview} />;
}
