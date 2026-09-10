import Link from "next/link";
import { notFound } from "next/navigation";

import { ResultActions } from "@/components/dinsos/kasus/aksi-hasil-desil";
import resultStyles from "@/components/dinsos/kasus/hasil-desil.module.css";
import styles from "@/components/dinsos/kasus/kasus.module.css";
import { RingkasanKasus } from "@/components/dinsos/kasus/ringkasan-kasus";
import { TabTahapanKasus } from "@/components/dinsos/kasus/tab-tahapan-kasus";
import { TahapBelumTersedia } from "@/components/dinsos/kasus/tahap-belum-tersedia";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { getDinsosCaseById } from "@/lib/dinsos/cases";

const dimensions = [
  ["Kemiskinan", "score_kemiskinan"],
  ["Pekerjaan", "score_pekerjaan"],
  ["Pendidikan", "score_pendidikan"],
  ["Kesehatan", "score_kesehatan"],
  ["Kondisi Keluarga", "score_kondisi_keluarga"],
  ["Tempat Tinggal", "score_tempat_tinggal"],
  ["Administrasi", "score_administrasi"],
  ["Kapasitas Individu", "score_kapasitas_individu"],
] as const;

export default async function ResultPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const actor = await requireDinsosActor();
  const item = await getDinsosCaseById(caseId, actor.profileId);
  if (!item) notFound();

  const assessmentReady = item.assessment?.status === "COMPLETED";
  const confirmed = item.result?.status === "CONFIRMED";

  if (!assessmentReady) {
    return (
      <section>
        <div className={styles.breadcrumb}>
          <span>Asesmen Sosial &nbsp;/&nbsp; <strong>Hasil Desil</strong></span>
          <Link className={styles.back} href="/dinsos">← Kembali ke Antrian</Link>
        </div>
        <RingkasanKasus item={item} ringkas />
        <TabTahapanKasus caseId={caseId} active="result" assessmentReady={false} resultReady={false} />
        <TahapBelumTersedia
          judul="Hasil Desil belum tersedia"
          deskripsi="Selesaikan Asesmen Sosial terlebih dahulu. Setelah asesmen selesai, hasil desil dan rincian delapan dimensi akan tampil di halaman ini."
          aksiHref={`/dinsos/kasus/${caseId}/asesmen`}
          aksiLabel="Isi Asesmen Sosial"
        />
      </section>
    );
  }

  const operational = Number(item.result?.operational_desil ?? item.officialDesil?.desil ?? 0) || null;
  const disposition = operational === null
    ? "Hasil Desil Belum Tersedia"
    : operational <= 2
      ? "STABILISASI SOSIAL"
      : "SPLIT JALUR";

  return (
    <section>
      <div className={styles.breadcrumb}>
        <span>Asesmen Sosial &nbsp;/&nbsp; <strong>Hasil Desil</strong></span>
        <Link className={styles.back} href="/dinsos">← Kembali ke Antrian</Link>
      </div>
      <RingkasanKasus item={item} ringkas />
      <TabTahapanKasus caseId={caseId} active="result" assessmentReady resultReady={confirmed} />
      {item.verification?.status === "VERIFIED" && <p className={styles.verifiedNotice}>Terverifikasi Dukcapil</p>}
      <div className={resultStyles.layout}>
        <article className={resultStyles.resultCard}>
          <div>
            <p>Hasil {item.result?.result_source === "OVERRIDE" ? "Operasional" : "DTSEN Resmi"}</p>
            {operational ? <strong>Desil {operational}</strong> : <strong>—</strong>}
            <span className={resultStyles.disposition}>{disposition}</span>
            <p>
              {operational
                ? operational <= 2
                  ? "Warga memerlukan Proteksi dan Stabilisasi Sosial."
                  : "Warga dapat melanjutkan ke penentuan jalur intervensi."
                : "Konfirmasi dinonaktifkan sampai hasil resmi tersedia."}
            </p>
          </div>
        </article>
        <aside className={resultStyles.dimensions}>
          <h2>Rincian 8 Dimensi</h2>
          <p>Skor kerentanan per dimensi</p>
          {dimensions.map(([label, key]) => {
            const score = typeof item.assessment?.[key] === "number" ? Number(item.assessment[key]) : null;
            const color = score === null ? "#d1d5db" : score >= 80 ? "#bd1e27" : score >= 50 ? "#f57c00" : "#21613a";
            return (
              <div className={resultStyles.dimension} key={key}>
                <div><span>{label}</span><strong>{score === null ? "Belum dihitung" : `${score}/100`}</strong></div>
                <div className={resultStyles.track}><span style={{ width: `${score ?? 0}%`, backgroundColor: color }} /></div>
              </div>
            );
          })}
        </aside>
      </div>
      <ResultActions caseId={caseId} canOverride={item.canOverride} confirmed={confirmed} currentDesil={operational} />
    </section>
  );
}
