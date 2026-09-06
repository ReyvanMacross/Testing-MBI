"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "./dashboard-shell.module.css";

type DashboardHeaderProps = {
  namaLengkap: string;
};

export function DashboardHeader({ namaLengkap }: DashboardHeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        setIsLoggingOut(false);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className={styles.header}>
      <p className={styles.platformName}>
        Platform MBI <span aria-hidden="true">—</span> Diskominfo Kota Bandung
      </p>

      <label className={styles.search}>
        <span className={styles.srOnly}>Cari</span>
        <input type="search" placeholder="Cari..." aria-label="Cari" />
      </label>

      <div className={styles.headerUser}>
        <span className={styles.userName}>{namaLengkap}</span>
        <button
          className={styles.logoutButton}
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-busy={isLoggingOut}
        >
          Keluar
        </button>
      </div>
    </header>
  );
}
