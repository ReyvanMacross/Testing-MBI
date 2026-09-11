import { InfrastructureReportView } from "@/components/cipta-bintar/report/infrastructure-report";
import { getCiptaBintarInfrastructureReport } from "@/lib/cipta-bintar/data";

export const dynamic = "force-dynamic";

export default async function InfrastructureReportViewPage() {
  const report = await getCiptaBintarInfrastructureReport();
  return <InfrastructureReportView beneficiaries={report.beneficiaries} summary={report.summary} />;
}
