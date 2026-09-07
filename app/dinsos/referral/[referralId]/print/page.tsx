import { notFound, redirect } from "next/navigation";

import { PrintButton, PrintOnLoad } from "@/components/dinsos/print-on-load";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { getReferralById } from "@/lib/dinsos/referrals";
import { dinsosPathLabel } from "@/lib/dinsos/path-values";

import styles from "./print.module.css";

const date = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "long", year: "numeric" });

export const metadata = { title: "Surat Rujukan MBI" };

export default async function ReferralPrintPage({ params }: { params: Promise<{ referralId: string }> }) {
  try { await requireDinsosActor(); } catch { redirect("/login"); }
  const { referralId } = await params;
  const referral = await getReferralById(referralId);
  if (!referral) notFound();
  return (
    <main className={styles.page}>
      <PrintOnLoad />
      <div className={styles.actions}><PrintButton /></div>
      <header><p>Platform MBI · Kota Bandung</p><h1>Surat Rujukan MBI</h1><span>{referral.referralCode}</span></header>
      <section><h2>Informasi Rujukan</h2><dl><div><dt>ID Referral</dt><dd>{referral.referralCode}</dd></div><div><dt>Tanggal Rujukan</dt><dd>{referral.referralDate ? date.format(new Date(`${referral.referralDate}T00:00:00+07:00`)) : "—"}</dd></div></dl></section>
      <section><h2>Warga</h2><dl><div><dt>Nama Warga</dt><dd>{referral.nama}</dd></div><div><dt>NIK</dt><dd>{referral.maskedNik}</dd></div><div><dt>Kelurahan</dt><dd>{referral.kelurahan}</dd></div></dl></section>
      <section><h2>Tujuan Intervensi</h2><dl><div><dt>Jalur MBI</dt><dd>{dinsosPathLabel(referral.jalur)}</dd></div><div><dt>OPD Tujuan</dt><dd>{referral.targetOpd}</dd></div><div><dt>Program Intervensi</dt><dd>{referral.program ?? "Belum ditentukan"}</dd></div></dl></section>
      <section><h2>Instruksi Rujukan</h2><p>{referral.instruction ?? "—"}</p></section>
      <footer><p>Diterbitkan oleh</p><strong>Dinas Sosial Kota Bandung</strong></footer>
    </main>
  );
}
