"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import styles from "./sync-activity-chart.module.css";

type SyncActivityItem = {
  date: string;
  label: string;
  records: number;
};

type SyncActivityChartProps = {
  data: SyncActivityItem[];
};

const numberFormatter = new Intl.NumberFormat("id-ID");

export function SyncActivityChart({ data }: SyncActivityChartProps) {
  const hasActivity = data.some((item) => item.records > 0);

  return (
    <section className={styles.card} aria-labelledby="sync-activity-title">
      <div className={styles.cardHeader}>
        <h2 id="sync-activity-title" className={styles.title}>
          Aktivitas Sinkronisasi Data 7 Hari Terakhir
        </h2>

        <button
          type="button"
          className={styles.moreButton}
          aria-label="Opsi lainnya"
        >
          •••
        </button>
      </div>

      <div className={styles.chartArea}>
        {hasActivity ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              accessibilityLayer
            >
              <CartesianGrid
                stroke="#E5E7EB"
                strokeDasharray="0"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#666666", fontSize: 12 }}
                tickMargin={12}
              />
              <YAxis
                axisLine={false}
                domain={[0, 8000]}
                tickLine={false}
                ticks={[0, 2000, 4000, 6000, 8000]}
                tick={{ fill: "#666666", fontSize: 12 }}
                tickFormatter={(value: number) => numberFormatter.format(value)}
                width={52}
              />
              <Tooltip
                cursor={{ stroke: "#C9D5E8", strokeDasharray: "4 4" }}
                formatter={(value) => [
                  `${numberFormatter.format(Number(value))} record`,
                  "Diproses",
                ]}
                labelFormatter={(label) => String(label)}
                contentStyle={{
                  border: "1px solid #E1E5EA",
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(24, 39, 75, 0.10)",
                  color: "#171717",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="records"
                name="Diproses"
                stroke="#1D5BBF"
                strokeWidth={2.5}
                fill="#1D5BBF"
                fillOpacity={0.2}
                dot={{
                  r: 4,
                  fill: "#FFFFFF",
                  stroke: "#1D5BBF",
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 5,
                  fill: "#1D5BBF",
                  stroke: "#FFFFFF",
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>
              Belum ada aktivitas sinkronisasi dalam 7 hari terakhir.
            </p>
            <p className={styles.emptyDescription}>
              Data akan muncul setelah proses sinkronisasi tercatat pada
              integrasi_api_log.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
