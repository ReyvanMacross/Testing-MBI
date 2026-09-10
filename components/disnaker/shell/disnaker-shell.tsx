"use client";

import { Bell, BookOpenCheck, BriefcaseBusiness, ChevronDown, FileChartColumn, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import styles from "./disnaker-shell.module.css";

const navigation = [
  { href: "/disnaker", label: "Rujukan & Intervensi", icon: BriefcaseBusiness },
  { href: "/disnaker/program", label: "Program Pelatihan", icon: BookOpenCheck },
  { href: "/disnaker/laporan", label: "Laporan Penempatan", icon: FileChartColumn },
] as const;

export function DisnakerShell({ children, namaLengkap }: { children: ReactNode; namaLengkap: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const accountRef = useRef<HTMLDivElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (response.ok) {
        router.replace("/login");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.root}>
      <button type="button" className={`${styles.sidebarBackdrop} ${menuOpen ? styles.sidebarBackdropVisible : ""}`} aria-label="Tutup navigasi" onClick={() => setMenuOpen(false)} />
      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`} aria-label="Navigasi Dinas Tenaga Kerja">
        <div className={styles.sidebarBrand}>
          <span className={styles.sidebarLogo}><BriefcaseBusiness size={20} /></span>
          <div><strong>Dinas Tenaga Kerja</strong><span>Kota Bandung</span></div>
          <button type="button" className={styles.sidebarClose} aria-label="Tutup navigasi" onClick={() => setMenuOpen(false)}><X size={20} /></button>
        </div>
        <nav>
          {navigation.map((item) => {
            const active = item.href === "/disnaker" ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={active ? styles.active : undefined} onClick={() => setMenuOpen(false)}><Icon size={17} /><span>{item.label}</span></Link>;
          })}
        </nav>
        <div className={styles.sidebarFooter}><strong>Sistem MBI</strong><span>Modul Disnaker</span></div>
      </aside>
      <header className={styles.header}>
        <button type="button" className={styles.menuButton} aria-label="Buka navigasi" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
        <Link href="/disnaker" className={styles.brand}>Platform MBI — Diskominfo Kota Bandung</Link>
        <label className={styles.search}>
          <span className={styles.srOnly}>Cari</span><Search size={18} aria-hidden="true" />
          <input type="search" placeholder="Cari..." />
        </label>
        <div className={styles.account} ref={accountRef}>
          <button type="button" className={styles.bell} aria-label="Notifikasi"><Bell size={20} strokeWidth={1.7} /></button>
          <button type="button" className={styles.accountTrigger} aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen((value) => !value)}>
            <span className={styles.avatar}>DN</span><span>Admin DinNaker</span><ChevronDown size={16} />
          </button>
          {accountOpen && (
            <div className={styles.accountMenu} role="menu">
              <span role="menuitem"><UserRound size={15} /> {namaLengkap}</span>
              <button type="button" role="menuitem" onClick={logout} disabled={busy}><LogOut size={15} />{busy ? "Keluar..." : "Keluar"}</button>
            </div>
          )}
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <p>© {year} Diskominfo Kota Bandung. All rights reserved.</p>
        <nav aria-label="Tautan footer"><span>Pusat Bantuan</span><span>Kebijakan Privasi</span><span>Syarat &amp; Ketentuan</span></nav>
      </footer>
    </div>
  );
}
