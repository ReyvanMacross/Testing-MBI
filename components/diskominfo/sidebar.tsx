"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./dashboard-shell.module.css";

type SidebarProps = {
  namaLengkap: string;
};

const navigation = [
  { label: "Beranda", href: "/diskominfo" },
  { label: "Integrasi API", href: "/diskominfo/integrasi-api" },
  { label: "Manajemen Pengguna", href: "/diskominfo/pengguna" },
  { label: "Log Aktivitas", href: "/diskominfo/log-aktivitas" },
];

export function Sidebar({ namaLengkap }: SidebarProps) {
  const pathname = usePathname();
  const initials = namaLengkap
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <aside className={styles.sidebar}>
      <header className={styles.sidebarHeader}>
        <span className={styles.avatar} aria-hidden="true">
          {initials || "AM"}
        </span>
        <span className={styles.sidebarIdentity}>
          <strong>{namaLengkap}</strong>
          <span>Diskominfo Bandung</span>
        </span>
      </header>

      <nav className={styles.navigation} aria-label="Navigasi Diskominfo">
        {navigation.map((item) => {
          const active =
            item.href === "/diskominfo"
              ? pathname === "/diskominfo"
              : pathname.startsWith(item.href);

          return (
            <Link
              className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
              href={item.href}
              key={item.href}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <footer className={styles.sidebarFooter}>
        <strong>Sistem MBI</strong>
        <span>Versi 2.1.4</span>
      </footer>
    </aside>
  );
}
