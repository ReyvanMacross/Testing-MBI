import type { ReactNode } from "react";

import styles from "./komponen-bersama.module.css";

export function LabelStatus({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "blue" | "green" | "amber" | "red" }) {
  const className = tone === "green" ? styles.greenBadge : tone === "amber" ? styles.amberBadge : tone === "red" ? styles.redBadge : tone === "blue" ? styles.blue : "";
  return <span className={`${styles.badge} ${className}`}>{children}</span>;
}
