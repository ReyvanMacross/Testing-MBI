"use client";

import { useEffect } from "react";
import type { OpdOption } from "@/lib/diskominfo/users";
import { IntegrationForm } from "./integration-form";
import styles from "./integrations.module.css";

export function AddIntegrationDialog({ open, opdOptions, onClose, onSuccess }: { open: boolean; opdOptions: OpdOption[]; onClose: () => void; onSuccess: () => void }) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);
  if (!open) return null;
  return <div className={styles.dialogOverlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="add-integration-title"><header className={styles.dialogHeader}><div><h2 id="add-integration-title">Tambah Integrasi</h2><p>Konfigurasikan koneksi layanan tanpa menyimpan secret.</p></div><button className={styles.dialogClose} type="button" aria-label="Tutup dialog" onClick={onClose}>×</button></header><IntegrationForm opdOptions={opdOptions} onCancel={onClose} onSuccess={onSuccess} /></section></div>;
}
