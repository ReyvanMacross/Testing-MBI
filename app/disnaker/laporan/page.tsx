import { PlacementReport } from "@/components/disnaker/report/placement-report";
import { getDisnakerReferrals, PREVIEW_PARTNERS } from "@/lib/disnaker/data";

export const dynamic = "force-dynamic";

export default async function PlacementReportPage() {
  const referrals = await getDisnakerReferrals();
  return <PlacementReport partners={PREVIEW_PARTNERS} referrals={referrals} />;
}
