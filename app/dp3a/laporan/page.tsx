import { Dp3aReportView } from "@/components/dp3a/report/dp3a-report";
import { getDp3aReport } from "@/lib/dp3a/data";

export const dynamic = "force-dynamic";

export default async function Dp3aReportPage() {
  const report = await getDp3aReport();
  return <Dp3aReportView reports={report.reports} summary={report.summary} />;
}
