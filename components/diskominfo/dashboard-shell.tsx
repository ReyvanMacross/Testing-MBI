import type { ReactNode } from "react";

import DashboardFooter from "./footer";
import { DashboardHeader } from "./header";
import { Sidebar } from "./sidebar";
import styles from "./dashboard-shell.module.css";

type DashboardProfile = {
  nama_lengkap: string;
  role: string;
  email: string | null;
  instansi: string | null;
  wilayah: string | null;
};

type DashboardShellProps = {
  children: ReactNode;
  profile: DashboardProfile;
};

export function DashboardShell({ children, profile }: DashboardShellProps) {
  return (
    <div className={styles.dashboard}>
      <Sidebar namaLengkap={profile.nama_lengkap} />

      <div className={styles.contentArea}>
        <DashboardHeader namaLengkap={profile.nama_lengkap} />
        <main className={styles.main}>{children}</main>
        <DashboardFooter />
      </div>
    </div>
  );
}
