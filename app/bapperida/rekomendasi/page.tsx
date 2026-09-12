import { RecommendationsPage } from "@/components/bapperida/recommendation/recommendations-page";
import { getBapperidaRecommendations } from "@/lib/bapperida/data";
import styles from "@/components/bapperida/bapperida.module.css";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const { items, opdOptions } = await getBapperidaRecommendations();
  return <div className={styles.page}>
    <header className={styles.pageHeader}><div><h1>Rekomendasi Kebijakan</h1><p>Rekomendasi berbasis data untuk koordinasi lintas Perangkat Daerah</p></div><div className={styles.filterBar}><form><select name="status" defaultValue={params.status ?? "SEMUA"}><option value="SEMUA">Semua Status</option><option value="DRAFT">Draf</option><option value="MENUNGGU_PERSETUJUAN">Menunggu Persetujuan</option><option value="PERLU_REVISI">Perlu Revisi</option><option value="DITINDAKLANJUTI">Ditindaklanjuti</option><option value="SELESAI">Selesai</option></select><button type="submit">Terapkan</button></form></div></header>
    <RecommendationsPage items={items} opdOptions={opdOptions} status={params.status} />
  </div>;
}
