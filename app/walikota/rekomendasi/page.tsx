import { ExecutiveRecommendations } from "@/components/walikota/recommendation/executive-recommendations";
import styles from "@/components/walikota/walikota.module.css";
import { getExecutiveRecommendations } from "@/lib/walikota/data";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const { items, opdOptions } = await getExecutiveRecommendations();
  return <div className={styles.page}>
    <header className={styles.pageHeader}><div><span className={styles.eyebrow}>BAPPERIDA → WALI KOTA</span><h1>Rekomendasi Strategis</h1><p>Tinjau rekomendasi berbasis data, tetapkan prioritas, dan teruskan arahan kepada perangkat daerah.</p></div><div className={styles.filterBar}><form><select name="status" defaultValue={params.status ?? "SEMUA"} aria-label="Filter status"><option value="SEMUA">Semua Status</option><option value="MENUNGGU_PERSETUJUAN">Menunggu Keputusan</option><option value="PERLU_REVISI">Perlu Revisi</option><option value="DITINDAKLANJUTI">Disetujui</option><option value="SELESAI">Selesai</option></select><button type="submit">Terapkan</button></form></div></header>
    <ExecutiveRecommendations items={items} opdOptions={opdOptions} status={params.status} />
  </div>;
}
