import { OutcomeDashboard } from "@/components/bapperida/dashboard/outcome-dashboard";
import { getBapperidaDashboard } from "@/lib/bapperida/data";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string; kecamatan?: string; kelurahan?: string }> }) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const requestedYear = Number(params.year);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2020 && requestedYear <= currentYear + 1 ? requestedYear : currentYear;
  const data = await getBapperidaDashboard(year);
  return <OutcomeDashboard data={data} kecamatan={params.kecamatan} kelurahan={params.kelurahan} />;
}
