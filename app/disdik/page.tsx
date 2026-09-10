import { DisdikDashboard } from "@/components/disdik/dashboard/disdik-dashboard";
import { getDisdikDashboardData, getDisdikPrograms, getDisdikSchools } from "@/lib/disdik/data";

export const dynamic = "force-dynamic";

export default async function DisdikPage() {
  const [dashboard, programs, schools] = await Promise.all([
    getDisdikDashboardData(),
    getDisdikPrograms(),
    getDisdikSchools(),
  ]);
  return <DisdikDashboard initialReferrals={dashboard.referrals} programs={programs} schools={schools} summary={dashboard.summary} preview={dashboard.preview} />;
}
