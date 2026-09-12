import { ArrowRight, Building2 } from "lucide-react";

import type { WalikotaDecision } from "@/lib/walikota/data";
import styles from "../walikota.module.css";

const actionLabels = { APPROVE: "Disetujui", REQUEST_REVISION: "Revisi Diminta" } as const;

export function DecisionHistory({ decisions }: { decisions: WalikotaDecision[] }) {
  if (!decisions.length) return <div className={styles.tableCard}><p className={styles.emptyState}>Belum ada keputusan eksekutif yang diterbitkan.</p></div>;
  return <section className={styles.decisionList}>{decisions.map((decision) => <article className={styles.recommendationItem} key={decision.id}>
    <div className={styles.recommendationTop}><div><span className={styles.eyebrow}>{decision.referenceCode}</span><h2>{decision.recommendation}</h2></div><div className={styles.decisionMeta}><span className={`${styles.statusBadge} ${styles[`priority${decision.priorityLevel}`]}`}>{decision.priorityLevel}</span><span className={styles.statusBadge}>{actionLabels[decision.action]}</span></div></div>
    <div className={styles.recommendationBody}><div><h3>Dasar Temuan</h3><p>{decision.finding}</p></div><div><h3>Catatan Pimpinan</h3><p>{decision.leaderNote}</p></div></div>
    {decision.dispositions.length > 0 && <div className={styles.dispositionList}><strong>Disposisi</strong>{decision.dispositions.map((disposition) => <div className={styles.dispositionItem} key={disposition.id}><strong><Building2 size={14} /> {disposition.opdCode} <ArrowRight size={13} /> {disposition.status}</strong><p>{disposition.instruction}</p><span>{disposition.dueDate ? `Tenggat ${formatDate(disposition.dueDate)}` : "Tanpa tenggat khusus"}</span></div>)}</div>}
    <div className={styles.recipientRow}><time>Diputuskan {formatDateTime(decision.decidedAt)}</time></div>
  </article>)}</section>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(value)); }
