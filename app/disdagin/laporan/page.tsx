import { RevenueReport } from "@/components/disdagin/report/revenue-report";
import { getDisdaginRevenueReport } from "@/lib/disdagin/data";

export const dynamic = "force-dynamic";

export default async function RevenueReportPage() {
  const report = await getDisdaginRevenueReport();
  return <RevenueReport businesses={report.businesses} summary={report.summary} />;
}
