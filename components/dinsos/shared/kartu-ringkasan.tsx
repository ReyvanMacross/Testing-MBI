import type { LucideIcon } from "lucide-react";

import styles from "./komponen-bersama.module.css";

export function KartuRingkasan({ label, value, icon: Icon, tone = "blue" }: { label: string; value: number | string; icon: LucideIcon; tone?: "blue" | "amber" | "green" | "neutral" }) {
  return <article className={`${styles.summaryCard} ${styles[tone]}`}><p>{label}</p><strong>{typeof value === "number" ? value.toLocaleString("id-ID") : value}</strong><span className={styles.summaryIcon} aria-hidden="true"><Icon size={16} strokeWidth={1.7} /></span></article>;
}
