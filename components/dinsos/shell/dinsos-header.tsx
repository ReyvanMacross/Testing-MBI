"use client";

import { Bell, ChevronDown, LogOut, Menu, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import styles from "./dinsos-shell.module.css";

export function DinsosHeader({ namaLengkap, bukaMenu }: { namaLengkap: string; bukaMenu: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [akunTerbuka, setAkunTerbuka] = useState(false);
  const areaAkun = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!areaAkun.current?.contains(event.target as Node)) setAkunTerbuka(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (response.ok) { router.replace("/login"); router.refresh(); }
    } finally { setBusy(false); }
  }

  return (
    <header className={styles.header} data-shell-region="header">
      <button type="button" className={styles.menuButton} onClick={bukaMenu} aria-label="Buka navigasi"><Menu size={19} /></button>
      <Link href="/dinsos" className={styles.headerBrand}>Platform MBI — Diskominfo Kota Bandung</Link>
      <label className={styles.search}><span className={styles.srOnly}>Cari</span><Search size={15} aria-hidden="true" /><input type="search" placeholder="Cari..." /></label>
      <div className={styles.account} ref={areaAkun}>
        <button type="button" className={styles.notification} aria-label="Notifikasi"><Bell size={18} strokeWidth={1.7} /></button>
        <button type="button" className={styles.accountTrigger} aria-expanded={akunTerbuka} aria-haspopup="menu" onClick={() => setAkunTerbuka((value) => !value)}>
          <span className={styles.avatar}>DS</span><span className={styles.name}>{namaLengkap}</span><ChevronDown size={14} />
        </button>
        {akunTerbuka && <div className={styles.accountMenu} role="menu"><span role="menuitem"><UserRound size={14} /> Profil</span><button role="menuitem" type="button" onClick={logout} disabled={busy} aria-busy={busy}><LogOut size={14} /> {busy ? "Keluar..." : "Keluar"}</button></div>}
      </div>
    </header>
  );
}
