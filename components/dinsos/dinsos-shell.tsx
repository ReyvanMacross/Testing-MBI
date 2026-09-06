import type { ReactNode } from "react";

import { DinsosHeader } from "./header";
import { DinsosSidebar } from "./sidebar";
import styles from "./dinsos-shell.module.css";

export function DinsosShell({ children, namaLengkap }: { children: ReactNode; namaLengkap: string }) {
  const year = new Date().getFullYear();
  return (
    <div className={styles.shell}>
      <DinsosHeader namaLengkap={namaLengkap} />
      <div className={styles.workspace}>
        <DinsosSidebar />
        <main className={styles.main}>{children}</main>
      </div>
      <footer className={styles.footer} data-shell-region="footer">
        <p>© {year} Diskominfo Kota Bandung.</p>
        <div><span>Pusat Bantuan</span><span>Kebijakan Privasi</span><span>Syarat &amp; Ketentuan</span></div>
      </footer>
    </div>
  );
}
