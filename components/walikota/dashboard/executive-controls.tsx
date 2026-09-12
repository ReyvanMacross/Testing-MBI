"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";

import styles from "../walikota.module.css";

export function ExecutiveControls({ year }: { year: number }) {
  const router = useRouter();
  return (
    <div className={styles.actions}>
      <label className={styles.yearControl}>
        <span className={styles.srOnly}>Pilih tahun laporan</span>
        <select aria-label="Pilih tahun laporan" value={year} onChange={(event) => router.push(`/walikota?year=${event.target.value}`)}>
          <option value={year}>Tahun Ini</option>
          <option value={year - 1}>{year - 1}</option>
        </select>
      </label>
      <button type="button" onClick={() => window.print()}><Download size={17} /> Unduh Laporan</button>
    </div>
  );
}
