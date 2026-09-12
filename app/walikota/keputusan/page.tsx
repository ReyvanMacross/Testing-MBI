import { DecisionHistory } from "@/components/walikota/decision/decision-history";
import styles from "@/components/walikota/walikota.module.css";
import { getWalikotaDecisions } from "@/lib/walikota/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const decisions = await getWalikotaDecisions();
  return <div className={styles.page}>
    <header className={styles.pageHeader}><div><h1>Riwayat Keputusan</h1><p>Keputusan Wali Kota atas rekomendasi kebijakan Bapperida.</p></div></header>
    <section className={styles.summaryCards}><article className={styles.summaryCard}><span>Total Keputusan</span><strong>{decisions.length}</strong></article><article className={styles.summaryCard}><span>Prioritas Mendesak</span><strong>{decisions.filter((item) => item.priorityLevel === "MENDESAK").length}</strong></article><article className={styles.summaryCard}><span>Disposisi Terbit</span><strong>{decisions.reduce((total, item) => total + item.dispositions.length, 0)}</strong></article><article className={styles.summaryCard}><span>Ditolak</span><strong>{decisions.filter((item) => item.action === "REQUEST_REVISION").length}</strong></article></section>
    <DecisionHistory decisions={decisions} />
  </div>;
}
