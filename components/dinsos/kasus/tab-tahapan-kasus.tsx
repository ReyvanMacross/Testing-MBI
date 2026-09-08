import { CheckCircle2, ClipboardList, GitBranch, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";

import styles from "./kasus.module.css";

type Tab = "data" | "assessment" | "result" | "referral";

export function TabTahapanKasus({ caseId, active, assessmentReady, resultReady }: { caseId: string; active: Tab; assessmentReady: boolean; resultReady: boolean }) {
  const items = [
    { id: "data" as const, label: "Data Warga", href: `/dinsos/kasus/${caseId}`, enabled: true, icon: UserRound },
    { id: "assessment" as const, label: "Asesmen Sosial", href: `/dinsos/kasus/${caseId}/asesmen`, enabled: true, icon: ClipboardList },
    { id: "result" as const, label: "Hasil Desil", href: `/dinsos/kasus/${caseId}/hasil`, enabled: assessmentReady, icon: CheckCircle2 },
    { id: "referral" as const, label: "Split Jalur & Referral", href: `/dinsos/kasus/${caseId}/referral`, enabled: resultReady, icon: GitBranch },
  ];

  return (
    <nav className={styles.tabs} aria-label="Tahapan kasus">
      {items.map((item) => {
        const Icon = item.enabled ? item.icon : LockKeyhole;
        if (!item.enabled) return <span key={item.id} className={styles.tabLocked} aria-disabled="true" title="Selesaikan tahap sebelumnya"><Icon size={13} />{item.label}</span>;
        return <Link key={item.id} href={item.href} aria-current={active === item.id ? "page" : undefined} className={active === item.id ? styles.tabActive : styles.tab}><Icon size={13} />{item.label}</Link>;
      })}
    </nav>
  );
}
