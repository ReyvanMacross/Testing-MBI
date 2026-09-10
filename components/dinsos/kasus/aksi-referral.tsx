"use client";

import { useState } from "react";

import styles from "./referral-kasus.module.css";

export function ReferralAction({ caseId }: { caseId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/dinsos/cases/${caseId}/stabilization/send`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Referral gagal dikirim.");
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Referral gagal dikirim.");
      setBusy(false);
    }
  }

  return (
    <>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button onClick={send} disabled={busy} aria-busy={busy}>
        {busy ? "Mengirim..." : "Kirim ke Proteksi & Stabilisasi"}
      </button>
    </>
  );
}
