import { DisnakerDashboard } from "@/components/disnaker/dashboard/disnaker-dashboard";
import { getDisnakerDashboardData, getDisnakerPrograms } from "@/lib/disnaker/data";

export const dynamic = "force-dynamic";

export default async function DisnakerPage() {
  const [dashboard, programs] = await Promise.all([getDisnakerDashboardData(), getDisnakerPrograms()]);
  return <DisnakerDashboard initialReferrals={dashboard.referrals} programs={programs} summary={dashboard.summary} preview={dashboard.preview} />;
}
