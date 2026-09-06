import type { ReactNode } from "react";

import { DinsosHeader } from "./header";
import styles from "./dinsos-shell.module.css";

export function DinsosShell({ children, namaLengkap }: { children: ReactNode; namaLengkap: string }) {
  const year = new Date().getFullYear();
  return (
    <div className={styles.shell}>
      <DinsosHeader namaLengkap={namaLengkap} />
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <p>© {year} Diskominfo Kota Bandung.</p>
        <div><span>Pusat Bantuan</span><span>Kebijakan Privasi</span><span>Syarat &amp; Ketentuan</span></div>
      </footer>
    </div>
  );
}
