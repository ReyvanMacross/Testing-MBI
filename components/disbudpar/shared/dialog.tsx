"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { useFokusDialog } from "@/components/dinsos/shared/use-fokus-dialog";
import styles from "./disbudpar-ui.module.css";

export function Dialog({ title, children, footer, close, wide = false }: { title: string; children: ReactNode; footer?: ReactNode; close: () => void; wide?: boolean }) {
  const ref = useFokusDialog<HTMLDivElement>();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);
  return <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}><div ref={ref} className={`${styles.dialog} ${wide ? styles.dialogWide : ""}`} role="dialog" aria-modal="true" aria-labelledby="dn-dialog-title" tabIndex={-1}><header><h2 id="dn-dialog-title">{title}</h2><button type="button" onClick={close} aria-label="Tutup dialog"><X size={23} /></button></header><div className={styles.dialogBody}>{children}</div>{footer && <footer>{footer}</footer>}</div></div>;
}

export function Drawer({ title, children, footer, close }: { title: string; children: ReactNode; footer?: ReactNode; close: () => void }) {
  const ref = useFokusDialog<HTMLDivElement>();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);
  return <div className={styles.drawerOverlay} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}><aside ref={ref} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="dn-drawer-title" tabIndex={-1}><header><h2 id="dn-drawer-title">{title}</h2><button type="button" onClick={close} aria-label="Tutup panel"><X size={23} /></button></header><div className={styles.drawerBody}>{children}</div>{footer && <footer>{footer}</footer>}</aside></div>;
}
