import { CreativeReportView } from "@/components/disbudpar/report/creative-report";
import { getDisbudparCreativeReport } from "@/lib/disbudpar/data";

export const dynamic = "force-dynamic";

export default async function CreativeReportViewPage() {
  const report = await getDisbudparCreativeReport();
  return <CreativeReportView beneficiaries={report.beneficiaries} summary={report.summary} />;
}
