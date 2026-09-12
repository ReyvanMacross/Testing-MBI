"use client";

import { Plus, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { BapperidaRecommendation } from "@/lib/bapperida/data";
import styles from "../bapperida.module.css";

type OpdOption = { id: string; code: string; name: string };
type EditState = BapperidaRecommendation | "NEW" | null;

const categoryLabels: Record<string, string> = { CAPAIAN_JALUR: "Capaian Jalur", SEBARAN_WILAYAH: "Sebaran Wilayah", RE_ENTRY: "Re-entry", INTEGRASI_DATA: "Integrasi Data", ANGGARAN: "Anggaran", OUTCOME: "Outcome" };
const statusLabels: Record<string, string> = { DRAFT: "Draf", MENUNGGU_PERSETUJUAN: "Menunggu Persetujuan", PERLU_REVISI: "Perlu Revisi", DITINDAKLANJUTI: "Ditindaklanjuti", SELESAI: "Selesai ✓" };

export function RecommendationsPage({ items, opdOptions, status }: { items: BapperidaRecommendation[]; opdOptions: OpdOption[]; status?: string }) {
  const [editing, setEditing] = useState<EditState>(null);
  const filtered = status && status !== "SEMUA" ? items.filter((item) => item.status === status) : items;
  const counts = useMemo(() => ({ total: items.length, draft: items.filter((item) => item.status === "DRAFT").length, pending: items.filter((item) => item.status === "MENUNGGU_PERSETUJUAN").length, revision: items.filter((item) => item.status === "PERLU_REVISI").length }), [items]);
  return <>
    <section className={styles.recommendationGrid}><Summary label="Total Rekomendasi" value={counts.total} /><Summary label="Baru" value={counts.draft} /><Summary label="Menunggu Persetujuan" value={counts.pending} /><Summary label="Perlu Revisi" value={counts.revision} /></section>
    {editing && <RecommendationComposer item={editing === "NEW" ? null : editing} opdOptions={opdOptions} onClose={() => setEditing(null)} />}
    <section className={styles.recommendationList}>{filtered.map((item) => <article className={styles.recommendationItem} key={item.id}>
      <div className={styles.recommendationTop}><span className={styles.categoryBadge}>{categoryLabels[item.category] ?? item.category}</span><span className={`${styles.statusBadge} ${styles[`status${item.status}`] ?? ""}`}>{statusLabels[item.status]}</span></div>
      {item.mayorNote && <div className={styles.mayorNote}>Catatan Wali Kota: {item.mayorNote}</div>}
      <div className={styles.recommendationBody}><div><h3>Temuan</h3><p>{item.finding}</p></div><div><h3>Rekomendasi</h3><p><a>{item.recommendation}</a></p></div></div>
      <div className={styles.recipientRow}><span>Ditujukan ke:</span>{item.recipients.map((recipient) => <span className={styles.recipientChip} key={recipient.id}>{recipient.code}</span>)}{item.status === "PERLU_REVISI" ? <button className={styles.submit} type="button" onClick={() => setEditing(item)}>Revisi &amp; Ajukan Ulang</button> : <time>{formatDate(item.updatedAt)}</time>}</div>
    </article>)}</section>
    <button className={styles.floatingCreate} type="button" onClick={() => setEditing("NEW")}><Plus size={18} /> Buat Rekomendasi Baru</button>
  </>;
}

function Summary({ label, value }: { label: string; value: number }) { return <article className={styles.recommendationCard}><span>{label}</span><strong>{value}</strong></article>; }

function RecommendationComposer({ item, opdOptions, onClose }: { item: BapperidaRecommendation | null; opdOptions: OpdOption[]; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  async function submit(formElement: HTMLFormElement, submitNow: boolean) {
    setBusy(true); setFeedback(null);
    const form = new FormData(formElement);
    const payload = { recommendationId: item?.id, expectedVersion: item?.version, category: form.get("category"), finding: form.get("finding"), recommendation: form.get("recommendation"), recipientOpdIds: form.getAll("recipients"), submit: submitNow };
    try {
      const response = await fetch("/api/bapperida/recommendations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Rekomendasi tidak dapat disimpan.");
      setFeedback(submitNow ? "Rekomendasi berhasil diajukan ke Wali Kota." : "Draf rekomendasi berhasil disimpan.");
      router.refresh(); setTimeout(onClose, 650);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Rekomendasi tidak dapat disimpan."); }
    finally { setBusy(false); }
  }
  return <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget, false); }}>
    <div className={styles.recommendationTop}><strong>{item ? "Revisi Rekomendasi" : "Rekomendasi Baru"}</strong><span className={styles.categoryBadge}>{item?.status ?? "DRAF"}</span></div>
    <div className={styles.composerTop}><label className={styles.field}><span>Kategori</span><select name="category" defaultValue={item?.category ?? ""} required><option value="" disabled>Pilih kategori...</option>{Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><div className={styles.field}><span>Ditujukan ke</span><div className={styles.recipientOptions}>{opdOptions.map((opd) => <label key={opd.id}><input type="checkbox" name="recipients" value={opd.id} defaultChecked={item?.recipients.some((recipient) => recipient.id === opd.id)} />{opd.code}</label>)}</div></div><span>Status<br /><strong>Menunggu Pengajuan</strong></span></div>
    <label className={styles.field}><span>Temuan Utama</span><textarea name="finding" defaultValue={item?.finding} placeholder="Jelaskan temuan..." required minLength={10} /></label>
    <label className={styles.field}><span>Rekomendasi Kebijakan</span><textarea name="recommendation" defaultValue={item?.recommendation} placeholder="Tulis rekomendasi..." required minLength={10} /></label>
    {feedback && <p className={`${styles.feedback} ${feedback.includes("tidak") || feedback.includes("diubah") ? styles.error : ""}`}>{feedback}</p>}
    <div className={styles.composerActions}><button type="button" onClick={onClose}>Batal</button><button type="submit" disabled={busy}>Simpan sebagai Draf</button><button className={styles.submit} type="button" disabled={busy} onClick={(event) => { if (event.currentTarget.form) void submit(event.currentTarget.form, true); }}><Send size={16} /> {busy ? "Memproses..." : "Ajukan ke Wali Kota"}</button></div>
  </form>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }
