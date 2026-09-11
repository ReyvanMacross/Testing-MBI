import { KecamatanRujukan } from "@/components/kecamatan/rujukan/kecamatan-rujukan";
import { requireKecamatanActor } from "@/lib/auth/require-kecamatan-actor";
import { getKecamatanData } from "@/lib/kecamatan/data";

export default async function KecamatanRujukanPage() { const actor = await requireKecamatanActor(); const data = await getKecamatanData(actor); return <KecamatanRujukan data={data} />; }
