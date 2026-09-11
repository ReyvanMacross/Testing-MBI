import { KecamatanWarga } from "@/components/kecamatan/warga/kecamatan-warga";
import { requireKecamatanActor } from "@/lib/auth/require-kecamatan-actor";
import { getKecamatanData } from "@/lib/kecamatan/data";

export default async function KecamatanWargaPage() { const actor = await requireKecamatanActor(); const data = await getKecamatanData(actor); return <KecamatanWarga data={data} />; }
