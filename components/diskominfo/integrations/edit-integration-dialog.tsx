"use client";

import { useEffect } from "react";
import type { IntegrationDetail } from "@/lib/diskominfo/integrations";
import type { OpdOption } from "@/lib/diskominfo/users";
import { IntegrationForm } from "./integration-form";
import styles from "./integrations.module.css";

export function EditIntegrationDialog({ integration, opdOptions, onClose, onSuccess }: { integration: IntegrationDetail | null; opdOptions: OpdOption[]; onClose: () => void; onSuccess: () => void }) {
  useEffect(() => {
    if (!integration) return;
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [integration, onClose]);
  if (!integration) return null;
  return <div className={styles.dialogOverlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="edit-integration-title"><header className={styles.dialogHeader}><div><h2 id="edit-integration-title">Edit Integrasi</h2><p>Status dan latency hanya diperbarui oleh healthcheck server.</p></div><button className={styles.dialogClose} type="button" aria-label="Tutup dialog" onClick={onClose}>×</button></header><IntegrationForm integration={integration} opdOptions={opdOptions} onCancel={onClose} onSuccess={onSuccess} /></section></div>;
}
