import { RevenueReport } from "@/components/diskop/report/revenue-report";
import { getDiskopRevenueReport } from "@/lib/diskop/data";

export const dynamic = "force-dynamic";

export default async function RevenueReportPage() {
  const report = await getDiskopRevenueReport();
  return <RevenueReport businesses={report.businesses} summary={report.summary} />;
}
