import { DecisionHistory } from "@/components/walikota/decision/decision-history";
import styles from "@/components/walikota/walikota.module.css";
import { getWalikotaDecisions } from "@/lib/walikota/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const decisions = await getWalikotaDecisions();
  return <div className={styles.page}>
    <header className={styles.pageHeader}><div><span className={styles.eyebrow}>JEJAK KEPUTUSAN</span><h1>Keputusan &amp; Disposisi</h1><p>Riwayat keputusan pimpinan dan arahan tindak lanjut kepada perangkat daerah.</p></div></header>
    <section className={styles.summaryCards}><article className={styles.summaryCard}><span>Total Keputusan</span><strong>{decisions.length}</strong></article><article className={styles.summaryCard}><span>Prioritas Mendesak</span><strong>{decisions.filter((item) => item.priorityLevel === "MENDESAK").length}</strong></article><article className={styles.summaryCard}><span>Disposisi Terbit</span><strong>{decisions.reduce((total, item) => total + item.dispositions.length, 0)}</strong></article><article className={styles.summaryCard}><span>Permintaan Revisi</span><strong>{decisions.filter((item) => item.action === "REQUEST_REVISION").length}</strong></article></section>
    <DecisionHistory decisions={decisions} />
  </div>;
}
