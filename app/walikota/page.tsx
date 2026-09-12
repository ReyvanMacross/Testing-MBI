import { ExecutiveDashboard } from "@/components/walikota/dashboard/executive-dashboard";
import { getWalikotaDashboard } from "@/lib/walikota/data";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string; kecamatan?: string; kelurahan?: string }> }) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const requestedYear = Number(params.year);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2020 && requestedYear <= currentYear + 1 ? requestedYear : currentYear;
  const data = await getWalikotaDashboard(year);
  return <ExecutiveDashboard data={data} kecamatan={params.kecamatan} kelurahan={params.kelurahan} />;
}
