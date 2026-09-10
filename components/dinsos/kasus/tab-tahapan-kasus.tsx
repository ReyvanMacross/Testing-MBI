import { CheckCircle2, ClipboardList, GitBranch, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";

import styles from "./kasus.module.css";

type Tab = "data" | "assessment" | "result" | "referral";

export function TabTahapanKasus({ caseId, active, assessmentReady, resultReady }: { caseId: string; active: Tab; assessmentReady: boolean; resultReady: boolean }) {
  const items = [
    { id: "data" as const, label: "Data Warga", href: `/dinsos/kasus/${caseId}`, ready: true, icon: UserRound },
    { id: "assessment" as const, label: "Asesmen Sosial", href: `/dinsos/kasus/${caseId}/asesmen`, ready: true, icon: ClipboardList },
    { id: "result" as const, label: "Hasil Desil", href: `/dinsos/kasus/${caseId}/hasil`, ready: assessmentReady, icon: CheckCircle2 },
    { id: "referral" as const, label: "Split Jalur & Referral", href: `/dinsos/kasus/${caseId}/referral`, ready: resultReady, icon: GitBranch },
  ];

  return (
    <nav className={styles.tabs} aria-label="Tahapan kasus">
      {items.map((item) => {
        const Icon = item.ready ? item.icon : LockKeyhole;
        const className = active === item.id ? styles.tabActive : item.ready ? styles.tab : styles.tabLocked;
        return <Link key={item.id} href={item.href} aria-current={active === item.id ? "page" : undefined} className={className} title={item.ready ? undefined : "Buka untuk melihat persyaratan tahap ini"}><Icon size={13} />{item.label}{!item.ready && <span className={styles.srOnly}> — tahap sebelumnya belum selesai</span>}</Link>;
      })}
    </nav>
  );
}
