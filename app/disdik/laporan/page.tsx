import { EducationReportView } from "@/components/disdik/report/education-report";
import { getDisdikEducationReport } from "@/lib/disdik/data";

export const dynamic = "force-dynamic";

export default async function EducationReportPage() {
  const report = await getDisdikEducationReport();
  return <EducationReportView reports={report.reports} summary={report.summary} />;
}
