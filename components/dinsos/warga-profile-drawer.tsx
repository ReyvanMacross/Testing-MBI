"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { WargaProfile } from "@/lib/dinsos/warga";

import styles from "./warga-profile-drawer.module.css";

type Props = {
  profile: WargaProfile;
  closeHref: string;
  editHref: string;
  assessmentHref: string;
  canEdit: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function statusLabel(value: string | null) {
  if (value === "VERIFIED") return "TERVERIFIKASI";
  if (value === "REJECTED") return "DITOLAK";
  return "BELUM";
}

export function WargaProfileDrawer({
  profile,
  closeHref,
  editHref,
  assessmentHref,
  canEdit,
}: Props) {
  const router = useRouter();
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.push(closeHref);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [closeHref, router]);

  return (
    <div className={styles.overlay}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Tutup profil melalui latar belakang"
        onClick={() => router.push(closeHref)}
      />
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="warga-profile-title"
      >
        <header className={styles.header}>
          <h2 id="warga-profile-title">Profil Warga — {profile.namaLengkap}</h2>
          <Link href={closeHref} aria-label="Tutup profil warga" className={styles.close}>×</Link>
        </header>

        <div className={styles.content}>
          {!profile.locationResolved && (
            <p className={styles.warning} role="status">
              Wilayah warga belum terhubung ke master wilayah terverifikasi.
            </p>
          )}

          <section className={styles.section}>
            <h3>Identitas Pribadi</h3>
            <dl className={styles.identity}>
              <div><dt>NIK</dt><dd>{profile.maskedNik}</dd></div>
              <div><dt>Nama Lengkap</dt><dd>{profile.namaLengkap}</dd></div>
              <div><dt>No. KK</dt><dd>{profile.maskedFamilyCard}</dd></div>
              <div><dt>Desil</dt><dd>{profile.desil ? `Desil ${profile.desil}` : "—"}</dd></div>
              <div><dt>Kelurahan</dt><dd>{profile.kelurahan ?? "—"}</dd></div>
              <div><dt>Kecamatan</dt><dd>{profile.kecamatan ?? "—"}</dd></div>
              <div><dt>Status Perkawinan</dt><dd>{profile.statusPerkawinan ?? "—"}</dd></div>
              <div><dt>Nomor Telepon</dt><dd>{profile.maskedPhone}</dd></div>
              <div className={styles.full}><dt>Alamat Domisili</dt><dd>{profile.alamatLengkap ?? "—"}</dd></div>
              <div className={styles.full}><dt>Pekerjaan</dt><dd>{profile.pekerjaan ?? "—"}</dd></div>
            </dl>
            <div className={styles.badges}>
              <span>{statusLabel(profile.verificationStatus)}</span>
              {profile.activePath && <span>{profile.activePath}</span>}
            </div>
          </section>

          <section className={styles.section}>
            <h3>Riwayat Asesmen</h3>
            {profile.assessments.length ? (
              <div className={styles.historyList}>
                {profile.assessments.map((assessment) => (
                  <article key={assessment.id}>
                    <div><strong>{assessment.code}</strong><time dateTime={assessment.date}>{dateFormatter.format(new Date(`${assessment.date}T00:00:00+07:00`))}</time></div>
                    <p>{assessment.typeLabel} · {assessment.status}{assessment.recommendation ? ` · ${assessment.recommendation.replaceAll("_", " ")}` : ""}</p>
                  </article>
                ))}
              </div>
            ) : <p className={styles.empty}>Belum ada riwayat asesmen.</p>}
            <Link href={assessmentHref} className={styles.secondaryAction}>
              Buat Asesmen Baru
            </Link>
          </section>

          <section className={styles.section}>
            <h3>Riwayat Referral</h3>
            {profile.referrals.length ? (
              <div className={styles.historyList}>
                {profile.referrals.map((referral) => (
                  <article key={referral.id}>
                    <div><strong>{referral.targetOpd ?? "OPD belum ditetapkan"}</strong><span>{referral.status}</span></div>
                    <p>{referral.program ?? referral.type.replaceAll("_", " ")} · {dateFormatter.format(new Date(referral.sentAt))}</p>
                  </article>
                ))}
              </div>
            ) : <p className={styles.empty}>Belum ada riwayat referral.</p>}
          </section>
        </div>

        <footer className={styles.footer}>
          {canEdit ? <Link href={editHref} className={styles.edit}>Edit Data</Link> : <span className={styles.readOnly}>Data hanya dapat dilihat</span>}
        </footer>
      </aside>
    </div>
  );
}
