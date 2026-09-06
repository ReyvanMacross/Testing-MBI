import Link from "next/link";
import { redirect } from "next/navigation";

import { EditWargaDialog } from "@/components/dinsos/edit-warga-dialog";
import { WargaProfileDrawer } from "@/components/dinsos/warga-profile-drawer";
import { hasCapability } from "@/lib/auth/require-capability";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import {
  getDinsosWarga,
  getDinsosWargaOptions,
  getDinsosWargaProfile,
  getDinsosWargaSummary,
  type WargaRegistryFilters,
  type WargaRegistryItem,
} from "@/lib/dinsos/warga";

import styles from "./warga-page.module.css";

type Props = {
  searchParams: Promise<{
    q?: string;
    kelurahan?: string;
    desil?: string;
    status?: string;
    page?: string;
    warga?: string;
    mode?: string;
  }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function verificationLabel(value: string | null) {
  if (value === "VERIFIED") return "TERVERIFIKASI";
  if (value === "REJECTED") return "DITOLAK";
  return "BELUM";
}

function verificationClass(value: string | null) {
  if (value === "VERIFIED") return styles.verified;
  if (value === "REJECTED") return styles.rejected;
  return styles.pending;
}

function buildHref(
  filters: WargaRegistryFilters,
  page: number,
  wargaId?: string,
  mode?: "edit",
) {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.kelurahanId) params.set("kelurahan", filters.kelurahanId);
  if (filters.desil) params.set("desil", String(filters.desil));
  if (filters.verificationStatus) params.set("status", filters.verificationStatus);
  if (page > 1) params.set("page", String(page));
  if (wargaId) params.set("warga", wargaId);
  if (mode) params.set("mode", mode);
  const query = params.toString();
  return query ? `/dinsos/warga?${query}` : "/dinsos/warga";
}

function pathLabel(value: string | null) {
  return value?.replaceAll("_", " ") ?? "—";
}

function WargaDesktopTable({
  items,
  filters,
  page,
}: {
  items: WargaRegistryItem[];
  filters: WargaRegistryFilters;
  page: number;
}) {
  return (
    <div className={styles.desktopTable}>
      <table>
        <thead><tr><th scope="col">NIK</th><th scope="col">Nama Lengkap</th><th scope="col">Kelurahan</th><th scope="col">Desil</th><th scope="col">Status Verifikasi</th><th scope="col">Jalur Aktif</th><th scope="col">Aksi</th></tr></thead>
        <tbody>{items.map((item) => (
          <tr key={item.wargaId}>
            <td><code>{item.maskedNik}</code></td>
            <td><strong>{item.namaLengkap}</strong></td>
            <td>{item.kelurahan ?? "—"}{!item.locationResolved && <span className={styles.unresolved} title="Belum terhubung master wilayah" aria-label="Wilayah belum terverifikasi">!</span>}</td>
            <td>{item.desil ?? "—"}</td>
            <td><span className={`${styles.statusBadge} ${verificationClass(item.verificationStatus)}`}>{verificationLabel(item.verificationStatus)}</span></td>
            <td>{item.activePath ? <span className={styles.pathBadge}>{pathLabel(item.activePath)}</span> : "—"}</td>
            <td><Link className={styles.detailButton} href={buildHref(filters, page, item.wargaId)}>◉ Detail</Link></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default async function DinsosWargaPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.q?.trim();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const desilValue = Number.parseInt(params.desil ?? "", 10);
  const filters: WargaRegistryFilters = {
    search: search && search.length <= 100 ? search : undefined,
    kelurahanId: params.kelurahan && UUID.test(params.kelurahan) ? params.kelurahan : undefined,
    desil: desilValue >= 1 && desilValue <= 10 ? desilValue : undefined,
    verificationStatus: ["TERVERIFIKASI", "BELUM"].includes(params.status ?? "")
      ? params.status as WargaRegistryFilters["verificationStatus"]
      : undefined,
    page,
  };
  const actor = await requireDinsosActor();
  const [summary, result, options, canEdit] = await Promise.all([
    getDinsosWargaSummary(),
    getDinsosWarga(filters),
    getDinsosWargaOptions(),
    hasCapability(actor.profileId, "DINSOS_WARGA_EDIT"),
  ]);

  const selectedId = params.warga && UUID.test(params.warga) ? params.warga : null;
  if (params.warga && !selectedId) redirect(buildHref(filters, page));
  const profile = selectedId ? await getDinsosWargaProfile(selectedId) : null;
  if (selectedId && !profile) redirect(buildHref(filters, page));
  if (params.mode === "edit" && (!profile || !canEdit)) {
    redirect(profile ? buildHref(filters, page, profile.wargaId) : buildHref(filters, page));
  }

  const activeFilters = Boolean(filters.search || filters.kelurahanId || filters.desil || filters.verificationStatus);
  const start = result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const end = Math.min(result.page * result.pageSize, result.total);

  return (
    <section aria-labelledby="warga-page-title">
      <header className={styles.pageHeader}>
        <div><h1 id="warga-page-title">Data Warga</h1><p>Basis data seluruh warga terdaftar dalam sistem MBI</p></div>
        <button type="button" className={styles.createButton} disabled title="Desain formulir pendaftaran warga belum tersedia">+ Daftarkan Warga Baru</button>
      </header>

      <div className={styles.summaryGrid}>
        <article><p>Total Warga Terdaftar</p><strong>{summary.total.toLocaleString("id-ID")}</strong></article>
        <article className={styles.summaryVerified}><p>Sudah Diverifikasi</p><strong>{summary.verified.toLocaleString("id-ID")}</strong></article>
        <article className={styles.summaryPending}><p>Belum Diverifikasi</p><strong>{summary.unverified.toLocaleString("id-ID")}</strong></article>
      </div>

      {options.unresolvedWarga > 0 && (
        <p className={styles.dataWarning} role="status">
          {options.unresolvedWarga.toLocaleString("id-ID")} warga belum terhubung ke master wilayah. Nama legacy tetap ditampilkan dan filter kelurahan resmi hanya mencakup data resolved.
        </p>
      )}

      <section className={styles.registryCard} aria-label="Daftar Data Warga">
        <form className={styles.filters} method="get">
          <label><span>Cari Warga</span><input name="q" type="search" defaultValue={filters.search} maxLength={100} placeholder="NIK atau Nama..." /></label>
          <label><span>Kelurahan</span><select name="kelurahan" defaultValue={filters.kelurahanId ?? ""}><option value="">Semua Kelurahan</option>{Array.from(new Set(options.kelurahan.map((item) => item.kecamatan))).map((kecamatan) => <optgroup key={kecamatan} label={kecamatan}>{options.kelurahan.filter((item) => item.kecamatan === kecamatan).map((item) => <option key={item.id} value={item.id}>{item.nama}</option>)}</optgroup>)}</select></label>
          <label><span>Desil</span><select name="desil" defaultValue={filters.desil ?? ""}><option value="">Semua</option>{Array.from({ length: 10 }, (_, index) => index + 1).map((item) => <option key={item} value={item}>Desil {item}</option>)}</select></label>
          <label><span>Status Verifikasi</span><select name="status" defaultValue={filters.verificationStatus ?? ""}><option value="">Semua Status</option><option value="TERVERIFIKASI">Terverifikasi</option><option value="BELUM">Belum Terverifikasi</option></select></label>
          <button type="submit" className={styles.filterButton}>☷ Filter</button>
          {activeFilters && <Link href="/dinsos/warga" className={styles.resetButton}>Reset</Link>}
        </form>

        {result.warga.length ? (
          <>
            <WargaDesktopTable items={result.warga} filters={filters} page={page} />
            <div className={styles.mobileCards}>{result.warga.map((item) => (
              <article key={item.wargaId}>
                <header><div><h2>{item.namaLengkap}</h2><code>{item.maskedNik}</code></div><span className={`${styles.statusBadge} ${verificationClass(item.verificationStatus)}`}>{verificationLabel(item.verificationStatus)}</span></header>
                <dl><div><dt>Kelurahan</dt><dd>{item.kelurahan ?? "—"}{!item.locationResolved ? " · belum resolved" : ""}</dd></div><div><dt>Desil</dt><dd>{item.desil ?? "—"}</dd></div><div><dt>Jalur</dt><dd>{pathLabel(item.activePath)}</dd></div></dl>
                <Link className={styles.detailButton} href={buildHref(filters, page, item.wargaId)}>Detail</Link>
              </article>
            ))}</div>
          </>
        ) : <p className={styles.empty}>{activeFilters ? "Tidak ada warga yang sesuai dengan filter." : "Belum ada data warga."}</p>}

        <nav className={styles.pagination} aria-label="Navigasi halaman Data Warga">
          <p>Menampilkan {start}–{end} dari {result.total.toLocaleString("id-ID")} data</p>
          <div>
            {result.page > 1 ? <Link href={buildHref(filters, result.page - 1)} aria-label="Halaman sebelumnya">‹</Link> : <span aria-hidden="true">‹</span>}
            <strong aria-current="page">{result.page}</strong>
            <span>dari {result.totalPages}</span>
            {result.page < result.totalPages ? <Link href={buildHref(filters, result.page + 1)} aria-label="Halaman berikutnya">›</Link> : <span aria-hidden="true">›</span>}
          </div>
        </nav>
      </section>

      {profile && params.mode !== "edit" && <WargaProfileDrawer profile={profile} closeHref={buildHref(filters, page)} editHref={buildHref(filters, page, profile.wargaId, "edit")} canEdit={canEdit} />}
      {profile && params.mode === "edit" && <EditWargaDialog profile={profile} closeHref={buildHref(filters, page, profile.wargaId)} kelurahanOptions={options.kelurahan} maritalStatuses={options.maritalStatuses} />}
    </section>
  );
}
