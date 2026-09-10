import { ArrowLeft, BadgeCheck, ChartNoAxesColumnIncreasing, House, IdCard, ImageIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RingkasanKasus } from "@/components/dinsos/kasus/ringkasan-kasus";
import { TabTahapanKasus } from "@/components/dinsos/kasus/tab-tahapan-kasus";
import { GambarTerlindungi } from "@/components/dinsos/kasus/gambar-terlindungi";
import styles from "@/components/dinsos/kasus/kasus.module.css";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { getDinsosCaseById } from "@/lib/dinsos/cases";

const displayDate = (value: string | null) => value
  ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${value}T00:00:00+07:00`))
  : "—";

export default async function CaseDataPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const actor = await requireDinsosActor();
  const item = await getDinsosCaseById(caseId, actor.profileId);
  if (!item) notFound();
  const assessmentReady = item.assessment?.status === "COMPLETED";
  const resultReady = item.result?.status === "CONFIRMED";
  const documents = [
    ["ktp", "Foto KTP", item.verification?.documents.ktp],
    ["kk", "Foto Kartu Keluarga", item.verification?.documents.kk],
    ["rumah", "Kondisi Rumah (Fasad Depan)", item.verification?.documents.rumah],
  ] as const;

  return (
    <section>
      <div className={styles.breadcrumb}>
        <span>Antrian Kerja Harian <i>/</i> <strong>Data Warga</strong></span>
        <Link className={styles.back} href="/dinsos"><ArrowLeft size={14} /> Kembali ke Antrian</Link>
      </div>
      <RingkasanKasus item={item} />
      <TabTahapanKasus caseId={caseId} active="data" assessmentReady={assessmentReady} resultReady={resultReady} />

      <div className={styles.infoGrid}>
        <article className={styles.card}>
          <h2><IdCard size={17} /> Identitas Pribadi</h2>
          <div className={styles.fields}>
            <div><span className={styles.label}>Nama Lengkap</span><p className={styles.value}>{item.warga.nama}</p></div>
            <div><span className={styles.label}>NIK</span><p className={styles.value}>{item.warga.maskedNik}</p></div>
            <div><span className={styles.label}>Tempat, Tanggal Lahir</span><p className={styles.value}>{item.warga.tempatLahir ?? "—"}, {displayDate(item.warga.tanggalLahir)}</p></div>
            <div><span className={styles.label}>Jenis Kelamin</span><p className={styles.value}>{item.warga.jenisKelamin ?? "—"}</p></div>
            <div><span className={styles.label}>Status Perkawinan</span><p className={styles.value}>{item.warga.statusPerkawinan ?? "—"}</p></div>
            <div><span className={styles.label}>Nomor Telepon</span><p className={styles.value}>{item.warga.maskedPhone}</p></div>
          </div>
        </article>

        <article className={styles.card}>
          <h2><House size={17} /> Alamat Tempat Tinggal</h2>
          <div className={styles.fields}>
            <div className={styles.full}><span className={styles.label}>Alamat Lengkap</span><p className={styles.value}>{item.warga.alamat ?? "—"}</p></div>
            <div><span className={styles.label}>RT / RW</span><p className={styles.value}>—</p></div>
            <div><span className={styles.label}>Kelurahan</span><p className={styles.value}>{item.warga.kelurahan ?? "—"}</p></div>
            <div><span className={styles.label}>Kecamatan</span><p className={styles.value}>{item.warga.kecamatan ?? "—"}</p></div>
            <div><span className={styles.label}>Kota</span><p className={styles.value}>Kota Bandung</p></div>
          </div>
        </article>

        <article className={`${styles.card} ${styles.socialCard}`}>
          <h2><ChartNoAxesColumnIncreasing size={17} /> Data Sosial Ekonomi Dasar</h2>
          <div className={styles.socialFields}>
            <div><span className={styles.label}>Pendidikan Terakhir</span><p className={styles.value}>{item.warga.pendidikan ?? "—"}</p></div>
            <div><span className={styles.label}>Pekerjaan Utama</span><p className={styles.value}>{item.warga.pekerjaan ?? "—"}</p></div>
            <div><span className={styles.label}>Jumlah Tanggungan</span><p className={styles.value}>{item.warga.jumlahAnggotaKk ?? "—"}</p></div>
            <div><span className={styles.label}>Status Kepemilikan Rumah</span><p className={styles.value}>{item.warga.statusRumah ?? "—"}</p></div>
          </div>
        </article>
      </div>

      <article className={`${styles.card} ${styles.documents}`}>
        <h2><ImageIcon size={18} /> Dokumen Pendukung (Bukti Lapangan)</h2>
        <div className={styles.documentList}>
          {documents.map(([type, label, available]) => (
            <div className={styles.document} key={type}>
              <GambarTerlindungi
                tersedia={Boolean(available)}
                src={`/api/dinsos/cases/${caseId}/documents/${type}`}
                alt={label}
                jenis="dokumen"
              />
              <strong>{label}</strong>
              <p>{available ? <a href={`/api/dinsos/cases/${caseId}/documents/${type}`} target="_blank">Lihat dokumen</a> : "Dokumen belum tersedia"}</p>
            </div>
          ))}
        </div>
      </article>

      {item.verification && (
        <p className={styles.verifyFooter}>
          <BadgeCheck size={16} aria-hidden="true" />
          Diverifikasi oleh <strong>{item.verification.petugas ?? "—"}</strong>
          <span>(Petugas Kelurahan)</span> pada <strong>{displayDate(item.verification.tanggal)}</strong>
        </p>
      )}
    </section>
  );
}
