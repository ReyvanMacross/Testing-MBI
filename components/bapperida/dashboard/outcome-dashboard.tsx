import { ArrowUpRight, RotateCcw, UsersRound } from "lucide-react";

import { PenjelajahPetaDesil } from "@/components/diskominfo/peta-desil/penjelajah-peta-desil";
import { PrintButton } from "@/components/bapperida/shared/print-button";
import type { BapperidaDashboardData } from "@/lib/bapperida/data";

import styles from "../bapperida.module.css";

export async function OutcomeDashboard({ data, kecamatan, kelurahan }: { data: BapperidaDashboardData; kecamatan?: string; kelurahan?: string }) {
  return <div className={styles.page}>
    <header className={styles.pageHeader}>
      <div><h1>Dashboard Outcome</h1><p>Ringkasan Eksekutif Capaian Program Kemandirian</p></div>
      <div className={styles.actions}>
        <form><select name="year" defaultValue={String(data.year)} aria-label="Pilih tahun"><option value={data.year}>Tahun Ini</option><option value={data.year - 1}>{data.year - 1}</option></select><button className={styles.srOnly} type="submit">Terapkan</button></form>
        <PrintButton />
      </div>
    </header>
    <section className={styles.kpiGrid} aria-label="Ringkasan outcome">
      <Kpi title="Total Warga Mandiri" value={data.headline.independentCitizens.toLocaleString("id-ID")} icon={<UsersRound />} tone="blue" />
      <Kpi title="Tingkat Keberhasilan Program" value={`${data.headline.successRate}%`} icon={<ArrowUpRight />} tone="blue" />
      <Kpi title="Warga Re-entry (Gagal Mandiri)" value={data.headline.reentryCitizens.toLocaleString("id-ID")} icon={<RotateCcw />} tone="red" />
      <Kpi title="Indeks Kesejahteraan Kota" value={data.headline.welfareIndex.toFixed(1)} suffix="/ 100" progress={data.headline.welfareIndex} tone="yellow" />
    </section>
    <section className={styles.analyticsGrid}>
      <article className={styles.chartCard}><h2>Tren Kemandirian Warga (12 Bulan Terakhir)</h2><TrendChart points={data.trend} /></article>
      <article className={styles.pathCard}><h2>Capaian per Jalur Intervensi</h2>{data.paths.map((path, index) => <div className={styles.pathRow} key={path.key}><span>{path.label}<strong>{path.percentage}%</strong></span><div><i style={{ width: `${Math.min(path.percentage, 100)}%`, background: ["#0b4d9c", "#d8a722", "#3f8254", "#7b8290"][index] }} /></div></div>)}</article>
    </section>
    <section className={styles.mapSection}>
      <div className={styles.mapHeading}><div><h2>Peta Sebaran Kesejahteraan</h2><p>Distribusi level kecamatan dan kelurahan dari sumber Diskominfo</p></div>{kecamatan && <a href="/bapperida">Kembali ke Kota Bandung</a>}</div>
      <PenjelajahPetaDesil
        kecamatanDiminta={kecamatan}
        kelurahanDiminta={kelurahan}
        basePath="/bapperida"
        citySidePanel={<DesilPanel items={data.desils} />}
      />
    </section>
  </div>;
}

function DesilPanel({ items }: { items: BapperidaDashboardData["desils"] }) {
  return <aside className={styles.desilPanel}><h3>Persentase Desil (Kota Bandung)</h3><p>Klik area peta untuk rincian per kecamatan.</p>{items.map((item) => <div className={styles.desilRow} key={item.label}><span>{item.label}<strong>{item.percentage}%</strong></span><div><i style={{ width: `${item.percentage}%`, background: item.color }} /></div></div>)}</aside>;
}

function Kpi({ title, value, suffix, icon, tone, progress }: { title: string; value: string; suffix?: string; icon?: React.ReactNode; tone: string; progress?: number }) {
  return <article className={styles.kpi}><div className={`${styles.kpiIcon} ${styles[tone]}`}>{icon ?? <span>▥</span>}</div><div><span>{title}</span><strong>{value} {suffix && <small>{suffix}</small>}</strong>{progress !== undefined && <div className={styles.indexBar}><i style={{ width: `${progress}%` }} /></div>}</div></article>;
}

function TrendChart({ points }: { points: Array<{ month: string; value: number }> }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const min = Math.min(...points.map((point) => point.value), 0);
  const range = Math.max(max - min, 1);
  const plotted = points.map((point, index) => ({ ...point, x: 36 + index * (528 / Math.max(points.length - 1, 1)), y: 170 - ((point.value - min) / range) * 125 }));
  const path = plotted.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  return <svg className={styles.trendChart} viewBox="0 0 600 215" role="img" aria-label="Grafik tren kemandirian warga">
    {[45,85,125,165].map((y) => <line key={y} x1="28" x2="578" y1={y} y2={y} stroke="#e5e7eb" />)}
    <path d={`${path} L${plotted.at(-1)?.x ?? 0},180 L${plotted[0]?.x ?? 0},180 Z`} fill="#dce9f8" />
    <path d={path} fill="none" stroke="#1558ad" strokeWidth="2.5" />
    {plotted.map((point) => <g key={point.month}><circle cx={point.x} cy={point.y} r="4" fill="#1558ad" stroke="white" strokeWidth="2" /><text x={point.x} y="203" textAnchor="middle" fontSize="11" fill="#6b7280">{point.month}</text><title>{point.month}: {point.value.toLocaleString("id-ID")}</title></g>)}
  </svg>;
}
