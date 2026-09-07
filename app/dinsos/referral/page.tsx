import Link from "next/link";
import { redirect } from "next/navigation";

import { ProcessReferralDialog } from "@/components/dinsos/process-referral-dialog";
import { ReferralProgressDrawer } from "@/components/dinsos/referral-progress-drawer";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { getReferralProgress } from "@/lib/dinsos/referral-progress";
import {
  getCompatiblePrograms, getReferralById, getReferrals, getReferralSummary,
  REFERRAL_STATUSES, referralAction, type ReferralFilters, type ReferralStatus,
} from "@/lib/dinsos/referrals";
import { DINSOS_PATHS, dinsosPathLabel, type DinsosPath } from "@/lib/dinsos/path-values";

import styles from "./referral.module.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function statusLabel(status: ReferralStatus) {
  return status === "MENUNGGU_RUJUKAN" ? "MENUNGGU" : status.replaceAll("_", " ");
}

function href(filters: ReferralFilters, page: number, referral?: string, mode?: string) {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.path) params.set("path", filters.path);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  if (referral) params.set("referral", referral);
  if (mode) params.set("mode", mode);
  const query = params.toString();
  return query ? `/dinsos/referral?${query}` : "/dinsos/referral";
}

export default async function DinsosReferralRegistry({ searchParams }: {
  searchParams: Promise<{ q?: string; path?: string; status?: string; page?: string; referral?: string; mode?: string }>;
}) {
  const params = await searchParams;
  await requireDinsosActor();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const search = params.q?.trim();
  const filters: ReferralFilters = {
    search: search && search.length <= 100 ? search : undefined,
    path: DINSOS_PATHS.includes(params.path as DinsosPath) ? params.path as DinsosPath : undefined,
    status: REFERRAL_STATUSES.includes(params.status as ReferralStatus) ? params.status as ReferralStatus : undefined,
    page,
  };
  const [summary, result] = await Promise.all([getReferralSummary(), getReferrals(filters)]);
  const selectedId = params.referral && UUID.test(params.referral) ? params.referral : null;
  if (params.referral && !selectedId) redirect(href(filters, page));
  const selected = selectedId ? await getReferralById(selectedId) : null;
  if (selectedId && !selected) redirect(href(filters, page));
  const closeHref = href(filters, page);
  const processMode = params.mode === "process";
  if (processMode && selected?.status !== "MENUNGGU_RUJUKAN") redirect(selected ? href(filters, page, selected.referralId, "progress") : closeHref);
  const [programs, progress] = selected
    ? await Promise.all([
        processMode ? getCompatiblePrograms(selected) : Promise.resolve([]),
        !processMode ? getReferralProgress(selected.referralId) : Promise.resolve(null),
      ])
    : [[], null];
  const activeFilters = Boolean(filters.search || filters.path || filters.status);
  const start = result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const end = Math.min(result.page * result.pageSize, result.total);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  return (
    <section aria-labelledby="referral-title">
      <header className={styles.pageHeader}>
        <div><h1 id="referral-title">Split Jalur &amp; Referral</h1><p>Pengalokasian warga terverifikasi ke program OPD dan pemantauan status rujukan.</p></div>
      </header>
      <div className={styles.summaryGrid}>
        <article><p>Menunggu Rujukan</p><strong>{summary.waitingReferral.toLocaleString("id-ID")}</strong></article>
        <article><p>Diproses OPD</p><strong>{summary.inOpdProcess.toLocaleString("id-ID")}</strong></article>
        <article><p>Intervensi Selesai</p><strong>{summary.interventionCompleted.toLocaleString("id-ID")}</strong></article>
      </div>
      <section className={styles.registryCard} aria-label="Daftar referral MBI">
        <form className={styles.filters} method="get">
          <label className={styles.search}><span>Cari Referral</span><input type="search" name="q" maxLength={100} defaultValue={filters.search} placeholder="Cari NIK, Nama, ID Referral, atau OPD..." /></label>
          <label><span>Jalur MBI</span><select name="path" defaultValue={filters.path ?? ""}><option value="">Semua Jalur</option>{DINSOS_PATHS.map((path) => <option key={path} value={path}>{dinsosPathLabel(path)}</option>)}</select></label>
          <label><span>Status</span><select name="status" defaultValue={filters.status ?? ""}><option value="">Semua Status</option>{REFERRAL_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
          <button type="submit">Filter</button>{activeFilters && <Link href="/dinsos/referral">Reset</Link>}
        </form>
        {result.referrals.length ? <>
          <div className={styles.desktopTable}><table><thead><tr><th scope="col">ID Referral</th><th scope="col">NIK &amp; Nama Warga</th><th scope="col">Jalur MBI</th><th scope="col">OPD Tujuan</th><th scope="col">Program Intervensi</th><th scope="col">Status</th><th scope="col">Aksi</th></tr></thead><tbody>{result.referrals.map((item) => {
            const action = referralAction(item.status); const mode = action === "PROCESS" ? "process" : "progress";
            return <tr key={item.referralId}><td><strong>{item.referralCode}</strong></td><td><span>{item.nama}</span><code>{item.maskedNik}</code></td><td>{dinsosPathLabel(item.jalur)}</td><td>{item.targetOpd}</td><td>{item.program ?? "Belum ditentukan"}</td><td><span className={`${styles.badge} ${styles[item.status.toLowerCase()]}`}>{statusLabel(item.status)}</span></td><td><Link className={styles.action} href={href(filters, page, item.referralId, mode)}>{action === "PROCESS" ? "Proses Rujukan" : action === "PROGRESS" ? "Lacak Progress" : "Lihat Detail"}</Link></td></tr>;
          })}</tbody></table></div>
          <div className={styles.mobileCards}>{result.referrals.map((item) => { const action = referralAction(item.status); const mode = action === "PROCESS" ? "process" : "progress"; return <article key={item.referralId}><header><strong>{item.referralCode}</strong><span className={`${styles.badge} ${styles[item.status.toLowerCase()]}`}>{statusLabel(item.status)}</span></header><h2>{item.nama}</h2><code>{item.maskedNik}</code><dl><div><dt>Jalur</dt><dd>{dinsosPathLabel(item.jalur)}</dd></div><div><dt>OPD</dt><dd>{item.targetOpd}</dd></div><div><dt>Program</dt><dd>{item.program ?? "Belum ditentukan"}</dd></div></dl><Link className={styles.action} href={href(filters, page, item.referralId, mode)}>{action === "PROCESS" ? "Proses Rujukan" : action === "PROGRESS" ? "Lacak Progress" : "Lihat Detail"}</Link></article>; })}</div>
        </> : <p className={styles.empty}>{activeFilters ? "Tidak ada referral yang sesuai dengan filter." : "Belum ada referral MBI."}</p>}
        <nav className={styles.pagination} aria-label="Navigasi halaman referral"><p>Menampilkan {start}–{end} dari {result.total.toLocaleString("id-ID")} referral</p><div>{result.page > 1 ? <Link href={href(filters, result.page - 1)} aria-label="Halaman sebelumnya">‹</Link> : <span>‹</span>}<strong aria-current="page">{result.page}</strong><span>dari {result.totalPages}</span>{result.page < result.totalPages ? <Link href={href(filters, result.page + 1)} aria-label="Halaman berikutnya">›</Link> : <span>›</span>}</div></nav>
      </section>
      {selected && processMode && <ProcessReferralDialog referral={selected} programs={programs} today={today} closeHref={closeHref} />}
      {selected && !processMode && progress && <ReferralProgressDrawer progress={progress} closeHref={closeHref} />}
    </section>
  );
}
