"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "./dinsos-shell.module.css";

export function DinsosHeader({ namaLengkap }: { namaLengkap: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (response.ok) { router.replace("/login"); router.refresh(); return; }
    } finally { setBusy(false); }
  }
  return (
    <header className={styles.header} data-shell-region="header">
      <a href="/dinsos" className={styles.brand}>Platform MBI — Diskominfo Kota Bandung</a>
      <label className={styles.search}><span className={styles.srOnly}>Cari</span><input type="search" placeholder="Cari..." /></label>
      <div className={styles.account}>
        <span aria-label="Notifikasi" className={styles.bell}>♧</span>
        <span className={styles.avatar}>DS</span>
        <span className={styles.name}>{namaLengkap}</span>
        <button type="button" onClick={logout} disabled={busy} aria-busy={busy}>Keluar</button>
      </div>
    </header>
  );
}
