import { KecamatanVerifikasi } from "@/components/kecamatan/verifikasi/kecamatan-verifikasi";
import { requireKecamatanActor } from "@/lib/auth/require-kecamatan-actor";
import { getKecamatanData } from "@/lib/kecamatan/data";

export default async function KecamatanVerifikasiPage() { const actor = await requireKecamatanActor(); const data = await getKecamatanData(actor); return <KecamatanVerifikasi data={data} />; }
