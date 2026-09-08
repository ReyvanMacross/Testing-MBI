import { Clock3 } from "lucide-react";
import Link from "next/link";

import styles from "./kasus.module.css";

export function TahapBelumTersedia({ judul, deskripsi, aksiHref, aksiLabel }: {
  judul: string;
  deskripsi: string;
  aksiHref: string;
  aksiLabel: string;
}) {
  return (
    <article className={styles.tahapBelumTersedia} aria-labelledby="judul-tahap-belum-tersedia">
      <span className={styles.tahapBelumTersediaIcon} aria-hidden="true"><Clock3 size={28} /></span>
      <h2 id="judul-tahap-belum-tersedia">{judul}</h2>
      <p>{deskripsi}</p>
      <Link href={aksiHref}>{aksiLabel}</Link>
    </article>
  );
}
