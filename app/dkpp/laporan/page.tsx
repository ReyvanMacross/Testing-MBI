import { HarvestReport } from "@/components/dkpp/report/harvest-report";
import { getDkppHarvestReport } from "@/lib/dkpp/data";

export const dynamic = "force-dynamic";

export default async function HarvestReportPage() {
  const report = await getDkppHarvestReport();
  return <HarvestReport beneficiaries={report.beneficiaries} summary={report.summary} />;
}
