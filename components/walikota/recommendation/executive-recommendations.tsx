"use client";

import { CheckCircle2, Gavel, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { ExecutiveRecommendation } from "@/lib/walikota/data";
import styles from "../walikota.module.css";

type OpdOption = { id: string; code: string; name: string };
const categoryLabels: Record<string, string> = { CAPAIAN_JALUR: "Capaian Jalur", SEBARAN_WILAYAH: "Sebaran Wilayah", RE_ENTRY: "Re-entry", INTEGRASI_DATA: "Integrasi Data", ANGGARAN: "Anggaran", OUTCOME: "Outcome" };
const statusLabels: Record<string, string> = { MENUNGGU_PERSETUJUAN: "Menunggu Keputusan", PERLU_REVISI: "Revisi Diminta", DITINDAKLANJUTI: "Disetujui", SELESAI: "Selesai" };

export function ExecutiveRecommendations({ items, opdOptions, status }: { items: ExecutiveRecommendation[]; opdOptions: OpdOption[]; status?: string }) {
  const [reviewing, setReviewing] = useState<ExecutiveRecommendation | null>(null);
  const filtered = status && status !== "SEMUA" ? items.filter((item) => item.status === status) : items;
  const counts = useMemo(() => ({
    total: items.length,
    pending: items.filter((item) => item.status === "MENUNGGU_PERSETUJUAN").length,
    approved: items.filter((item) => item.status === "DITINDAKLANJUTI").length,
    revision: items.filter((item) => item.status === "PERLU_REVISI").length,
  }), [items]);
  return <>
    <section className={styles.recommendationGrid}><Summary label="Rekomendasi Strategis" value={counts.total} /><Summary label="Menunggu Keputusan" value={counts.pending} /><Summary label="Disetujui" value={counts.approved} /><Summary label="Perlu Revisi" value={counts.revision} /></section>
    <section className={styles.recommendationList}>{filtered.length ? filtered.map((item) => <article className={styles.recommendationItem} key={item.id}>
      <div className={styles.recommendationTop}><div className={styles.decisionMeta}><span className={styles.categoryBadge}>{categoryLabels[item.category] ?? item.category}</span><span className={styles.recipientChip}>{item.referenceCode}</span></div><span className={`${styles.statusBadge} ${styles[`status${item.status}`] ?? ""}`}>{statusLabels[item.status] ?? item.status}</span></div>
      {item.mayorNote && <div className={styles.mayorNote}>Catatan Wali Kota: {item.mayorNote}</div>}
      <div className={styles.recommendationBody}><div><h3>Temuan Bapperida</h3><p>{item.finding}</p></div><div><h3>Rekomendasi Strategis</h3><p><a>{item.recommendation}</a></p></div></div>
      <div className={styles.recipientRow}><span>Perangkat daerah terkait:</span>{item.recipients.map((recipient) => <span className={styles.recipientChip} key={recipient.id}>{recipient.code}</span>)}<time>{formatDate(item.submittedAt ?? item.updatedAt)}</time>{item.status === "MENUNGGU_PERSETUJUAN" && <div className={styles.reviewActions}><button className={styles.approve} type="button" onClick={() => setReviewing(item)}><Gavel size={16} /> Beri Keputusan</button></div>}</div>
    </article>) : <div className={styles.emptyState}>Tidak ada rekomendasi pada status ini.</div>}</section>
    {reviewing && <ReviewDialog item={reviewing} opdOptions={opdOptions} onClose={() => setReviewing(null)} />}
  </>;
}

function Summary({ label, value }: { label: string; value: number }) { return <article className={styles.recommendationCard}><span>{label}</span><strong>{value}</strong></article>; }

function ReviewDialog({ item, opdOptions, onClose }: { item: ExecutiveRecommendation; opdOptions: OpdOption[]; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(item.recipients.map((recipient) => recipient.id));

  async function decide(form: HTMLFormElement, action: "APPROVE" | "REQUEST_REVISION") {
    setBusy(true); setFeedback(null);
    const fields = new FormData(form);
    const instruction = String(fields.get("instruction") ?? "").trim();
    if (action === "APPROVE" && selected.length && instruction.length < 10) { setFeedback("Instruksi disposisi minimal 10 karakter."); setBusy(false); return; }
    const payload = {
      expectedVersion: item.version,
      action,
      priorityLevel: fields.get("priorityLevel"),
      leaderNote: fields.get("leaderNote"),
      dispositions: action === "APPROVE" ? selected.map((opdId) => ({ opdId, instruction, dueDate: fields.get("dueDate") || null })) : [],
    };
    try {
      const response = await fetch(`/api/walikota/recommendations/${item.id}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Keputusan tidak dapat disimpan.");
      setFeedback(action === "APPROVE" ? "Rekomendasi disetujui dan disposisi diterbitkan." : "Permintaan revisi dikirim ke Bapperida.");
      router.refresh(); setTimeout(onClose, 700);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Keputusan tidak dapat disimpan."); }
    finally { setBusy(false); }
  }

  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="executive-review-title" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><span className={styles.eyebrow}>KEPUTUSAN EKSEKUTIF</span><h2 id="executive-review-title">Tinjau {item.referenceCode}</h2></div><button type="button" aria-label="Tutup" onClick={onClose}><X /></button></header>
    <form className={`${styles.modalBody} ${styles.reviewForm}`} onSubmit={(event) => { event.preventDefault(); void decide(event.currentTarget, "APPROVE"); }}>
      <div className={styles.field}><span>Rekomendasi Bapperida</span><strong>{item.recommendation}</strong></div>
      <label className={styles.field}><span>Tingkat Prioritas</span><select name="priorityLevel" defaultValue="TINGGI"><option value="NORMAL">Normal</option><option value="TINGGI">Tinggi</option><option value="MENDESAK">Mendesak</option></select></label>
      <label className={styles.field}><span>Catatan Pimpinan</span><textarea name="leaderNote" required minLength={10} maxLength={2000} placeholder="Tuliskan pertimbangan keputusan atau arahan revisi..." /></label>
      <div className={styles.field}><span>Disposisi ke Perangkat Daerah (opsional)</span><div className={styles.checkboxGrid}>{opdOptions.map((opd) => <label key={opd.id}><input type="checkbox" checked={selected.includes(opd.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, opd.id] : current.filter((id) => id !== opd.id))} />{opd.code}</label>)}</div></div>
      <label className={styles.field}><span>Instruksi Disposisi</span><textarea name="instruction" placeholder="Arahan tindak lanjut bagi perangkat daerah terpilih..." /></label>
      <label className={styles.field}><span>Tenggat Disposisi</span><input name="dueDate" type="date" /></label>
      {feedback && <p className={`${styles.feedback} ${feedback.includes("tidak") || feedback.includes("minimal") ? styles.error : ""}`}>{feedback}</p>}
      <div className={styles.composerActions}><button type="button" onClick={onClose}>Batal</button><button type="button" disabled={busy} onClick={(event) => { if (event.currentTarget.form) void decide(event.currentTarget.form, "REQUEST_REVISION"); }}><RotateCcw size={16} /> Minta Revisi</button><button className={styles.submit} type="submit" disabled={busy}><CheckCircle2 size={16} /> {busy ? "Menyimpan..." : "Setujui Rekomendasi"}</button></div>
    </form>
  </section></div>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }
