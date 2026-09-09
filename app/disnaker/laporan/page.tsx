import { PlacementReport } from "@/components/disnaker/report/placement-report";
import { getDisnakerPlacementReport } from "@/lib/disnaker/data";

export const dynamic = "force-dynamic";

export default async function PlacementReportPage() {
  const report = await getDisnakerPlacementReport();
  return <PlacementReport partners={report.partners} summary={report.summary} />;
}
