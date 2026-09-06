"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./dinsos-shell.module.css";

const items = [
  { href: "/dinsos", label: "Beranda", icon: "⌂" },
  { href: "/dinsos/warga", label: "Data Warga", icon: "▤" },
  { href: "/dinsos/asesmen", label: "Asesmen Sosial", icon: "✓" },
] as const;

export function DinsosSidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar} aria-label="Navigasi Dinas Sosial" data-shell-region="sidebar">
      <nav>
        {items.map((item) => {
          const active =
            item.href === "/dinsos"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? styles.sidebarActive : undefined}
              aria-current={active ? "page" : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
        <span className={styles.sidebarDisabled} aria-disabled="true">
          <span aria-hidden="true">⇄</span>
          Split Jalur &amp; Referral
        </span>
      </nav>
    </aside>
  );
}
