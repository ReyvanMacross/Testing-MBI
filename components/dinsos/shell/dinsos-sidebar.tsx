"use client";

import { ClipboardList, GitBranch, Home, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./dinsos-shell.module.css";

const items = [
  { href: "/dinsos", label: "Beranda", icon: Home },
  { href: "/dinsos/warga", label: "Data Warga", icon: Users },
  { href: "/dinsos/asesmen", label: "Asesmen Sosial", icon: ClipboardList },
  { href: "/dinsos/referral", label: "Split Jalur & Referral", icon: GitBranch },
] as const;

export function DinsosSidebar({ terbuka, tutup }: { terbuka: boolean; tutup: () => void }) {
  const pathname = usePathname();
  return (
    <>
      <button type="button" className={`${styles.sidebarBackdrop} ${terbuka ? styles.sidebarBackdropVisible : ""}`} aria-label="Tutup navigasi" onClick={tutup} />
      <aside className={`${styles.sidebar} ${terbuka ? styles.sidebarOpen : ""}`} aria-label="Navigasi Dinas Sosial" data-shell-region="sidebar">
        <div className={styles.sidebarBrand}>
          <span className={styles.sidebarLogo} aria-hidden="true"><Users size={19} strokeWidth={1.7} /></span>
          <div><strong>Dinas Sosial</strong><span>Kota Bandung</span></div>
          <button type="button" className={styles.mobileClose} onClick={tutup} aria-label="Tutup navigasi"><X size={19} /></button>
        </div>
        <nav>
          {items.map((item) => {
            const active = item.href === "/dinsos" ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={active ? styles.sidebarActive : undefined} aria-current={active ? "page" : undefined} onClick={tutup}><Icon size={15} strokeWidth={1.7} aria-hidden="true" /><span>{item.label}</span></Link>;
          })}
        </nav>
        <div className={styles.sidebarFooter}><strong>Sistem MBI</strong><span>Versi 2.1.4</span></div>
      </aside>
    </>
  );
}
