"use client";

import { Bell, ChevronDown, Gavel, LayoutDashboard, ListChecks, LogOut, Menu, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import styles from "./walikota-shell.module.css";

const navigation = [
  { href: "/walikota", label: "Dashboard Eksekutif", icon: LayoutDashboard },
  { href: "/walikota/rekomendasi", label: "Rekomendasi Strategis", icon: ListChecks },
  { href: "/walikota/keputusan", label: "Keputusan & Disposisi", icon: Gavel },
] as const;

export function WalikotaShell({ children, namaLengkap }: { children: ReactNode; namaLengkap: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const accountRef = useRef<HTMLDivElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false); };
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

  return <div className={styles.root}>
    <header className={styles.header}>
      <button className={styles.mobileButton} type="button" aria-label="Buka navigasi" onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
      <Link href="/walikota" className={styles.brand}>Platform MBI — Pemerintah Kota Bandung</Link>
      <nav className={styles.desktopNav} aria-label="Navigasi Wali Kota">{navigation.map((item) => <Link key={item.href} href={item.href} aria-current={(item.href === "/walikota" ? pathname === item.href : pathname.startsWith(item.href)) ? "page" : undefined}>{item.label}</Link>)}</nav>
      <div className={styles.account} ref={accountRef}>
        <button className={styles.iconButton} type="button" aria-label="Notifikasi"><Bell size={21} /></button>
        <button className={styles.accountTrigger} type="button" aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen((value) => !value)}><span className={styles.avatar}>WK</span><span>Wali Kota</span><ChevronDown size={16} /></button>
        {accountOpen && <div className={styles.accountMenu} role="menu"><span><UserRound size={15} />{namaLengkap}</span>{navigation.map((item) => <Link key={item.href} href={item.href} role="menuitem">{item.label}</Link>)}<button type="button" onClick={logout} disabled={busy}><LogOut size={15} />{busy ? "Keluar..." : "Keluar"}</button></div>}
      </div>
    </header>
    {mobileOpen && <div className={styles.mobileOverlay} role="dialog" aria-label="Navigasi Wali Kota"><button type="button" aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)}><X size={22} /></button><strong>WALI KOTA</strong><nav>{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)}><Icon size={18} />{label}</Link>)}</nav></div>}
    <main className={styles.main}>{children}</main>
    <footer className={styles.footer}><p>© {new Date().getFullYear()} Pemerintah Kota Bandung. All rights reserved.</p><nav><span>Pusat Bantuan</span><span>Kebijakan Privasi</span><span>Syarat &amp; Ketentuan</span></nav></footer>
  </div>;
}
