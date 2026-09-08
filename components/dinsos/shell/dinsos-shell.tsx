"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { DinsosHeader } from "./dinsos-header";
import { DinsosSidebar } from "./dinsos-sidebar";
import styles from "./dinsos-shell.module.css";

export function DinsosShell({ children, namaLengkap }: { children: ReactNode; namaLengkap: string }) {
  const [menuTerbuka, setMenuTerbuka] = useState(false);
  const year = new Date().getFullYear();

  return (
    <div className={styles.dinsosRoot}>
      <DinsosSidebar terbuka={menuTerbuka} tutup={() => setMenuTerbuka(false)} />
      <DinsosHeader namaLengkap={namaLengkap} bukaMenu={() => setMenuTerbuka(true)} />
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer} data-shell-region="footer">
        <p>© {year} Diskominfo Kota Bandung. All rights reserved.</p>
        <nav aria-label="Tautan footer">
          <span>Pusat Bantuan</span><span>Kebijakan Privasi</span><span>Syarat &amp; Ketentuan</span>
        </nav>
      </footer>
    </div>
  );
}
