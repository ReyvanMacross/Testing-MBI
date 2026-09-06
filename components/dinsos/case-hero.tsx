import type { DinsosCaseDetail } from "@/lib/dinsos/cases";
import { stageLabel } from "@/lib/dinsos/case-stage";
import styles from "./case.module.css";

export function CaseHero({ item, compact = false }: { item: DinsosCaseDetail; compact?: boolean }) {
  return <section className={compact?styles.heroCompact:styles.hero} aria-label="Identitas kasus">
    <div><h1>{item.warga.nama}</h1><p>NIK: <code>{item.warga.maskedNik}</code>{compact ? ` • Kec. ${item.warga.kecamatan ?? "—"}, Kel. ${item.warga.kelurahan ?? "—"}` : ""}</p>{!compact&&<p>⌖ Kel. {item.warga.kelurahan ?? "—"} &nbsp;•&nbsp; Kec. {item.warga.kecamatan ?? "—"}</p>}</div>
    <div className={styles.badges}><span className={styles.stageBadge}>{stageLabel(item.currentStage)}</span><span className={`${styles.priorityBadge} ${styles[item.priority.toLowerCase()]}`}>{item.priority}</span></div>
  </section>;
}
