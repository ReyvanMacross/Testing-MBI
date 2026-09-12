"use client";

import { CalendarDays, Check, CheckCircle2, ClipboardClock, Download, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { ExecutiveRecommendation, WalikotaDecision } from "@/lib/walikota/data";
import styles from "../walikota.module.css";

const categoryLabels: Record<string, string> = {
  CAPAIAN_JALUR: "Capaian Jalur",
  SEBARAN_WILAYAH: "Sebaran Wilayah",
  RE_ENTRY: "Re-entry",
  INTEGRASI_DATA: "Integrasi Data",
  ANGGARAN: "Anggaran",
  OUTCOME: "Outcome",
};

const historyTitles: Record<string, string> = {
  CAPAIAN_JALUR: "Capaian Jalur Intervensi",
  SEBARAN_WILAYAH: "Kuota Intervensi Wilayah Prioritas",
  RE_ENTRY: "Evaluasi Kriteria Re-entry",
  INTEGRASI_DATA: "Koneksi Data Lintas OPD",
  ANGGARAN: "Evaluasi Alokasi Anggaran",
  OUTCOME: "Evaluasi Outcome Kota",
};

const opdLabels: Record<string, string> = {
  DISKOMINFO: "Diskominfo",
  DINSOS: "Dinas Sosial",
  DISNAKER: "Disnaker",
  DISKOP: "Diskop UKM",
  DISDIK: "Disdik",
  KECAMATAN: "Kecamatan",
  DP3A: "DP3A",
  DISDAGIN: "Disdagin",
  DKPP: "DKPP",
  DISBUDPAR: "Disbudpar",
  CIPTA_BINTAR: "Dinas Cipta Bintar",
  BAPPERIDA: "Bapperida",
  WALIKOTA: "Wali Kota",
};

export function ExecutiveRecommendations({ items }: { items: ExecutiveRecommendation[] }) {
  const router = useRouter();
  const pending = items.filter((item) => item.status === "MENUNGGU_PERSETUJUAN");
  const history = useMemo(
    () => items.map((item) => item.latestDecision).filter((decision): decision is WalikotaDecision => Boolean(decision)).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt)),
    [items],
  );
  const now = new Date();
  const decidedThisMonth = history.filter((decision) => {
    const date = new Date(decision.decidedAt);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).length;
  const [rejecting, setRejecting] = useState<ExecutiveRecommendation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function submitDecision(item: ExecutiveRecommendation, action: "APPROVE" | "REQUEST_REVISION", note: string) {
    setBusyId(item.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/walikota/recommendations/${item.id}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedVersion: item.version, action, priorityLevel: "NORMAL", leaderNote: note, dispositions: [] }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Keputusan tidak dapat disimpan.");
      setFeedback(action === "APPROVE" ? "Rekomendasi disetujui." : "Rekomendasi ditolak dan dikembalikan kepada Bapperida.");
      setRejecting(null);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Keputusan tidak dapat disimpan.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <header className={styles.pageHeader}>
        <div><h1>Persetujuan Rekomendasi</h1><p>Rekomendasi kebijakan yang menunggu keputusan Anda</p></div>
        <button className={styles.downloadButton} type="button" onClick={() => window.print()}><Download size={17} /> Unduh Laporan</button>
      </header>

      <section className={styles.approvalSummary} aria-label="Ringkasan persetujuan rekomendasi">
        <SummaryCard label="Menunggu Keputusan" value={pending.length} icon={<ClipboardClock />} tone="waiting" />
        <SummaryCard label="Sudah Diputuskan Bulan Ini" value={decidedThisMonth} icon={<CheckCircle2 />} tone="decided" />
      </section>

      {feedback && <p className={styles.decisionFeedback} role="status">{feedback}</p>}

      <section className={styles.pendingList} aria-label="Rekomendasi menunggu keputusan">
        {pending.length ? pending.map((item) => (
          <article className={styles.approvalCard} key={item.id}>
            <div className={styles.approvalTop}><span className={styles.pendingBadge}>MENUNGGU PERSETUJUAN</span><span>ID: {item.referenceCode}</span></div>
            <div className={styles.approvalDetails}>
              <div className={styles.proposalMeta}><dl><div><dt>Pengusul</dt><dd>Bapperida Kota Bandung</dd></div><div><dt>Kategori</dt><dd>{categoryLabels[item.category] ?? item.category}</dd></div></dl></div>
              <div className={styles.proposalMeta}><dl><div><dt>Tanggal Masuk</dt><dd><CalendarDays size={17} /> {formatDate(item.submittedAt ?? item.updatedAt)}</dd></div><div><dt>Ditujukan ke</dt><dd className={styles.recipientChips}>{item.recipients.map((recipient) => <span key={recipient.id}>{opdLabels[recipient.code] ?? recipient.name ?? recipient.code}</span>)}</dd></div></dl></div>
              <div className={styles.fullField}><span>Temuan Utama</span><strong>{item.finding}</strong></div>
              <div className={`${styles.fullField} ${styles.recommendationField}`}><span>Rekomendasi Kebijakan</span><p>{item.recommendation}</p></div>
            </div>
            <div className={styles.approvalActions}>
              <button className={styles.approveButton} type="button" disabled={busyId === item.id} onClick={() => void submitDecision(item, "APPROVE", "Rekomendasi disetujui oleh Wali Kota.")}><Check size={22} /> {busyId === item.id ? "Menyimpan..." : "Setujui"}</button>
              <button className={styles.rejectButton} type="button" disabled={busyId === item.id} onClick={() => { setFeedback(null); setRejecting(item); }}><X size={22} /> Tolak</button>
            </div>
          </article>
        )) : <div className={styles.emptyState}>Tidak ada rekomendasi yang menunggu keputusan.</div>}
      </section>

      <section className={styles.historySection} id="riwayat-keputusan">
        <h2>Riwayat Keputusan</h2>
        <div className={styles.historyList}>
          {history.length ? history.map((decision) => {
            const approved = decision.action === "APPROVE";
            return <article className={styles.historyRow} key={decision.id}><span className={approved ? styles.historyApprovedIcon : styles.historyRejectedIcon}>{approved ? <Check size={20} /> : <X size={20} />}</span><strong>{historyTitles[decision.category] ?? decision.recommendation}</strong><span className={approved ? styles.historyApproved : styles.historyRejected}>{approved ? "DISETUJUI" : "DITOLAK"}</span><time>{formatDate(decision.decidedAt)}</time></article>;
          }) : <div className={styles.emptyState}>Belum ada keputusan Wali Kota.</div>}
        </div>
      </section>

      {rejecting && <RejectDialog item={rejecting} busy={busyId === rejecting.id} onClose={() => setRejecting(null)} onConfirm={(reason) => submitDecision(rejecting, "REQUEST_REVISION", reason)} />}
    </>
  );
}

function SummaryCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "waiting" | "decided" }) {
  return <article className={styles.summaryApprovalCard}><div><span>{label}</span><strong>{value}</strong></div><div className={tone === "waiting" ? styles.waitingIcon : styles.decidedIcon}>{icon}</div></article>;
}

function RejectDialog({ item, busy, onClose, onConfirm }: { item: ExecutiveRecommendation; busy: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}>
      <section className={styles.rejectModal} role="dialog" aria-modal="true" aria-labelledby="reject-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><h2 id="reject-title">Tolak Rekomendasi</h2><button type="button" aria-label="Tutup" onClick={onClose}><X /></button></header>
        <form onSubmit={(event) => { event.preventDefault(); void onConfirm(reason); }}>
          <div className={styles.rejectBody}>
            <p>Anda akan menolak pengajuan <strong>{categoryLabels[item.category] ?? item.category}</strong>. Harap berikan alasan penolakan untuk catatan sistem.</p>
            <label><span>Alasan penolakan (wajib diisi)</span><textarea autoFocus required minLength={10} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Masukkan alasan penolakan..." /></label>
          </div>
          <footer><button type="button" onClick={onClose}>Batal</button><button className={styles.confirmReject} type="submit" disabled={busy || reason.trim().length < 10}>{busy ? "Menyimpan..." : "Konfirmasi Tolak"}</button></footer>
        </form>
      </section>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(value));
}
