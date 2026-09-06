import Link from "next/link";
import { redirect } from "next/navigation";

import { AssessmentDetailDrawer } from "@/components/dinsos/assessment-detail-drawer";
import { AssessmentReviewDrawer } from "@/components/dinsos/assessment-review-drawer";
import { hasCapability } from "@/lib/auth/require-capability";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import {
  ASSESSMENT_PATHS,
  ASSESSMENT_STATUSES,
  type AssessmentPath,
  type AssessmentRegistryStatus,
} from "@/lib/dinsos/assessment-registry-input";
import {
  getAssessmentById,
  getAssessmentFilterOptions,
  getAssessments,
  getAssessmentSummary,
  type AssessmentFilters,
  type AssessmentListItem,
} from "@/lib/dinsos/assessments";

import styles from "./asesmen.module.css";

type Props = {
  searchParams: Promise<{
    q?: string;
    type?: string;
    path?: string;
    status?: string;
    page?: string;
    assessment?: string;
    mode?: string;
  }>;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const date = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function statusLabel(status: AssessmentRegistryStatus) {
  return status.replaceAll("_", " ");
}

function pathLabel(path: AssessmentPath | null) {
  return path?.replaceAll("_", " ") ?? "—";
}

function buildHref(
  filters: AssessmentFilters,
  page: number,
  assessmentId?: string,
  mode?: "review",
) {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.type) params.set("type", filters.type);
  if (filters.path) params.set("path", filters.path);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  if (assessmentId) params.set("assessment", assessmentId);
  if (mode) params.set("mode", mode);
  const query = params.toString();
  return query ? `/dinsos/asesmen?${query}` : "/dinsos/asesmen";
}

function Action({
  assessment,
  filters,
  page,
  canReview,
}: {
  assessment: AssessmentListItem;
  filters: AssessmentFilters;
  page: number;
  canReview: boolean;
}) {
  const review = assessment.status === "PERLU_REVIEW" && canReview;
  return (
    <Link
      className={styles.action}
      href={buildHref(filters, page, assessment.assessmentId, review ? "review" : undefined)}
      aria-label={`${review ? "Review" : "Detail"} ${assessment.assessmentCode}`}
    >
      {review ? "Review" : "Detail"}
    </Link>
  );
}

export default async function DinsosAssessmentRegistryPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.q?.trim();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const filters: AssessmentFilters = {
    search: search && search.length <= 100 ? search : undefined,
    type: params.type && params.type.length <= 100 ? params.type : undefined,
    path: ASSESSMENT_PATHS.includes(params.path as AssessmentPath)
      ? (params.path as AssessmentPath)
      : undefined,
    status: ASSESSMENT_STATUSES.includes(params.status as AssessmentRegistryStatus)
      ? (params.status as AssessmentRegistryStatus)
      : undefined,
    page,
  };
  const actor = await requireDinsosActor();
  const [summary, result, options, canReview] = await Promise.all([
    getAssessmentSummary(),
    getAssessments(filters),
    getAssessmentFilterOptions(),
    hasCapability(actor.profileId, "DINSOS_ASSESSMENT_REVIEW"),
  ]);

  const selectedId = params.assessment && UUID.test(params.assessment)
    ? params.assessment
    : null;
  if (params.assessment && !selectedId) redirect(buildHref(filters, page));
  const selected = selectedId ? await getAssessmentById(selectedId) : null;
  if (selectedId && !selected) redirect(buildHref(filters, page));
  if (
    params.mode === "review" &&
    (!selected || !canReview || selected.status !== "PERLU_REVIEW")
  ) {
    redirect(selected ? buildHref(filters, page, selected.assessmentId) : buildHref(filters, page));
  }

  const activeFilters = Boolean(filters.search || filters.type || filters.path || filters.status);
  const start = result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const end = Math.min(result.page * result.pageSize, result.total);

  return (
    <section aria-labelledby="assessment-page-title">
      <header className={styles.pageHeader}>
        <div>
          <h1 id="assessment-page-title">Asesmen Sosial</h1>
          <p>Pencatatan dan pengelolaan hasil observasi lapangan warga terdaftar</p>
        </div>
        <Link href="/dinsos/warga?intent=assessment-new" className={styles.createButton}>
          + Buat Asesmen Baru
        </Link>
      </header>

      <div className={styles.summaryGrid}>
        <article><p>Total Asesmen Tahun Ini</p><strong>{summary.totalThisYear.toLocaleString("id-ID")}</strong></article>
        <article className={styles.reviewSummary}><p>Membutuhkan Review</p><strong>{summary.needsReview.toLocaleString("id-ID")}</strong></article>
        <article className={styles.approvedSummary}><p>Terekonsiliasi ke Jalur MBI</p><strong>{summary.reconciledToPath.toLocaleString("id-ID")}</strong></article>
      </div>

      <section className={styles.registryCard} aria-label="Daftar Asesmen Sosial">
        <form className={styles.filters} method="get">
          <label className={styles.searchField}>
            <span>Cari Asesmen</span>
            <input name="q" type="search" maxLength={100} defaultValue={filters.search} placeholder="Cari NIK, Nama Warga, atau ID Asesmen..." />
          </label>
          <label><span>Jenis Asesmen</span><select name="type" defaultValue={filters.type ?? ""}><option value="">Semua Jenis</option>{options.types.map((type) => <option key={type.code} value={type.code}>{type.listLabel}</option>)}</select></label>
          <label><span>Rekomendasi Jalur</span><select name="path" defaultValue={filters.path ?? ""}><option value="">Semua Jalur</option><option value="PEKERJA">Pekerja</option><option value="WIRAUSAHA">Wirausaha</option><option value="PENGUATAN_DASAR">Penguatan Dasar</option></select></label>
          <label><span>Status</span><select name="status" defaultValue={filters.status ?? ""}><option value="">Semua Status</option>{ASSESSMENT_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
          <button type="submit">Filter</button>
          {activeFilters && <Link href="/dinsos/asesmen">Reset</Link>}
        </form>

        {result.assessments.length ? (
          <>
            <div className={styles.desktopTable}>
              <table>
                <thead><tr><th scope="col">ID Asesmen</th><th scope="col">Tanggal</th><th scope="col">NIK &amp; Nama Warga</th><th scope="col">Jenis Asesmen</th><th scope="col">Rekomendasi Jalur</th><th scope="col">Status</th><th scope="col">Aksi</th></tr></thead>
                <tbody>{result.assessments.map((assessment) => (
                  <tr key={assessment.assessmentId}>
                    <td><strong>{assessment.assessmentCode}</strong></td>
                    <td>{date.format(new Date(`${assessment.assessmentDate}T00:00:00+07:00`))}</td>
                    <td><span>{assessment.namaLengkap}</span><code>{assessment.maskedNik}</code></td>
                    <td>{assessment.assessmentTypeLabel}</td>
                    <td>{(assessment.approvedPath ?? assessment.fieldRecommendation) ? <span className={styles.pathBadge}>{pathLabel(assessment.approvedPath ?? assessment.fieldRecommendation)}</span> : "—"}</td>
                    <td><span className={`${styles.statusBadge} ${styles[assessment.status.toLowerCase()]}`}>{statusLabel(assessment.status)}</span></td>
                    <td><Action assessment={assessment} filters={filters} page={page} canReview={canReview} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className={styles.mobileCards}>
              {result.assessments.map((assessment) => (
                <article key={assessment.assessmentId}>
                  <header><div><strong>{assessment.assessmentCode}</strong><time>{date.format(new Date(`${assessment.assessmentDate}T00:00:00+07:00`))}</time></div><span className={`${styles.statusBadge} ${styles[assessment.status.toLowerCase()]}`}>{statusLabel(assessment.status)}</span></header>
                  <h2>{assessment.namaLengkap}</h2><code>{assessment.maskedNik}</code>
                  <dl><div><dt>Jenis</dt><dd>{assessment.assessmentTypeLabel}</dd></div><div><dt>Rekomendasi</dt><dd>{pathLabel(assessment.approvedPath ?? assessment.fieldRecommendation)}</dd></div></dl>
                  <Action assessment={assessment} filters={filters} page={page} canReview={canReview} />
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className={styles.empty}>{activeFilters ? "Tidak ada asesmen yang sesuai dengan filter." : "Belum ada asesmen sosial."}</p>
        )}

        <nav className={styles.pagination} aria-label="Navigasi halaman Asesmen Sosial">
          <p>Menampilkan {start}–{end} dari {result.total.toLocaleString("id-ID")} asesmen</p>
          <div>
            {result.page > 1 ? <Link href={buildHref(filters, result.page - 1)} aria-label="Halaman sebelumnya">‹</Link> : <span aria-hidden="true">‹</span>}
            <strong aria-current="page">{result.page}</strong>
            <span>dari {result.totalPages}</span>
            {result.page < result.totalPages ? <Link href={buildHref(filters, result.page + 1)} aria-label="Halaman berikutnya">›</Link> : <span aria-hidden="true">›</span>}
          </div>
        </nav>
      </section>

      {selected && params.mode !== "review" && (
        <AssessmentDetailDrawer
          assessment={selected}
          closeHref={buildHref(filters, page)}
          reviewHref={selected.status === "PERLU_REVIEW" && canReview ? buildHref(filters, page, selected.assessmentId, "review") : undefined}
          reassessmentHref={selected.status === "MINTA_REASESMEN" ? `/dinsos/warga?warga=${selected.wargaId}&mode=assessment-new&reassessmentOf=${selected.assessmentId}` : undefined}
        />
      )}
      {selected && params.mode === "review" && (
        <AssessmentReviewDrawer
          assessment={selected}
          closeHref={buildHref(filters, page)}
          detailHref={buildHref(filters, page, selected.assessmentId)}
          opds={options.opds.map((opd) => ({
            id: opd.id,
            name: opd.name,
            allowedPaths: opd.allowedPaths,
          }))}
        />
      )}
    </section>
  );
}
