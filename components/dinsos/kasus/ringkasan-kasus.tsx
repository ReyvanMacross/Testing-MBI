import { MapPin, ShieldAlert } from "lucide-react";

import type { DinsosCaseDetail } from "@/lib/dinsos/cases";
import { stageLabel } from "@/lib/dinsos/case-stage";

import { GambarTerlindungi } from "./gambar-terlindungi";
import styles from "./kasus.module.css";

export function RingkasanKasus({ item, ringkas = false }: { item: DinsosCaseDetail; ringkas?: boolean }) {
  const jenisKelamin = item.warga.jenisKelamin?.toLocaleLowerCase("id-ID") ?? "";
  const fotoProfilPengganti = jenisKelamin.includes("perempuan")
    ? "/images/dinsos/profil-warga-perempuan.jpg"
    : "/images/dinsos/profil-warga-laki-laki.jpg";

  return (
    <section className={ringkas ? styles.heroCompact : styles.hero} aria-label="Identitas kasus">
      {!ringkas && (
        <GambarTerlindungi
          tersedia={Boolean(item.verification?.documents.ktp)}
          src={`/api/dinsos/cases/${item.id}/documents/ktp`}
          alt={`Foto ${item.warga.nama}`}
          jenis="profil"
          fallbackSrc={fotoProfilPengganti}
        />
      )}
      <div className={styles.heroContent}>
        <h1>{item.warga.nama}</h1>
        <p>NIK: <code>{item.warga.maskedNik}</code>{ringkas ? ` • Kec. ${item.warga.kecamatan ?? "—"}, Kel. ${item.warga.kelurahan ?? "—"}` : ""}</p>
        {!ringkas && (
          <p className={styles.location}>
            <MapPin size={15} aria-hidden="true" /> Kel. {item.warga.kelurahan ?? "—"}
            <span>•</span>Kec. {item.warga.kecamatan ?? "—"}
            {!item.locationResolved && (
              <span
                className={styles.locationWarning}
                title="Wilayah belum terhubung ke master wilayah"
                aria-label="Wilayah belum terhubung ke master wilayah"
              >
                <ShieldAlert size={14} />
              </span>
            )}
          </p>
        )}
      </div>
      <div className={styles.badges}>
        <span className={styles.stageBadge}>{stageLabel(item.currentStage)}</span>
        <span className={`${styles.priorityBadge} ${styles[item.priority.toLowerCase()]}`}>{item.priority}</span>
      </div>
    </section>
  );
}
