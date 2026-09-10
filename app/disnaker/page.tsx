import { DisnakerDashboard } from "@/components/disnaker/dashboard/disnaker-dashboard";
import { getDisnakerDashboardData, getDisnakerIndustryPartners, getDisnakerPrograms, getDisnakerProviders } from "@/lib/disnaker/data";

export const dynamic = "force-dynamic";

export default async function DisnakerPage() {
  const [dashboard, programs, providers, partners] = await Promise.all([
    getDisnakerDashboardData(),
    getDisnakerPrograms(),
    getDisnakerProviders(),
    getDisnakerIndustryPartners(),
  ]);
  return <DisnakerDashboard initialReferrals={dashboard.referrals} programs={programs} providers={providers} partners={partners} summary={dashboard.summary} preview={dashboard.preview} />;
}
