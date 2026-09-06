import Link from "next/link";

import styles from "./case.module.css";

type Tab = "data" | "assessment" | "result" | "referral";
export function CaseTabs({ caseId, active, assessmentReady, resultReady }: { caseId: string; active: Tab; assessmentReady: boolean; resultReady: boolean }) {
  const items = [
    { id: "data" as const, label: "Data Warga", href: `/dinsos/kasus/${caseId}`, enabled: true },
    { id: "assessment" as const, label: "Asesmen Sosial", href: `/dinsos/kasus/${caseId}/asesmen`, enabled: true },
    { id: "result" as const, label: "Hasil Desil", href: `/dinsos/kasus/${caseId}/hasil`, enabled: assessmentReady },
    { id: "referral" as const, label: "Split Jalur & Referral", href: `/dinsos/kasus/${caseId}/referral`, enabled: resultReady },
  ];
  return <nav className={styles.tabs} aria-label="Tahapan kasus">{items.map((item) => item.enabled ? <Link key={item.id} href={item.href} aria-current={active===item.id?"page":undefined} className={active===item.id?styles.tabActive:styles.tab}>{active!==item.id && item.id!=="data" ? "▣ " : ""}{item.label}</Link> : <span key={item.id} className={styles.tabLocked} aria-disabled="true" title="Selesaikan tahap sebelumnya">▣ {item.label}</span>)}</nav>;
}
