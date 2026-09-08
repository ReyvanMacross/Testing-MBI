import {
  ChartNoAxesColumnIncreasing,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GitBranch,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { GambarTerlindungi } from "@/components/dinsos/kasus/gambar-terlindungi";
import { JudulHalaman } from "@/components/dinsos/shared/judul-halaman";
import { KartuRingkasan } from "@/components/dinsos/shared/kartu-ringkasan";
import { DINSOS_STAGES, stageLabel } from "@/lib/dinsos/case-stage";
import {
  getDinsosCases,
  getDinsosFilterOptions,
  getQueueSummary,
  type DinsosCaseFilters,
} from "@/lib/dinsos/cases";

import styles from "./dinsos.module.css";

type Props = {
  searchParams: Promise<{
    q?: string;
    kelurahan?: string;
    stage?: string;
    sort?: string;
    page?: string;
  }>;
};

function href(filters: DinsosCaseFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.kelurahan) params.set("kelurahan", filters.kelurahan);
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.sort && filters.sort !== "priority") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/dinsos?${query}` : "/dinsos";
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

const fotoPengganti = (jenisKelamin: string | null) =>
  jenisKelamin?.toLocaleLowerCase("id-ID").includes("perempuan")
    ? "/images/dinsos/profil-warga-perempuan.jpg"
    : "/images/dinsos/profil-warga-laki-laki.jpg";

export default async function DinsosQueuePage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const search = params.q?.trim();
  const kelurahan = params.kelurahan?.trim();
  const filters: DinsosCaseFilters = {
    search: search && search.length <= 100 ? search : undefined,
    kelurahan: kelurahan && kelurahan.length <= 100 ? kelurahan : undefined,
    stage: DINSOS_STAGES.includes(params.stage as never) ? params.stage : undefined,
    sort: ["priority", "oldest", "newest"].includes(params.sort ?? "")
      ? (params.sort as DinsosCaseFilters["sort"])
      : "priority",
    page,
  };
  const [summary, result, options] = await Promise.all([
    getQueueSummary(),
    getDinsosCases(filters),
    getDinsosFilterOptions(),
  ]);
  const cards = [
    { label: "Menunggu Asesmen", value: summary.waitingAssessment, icon: ClipboardList, tone: "blue" as const },
    { label: "Menunggu Penetapan Desil", value: summary.waitingDesil, icon: ChartNoAxesColumnIncreasing, tone: "neutral" as const },
    { label: "Menunggu Stabilisasi", value: summary.waitingStabilization, icon: ShieldCheck, tone: "neutral" as const },
    { label: "Menunggu Split Jalur", value: summary.waitingSplit, icon: GitBranch, tone: "amber" as const },
    { label: "Referral Terkirim Bulan Ini", value: summary.referralsThisMonth, icon: Send, tone: "green" as const },
  ];

  const hasFilters = Boolean(filters.search || filters.kelurahan || filters.stage || filters.sort !== "priority");
  const start = result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const end = Math.min(result.page * result.pageSize, result.total);

  return (
    <section aria-labelledby="queue-heading">
      <JudulHalaman
        id="queue-heading"
        title="Antrian Kerja Harian"
        subtitle="Daftar tugas perlindungan dan inklusi sosial yang perlu ditindaklanjuti hari ini."
      />

      <div className={styles.summary}>
        {cards.map((card) => <KartuRingkasan key={card.label} {...card} />)}
      </div>

      <section className={styles.queueCard}>
        <div className={styles.queueHeader}>
          <h2>Antrian Kerja Hari Ini</h2>
          <form className={styles.filters} method="get">
            <label className={styles.searchField}>
              <span className={styles.srOnly}>Cari NIK atau nama</span>
              <Search size={15} aria-hidden="true" />
              <input name="q" defaultValue={filters.search} placeholder="NIK atau Nama..." maxLength={100} />
            </label>
            <label>
              <span className={styles.srOnly}>Kelurahan</span>
              <select name="kelurahan" defaultValue={filters.kelurahan ?? ""}>
                <option value="">Semua Kelurahan</option>
                {options.kelurahan.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span className={styles.srOnly}>Tahap</span>
              <select name="stage" defaultValue={filters.stage ?? ""}>
                <option value="">Semua Tahap</option>
                {DINSOS_STAGES.slice(0, 6).map((item) => <option key={item} value={item}>{stageLabel(item)}</option>)}
              </select>
            </label>
            <select name="sort" defaultValue={filters.sort} aria-label="Urutkan antrian">
              <option value="priority">Prioritas</option>
              <option value="oldest">Terlama</option>
              <option value="newest">Terbaru</option>
            </select>
            <button type="submit">Terapkan</button>
            {hasFilters && <Link href="/dinsos">Reset</Link>}
          </form>
        </div>

        {result.cases.length === 0 ? (
          <p className={styles.empty}>{hasFilters ? "Tidak ada kasus yang sesuai dengan filter." : "Belum ada antrian kasus Dinas Sosial."}</p>
        ) : (
          <>
            <div className={styles.desktop}>
              <table>
                <thead><tr><th>NIK</th><th>Nama</th><th>Kelurahan</th><th>Tahap Saat Ini</th><th>Prioritas</th><th>Tanggal Masuk</th><th>Aksi</th></tr></thead>
                <tbody>{result.cases.map((item) => (
                  <tr key={item.caseId}>
                    <td>{item.maskedNik}</td>
                    <td><div className={styles.personCell}><GambarTerlindungi tersedia={item.hasPhoto} src={`/api/dinsos/cases/${item.caseId}/documents/ktp`} fallbackSrc={fotoPengganti(item.jenisKelamin)} alt={`Foto ${item.nama}`} jenis="profil" /><strong>{item.nama}</strong></div></td>
                    <td>{item.kelurahan ?? "—"}{!item.locationResolved && <span className={styles.unresolved} title="Belum terhubung master wilayah">!</span>}</td>
                    <td><span className={styles.stage}>{stageLabel(item.currentStage)}</span></td>
                    <td><span className={`${styles.priority} ${styles[item.priority.toLowerCase()]}`}>{item.priority}</span></td>
                    <td>{formatDate(item.queueEnteredAt)}</td>
                    <td><Link className={styles.process} href={`/dinsos/kasus/${item.caseId}`}>Proses</Link></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className={styles.mobile}>
              {result.cases.map((item) => (
                <article key={item.caseId}>
                  <header><div className={styles.mobilePerson}><GambarTerlindungi tersedia={item.hasPhoto} src={`/api/dinsos/cases/${item.caseId}/documents/ktp`} fallbackSrc={fotoPengganti(item.jenisKelamin)} alt={`Foto ${item.nama}`} jenis="profil" /><div><h3>{item.nama}</h3><p>{item.maskedNik}</p></div></div><span className={`${styles.priority} ${styles[item.priority.toLowerCase()]}`}>{item.priority}</span></header>
                  <dl>
                    <div><dt>Kelurahan</dt><dd>{item.kelurahan ?? "—"}</dd></div>
                    <div><dt>Tahap</dt><dd>{stageLabel(item.currentStage)}</dd></div>
                    <div><dt>Masuk</dt><dd>{formatDate(item.queueEnteredAt)}</dd></div>
                  </dl>
                  <Link className={styles.process} href={`/dinsos/kasus/${item.caseId}`}>Proses Kasus</Link>
                </article>
              ))}
            </div>
          </>
        )}

        {result.total > 0 && (
          <nav className={styles.pagination} aria-label="Navigasi antrian">
            <p>Menampilkan {start}–{end} dari {result.total} antrian</p>
            <div>
              {result.page > 1 ? <Link href={href(filters, result.page - 1)} aria-label="Halaman sebelumnya"><ChevronLeft size={14} /></Link> : <span><ChevronLeft size={14} /></span>}
              <strong>{result.page}</strong>
              <span className={styles.pageCount}>dari {result.totalPages}</span>
              {result.page < result.totalPages ? <Link href={href(filters, result.page + 1)} aria-label="Halaman berikutnya"><ChevronRight size={14} /></Link> : <span><ChevronRight size={14} /></span>}
            </div>
          </nav>
        )}
      </section>
    </section>
  );
}
