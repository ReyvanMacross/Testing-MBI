import { KecamatanDashboard } from "@/components/kecamatan/dashboard/kecamatan-dashboard";
import { requireKecamatanActor } from "@/lib/auth/require-kecamatan-actor";
import { getKecamatanData } from "@/lib/kecamatan/data";

export default async function KecamatanPage() { const actor = await requireKecamatanActor(); const data = await getKecamatanData(actor); return <KecamatanDashboard data={data} />; }
