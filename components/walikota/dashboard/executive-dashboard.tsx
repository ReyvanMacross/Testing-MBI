import { BarChart3, MoreHorizontal, RotateCcw, TrendingUp, UsersRound } from "lucide-react";

import { PenjelajahPetaDesil } from "@/components/diskominfo/peta-desil/penjelajah-peta-desil";
import type { WalikotaDashboardData } from "@/lib/walikota/data";

import styles from "../walikota.module.css";
import { ExecutiveControls } from "./executive-controls";

export async function ExecutiveDashboard({
  data,
  kecamatan,
  kelurahan,
}: {
  data: WalikotaDashboardData;
  kecamatan?: string;
  kelurahan?: string;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Dashboard Outcome</h1>
          <p>Ringkasan Eksekutif Capaian Program Kemandirian</p>
        </div>
        <ExecutiveControls year={data.year} />
      </header>

      <section className={styles.kpiGrid} aria-label="Ringkasan outcome kota">
        <Kpi title="Total Warga Mandiri" value={data.headline.independentCitizens.toLocaleString("id-ID")} icon={<UsersRound />} tone="blue" />
        <Kpi title="Tingkat Keberhasilan Program" value={`${data.headline.successRate}%`} icon={<TrendingUp />} tone="blue" />
        <Kpi title="Warga Re-entry (Gagal Mandiri)" value={data.headline.reentryCitizens.toLocaleString("id-ID")} icon={<RotateCcw />} tone="red" />
        <Kpi title="Indeks Kesejahteraan Kota" value={data.headline.welfareIndex.toFixed(1)} suffix="/ 100" progress={data.headline.welfareIndex} icon={<BarChart3 />} tone="yellow" />
      </section>

      <section className={styles.analyticsGrid}>
        <article className={styles.chartCard}>
          <div className={styles.cardHeading}><h2>Tren Kemandirian Warga (12 Bulan Terakhir)</h2><MoreHorizontal aria-hidden="true" /></div>
          <TrendChart points={data.trend} />
        </article>
        <article className={styles.pathCard}>
          <div className={styles.cardHeading}><h2>Capaian per Jalur Intervensi</h2><MoreHorizontal aria-hidden="true" /></div>
          {data.paths.map((path, index) => (
            <div className={styles.pathRow} key={path.key}>
              <span>{path.label}<strong>{path.percentage}%</strong></span>
              <div><i style={{ width: `${Math.min(path.percentage, 100)}%`, background: ["#0b4d9c", "#d8a722", "#3f8254", "#7b8290"][index] }} /></div>
            </div>
          ))}
        </article>
      </section>

      <section className={styles.mapSection} aria-label="Sebaran kesejahteraan Kota Bandung">
        <PenjelajahPetaDesil kecamatanDiminta={kecamatan} kelurahanDiminta={kelurahan} basePath="/walikota" citySidePanel={<DesilPanel items={data.desils} />} />
      </section>
    </div>
  );
}

function Kpi({ title, value, suffix, progress, icon, tone }: { title: string; value: string; suffix?: string; progress?: number; icon: React.ReactNode; tone: string }) {
  return (
    <article className={styles.kpi}>
      <div>
        <span>{title}</span>
        <p><strong>{value}</strong>{suffix && <small>{suffix}</small>}</p>
        {progress != null && <div className={styles.indexBar}><i style={{ width: `${Math.min(progress, 100)}%` }} /></div>}
      </div>
      <div className={`${styles.kpiIcon} ${styles[tone]}`}>{icon}</div>
    </article>
  );
}

function DesilPanel({ items }: { items: WalikotaDashboardData["desils"] }) {
  return (
    <aside className={styles.desilPanel}>
      <h3>Persentase Desil (Kota Bandung)</h3>
      <p>ⓘ Klik area map untuk rincian per kecamatan.</p>
      {items.map((item) => (
        <div className={styles.desilRow} key={item.label}>
          <span>{item.label}<strong>{item.percentage}%</strong></span>
          <div><i style={{ width: `${item.percentage}%`, background: item.color }} /></div>
        </div>
      ))}
    </aside>
  );
}

function TrendChart({ points }: { points: Array<{ month: string; value: number }> }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const ceiling = Math.max(500, Math.ceil(max / 500) * 500);
  const chart = { left: 54, right: 630, top: 22, bottom: 192 };
  const plotted = points.map((point, index) => ({
    ...point,
    x: chart.left + index * ((chart.right - chart.left) / Math.max(points.length - 1, 1)),
    y: chart.bottom - (point.value / ceiling) * (chart.bottom - chart.top),
  }));
  const path = plotted.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const ticks = [ceiling, ceiling * 0.75, ceiling * 0.5, ceiling * 0.25, 0];

  return (
    <svg className={styles.trendChart} viewBox="0 0 660 230" role="img" aria-label="Grafik tren kemandirian warga">
      {ticks.map((value, index) => {
        const y = chart.top + index * ((chart.bottom - chart.top) / 4);
        return <g key={value}><line x1={chart.left} x2={chart.right} y1={y} y2={y} stroke="#e4e7eb" /><text x="43" y={y + 4} textAnchor="end" fontSize="11" fill="#7b8493">{value.toLocaleString("id-ID")}</text></g>;
      })}
      <path d={`${path} L${plotted.at(-1)?.x ?? chart.right},${chart.bottom} L${plotted[0]?.x ?? chart.left},${chart.bottom} Z`} fill="#dce9f8" fillOpacity=".78" />
      <path d={path} fill="none" stroke="#1558ad" strokeWidth="2.5" />
      {plotted.map((point) => <g key={point.month}><circle cx={point.x} cy={point.y} r="4.5" fill="#1558ad" stroke="white" strokeWidth="2" /><text x={point.x} y="218" textAnchor="middle" fontSize="11" fill="#6b7280">{point.month}</text><title>{point.month}: {point.value.toLocaleString("id-ID")}</title></g>)}
    </svg>
  );
}
