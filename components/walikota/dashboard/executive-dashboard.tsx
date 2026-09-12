import { Building2, CheckCircle2, ClipboardClock, UsersRound } from "lucide-react";

import { PenjelajahPetaDesil } from "@/components/diskominfo/peta-desil/penjelajah-peta-desil";
import type { WalikotaDashboardData } from "@/lib/walikota/data";

import styles from "../walikota.module.css";

export async function ExecutiveDashboard({ data, kecamatan, kelurahan }: { data: WalikotaDashboardData; kecamatan?: string; kelurahan?: string }) {
  return <div className={styles.page}>
    <header className={styles.pageHeader}>
      <div><span className={styles.eyebrow}>RINGKASAN KOTA</span><h1>Dashboard Eksekutif</h1><p>Capaian lintas perangkat daerah, wilayah prioritas, dan keputusan strategis MBI</p></div>
      <div className={styles.actions}><form><select name="year" defaultValue={String(data.year)} aria-label="Pilih tahun"><option value={data.year}>Tahun {data.year}</option><option value={data.year - 1}>{data.year - 1}</option></select><button className={styles.srOnly} type="submit">Terapkan</button></form></div>
    </header>
    <section className={styles.kpiGrid} aria-label="Ringkasan eksekutif">
      <Kpi title="Warga Mandiri" value={data.headline.independentCitizens.toLocaleString("id-ID")} detail={`${data.headline.successRate}% tingkat keberhasilan`} icon={<UsersRound />} tone="blue" />
      <Kpi title="Outcome Selesai" value={data.completedOutcomes.toLocaleString("id-ID")} detail="Realisasi lintas OPD" icon={<CheckCircle2 />} tone="green" />
      <Kpi title="OPD Aktif" value={String(data.activeOpds)} detail="Terhubung ke MBI" icon={<Building2 />} tone="yellow" />
      <Kpi title="Menunggu Keputusan" value={String(data.pendingRecommendations)} detail="Rekomendasi Bapperida" icon={<ClipboardClock />} tone="red" />
    </section>
    <section className={styles.analyticsGrid}>
      <article className={styles.chartCard}><div className={styles.cardHeading}><div><span>OUTCOME KOTA</span><h2>Tren Kemandirian Warga</h2></div><strong>{data.headline.welfareIndex.toFixed(1)}<small>/100 indeks</small></strong></div><TrendChart points={data.trend} /></article>
      <article className={styles.pathCard}><h2>Capaian Jalur Intervensi</h2>{data.paths.map((path, index) => <div className={styles.pathRow} key={path.key}><span>{path.label}<strong>{path.percentage}%</strong></span><div><i style={{ width: `${Math.min(path.percentage, 100)}%`, background: ["#0b4d9c", "#d8a722", "#3f8254", "#7b8290"][index] }} /></div></div>)}</article>
    </section>
    <section className={styles.executiveGrid}>
      <article className={styles.tableCard}><div className={styles.sectionHeading}><div><span>KINERJA PERANGKAT DAERAH</span><h2>Outcome per OPD</h2></div><a href="/walikota/rekomendasi">Lihat rekomendasi</a></div><div className={styles.opdRows}>{data.opdOutcomes.slice(0, 8).map((opd) => <div className={styles.opdRow} key={opd.code}><div><strong>{opd.code}</strong><span>{opd.name}</span></div><span>{opd.completed}/{opd.total} selesai</span><div><i style={{ width: `${opd.completionRate}%` }} /></div><b>{opd.completionRate}%</b></div>)}</div></article>
      <article className={styles.priorityCard}><div className={styles.sectionHeading}><div><span>FOKUS WILAYAH</span><h2>Kecamatan Prioritas</h2></div></div>{data.priorityRegions.map((region, index) => <div className={styles.priorityRow} key={region.name}><span>{index + 1}</span><div><strong>{region.name}</strong><small>{region.vulnerable} warga desil 1–2</small></div><b>{region.active} aktif</b></div>)}</article>
    </section>
    <section className={styles.mapSection}>
      <div className={styles.mapHeading}><div><span className={styles.eyebrow}>SEBARAN KESEJAHTERAAN</span><h2>Peta Wilayah Prioritas</h2><p>Geometri dan data wilayah memakai sumber bersama Diskominfo.</p></div>{kecamatan && <a href="/walikota">Kembali ke Kota Bandung</a>}</div>
      <PenjelajahPetaDesil kecamatanDiminta={kecamatan} kelurahanDiminta={kelurahan} basePath="/walikota" citySidePanel={<DesilPanel items={data.desils} />} />
    </section>
  </div>;
}

function Kpi({ title, value, detail, icon, tone }: { title: string; value: string; detail: string; icon: React.ReactNode; tone: string }) { return <article className={styles.kpi}><div className={`${styles.kpiIcon} ${styles[tone]}`}>{icon}</div><div><span>{title}</span><strong>{value}</strong><small>{detail}</small></div></article>; }
function DesilPanel({ items }: { items: WalikotaDashboardData["desils"] }) { return <aside className={styles.desilPanel}><h3>Komposisi Desil Kota</h3><p>Pilih kecamatan pada peta untuk membuka rincian.</p>{items.map((item) => <div className={styles.desilRow} key={item.label}><span>{item.label}<strong>{item.percentage}%</strong></span><div><i style={{ width: `${item.percentage}%`, background: item.color }} /></div></div>)}</aside>; }
function TrendChart({ points }: { points: Array<{ month: string; value: number }> }) { const max=Math.max(...points.map((point)=>point.value),1); const min=Math.min(...points.map((point)=>point.value),0); const range=Math.max(max-min,1); const plotted=points.map((point,index)=>({...point,x:36+index*(528/Math.max(points.length-1,1)),y:170-((point.value-min)/range)*125})); const path=plotted.map((point,index)=>`${index?"L":"M"}${point.x},${point.y}`).join(" "); return <svg className={styles.trendChart} viewBox="0 0 600 215" role="img" aria-label="Grafik tren kemandirian warga">{[45,85,125,165].map((y)=><line key={y} x1="28" x2="578" y1={y} y2={y} stroke="#e5e7eb"/>)}<path d={`${path} L${plotted.at(-1)?.x??0},180 L${plotted[0]?.x??0},180 Z`} fill="#dce9f8"/><path d={path} fill="none" stroke="#1558ad" strokeWidth="2.5"/>{plotted.map((point)=><g key={point.month}><circle cx={point.x} cy={point.y} r="4" fill="#1558ad" stroke="white" strokeWidth="2"/><text x={point.x} y="203" textAnchor="middle" fontSize="11" fill="#6b7280">{point.month}</text><title>{point.month}: {point.value.toLocaleString("id-ID")}</title></g>)}</svg>; }
