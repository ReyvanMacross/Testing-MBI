import type { ReactNode } from "react";

import styles from "./komponen-bersama.module.css";

export function JudulHalaman({ id, title, subtitle, actions }: { id?: string; title: string; subtitle: string; actions?: ReactNode }) {
  return <header className={styles.pageHeading}><div><h1 id={id}>{title}</h1><p>{subtitle}</p></div>{actions ? <div className={styles.actions}>{actions}</div> : null}</header>;
}
