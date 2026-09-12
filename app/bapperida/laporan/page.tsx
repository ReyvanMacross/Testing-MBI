import { EvaluationReports } from "@/components/bapperida/report/evaluation-reports";
import { getBapperidaReports } from "@/lib/bapperida/data";
import styles from "@/components/bapperida/bapperida.module.css";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string; path?: string }> }) {
  const params = await searchParams;
  const year = Number(params.year);
  const reports = await getBapperidaReports(Number.isInteger(year) ? year : undefined, params.path);
  const currentYear = new Date().getFullYear();
  return <div className={styles.page}>
    <header className={styles.pageHeader}><div><h1>Laporan Evaluasi</h1><p>Riwayat laporan evaluasi bulanan program kemandirian Kota Bandung</p></div><div className={styles.filterBar}><form><select name="year" defaultValue={params.year ?? ""}><option value="">Semua Tahun</option><option value={currentYear}>{currentYear}</option><option value={currentYear - 1}>{currentYear - 1}</option></select><select name="path" defaultValue={params.path ?? "SEMUA"}><option value="SEMUA">Semua Jalur</option><option value="PEKERJA">Jalur Pekerja</option><option value="WIRAUSAHA">Jalur Wirausaha</option><option value="PENGUATAN_DASAR">Penguatan Dasar</option><option value="AKSELERASI_SEKTORAL">Akselerasi Sektoral</option></select><button type="submit">Terapkan</button></form></div></header>
    <EvaluationReports reports={reports} />
  </div>;
}
