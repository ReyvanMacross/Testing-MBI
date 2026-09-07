import {
  DESIL_COLORS,
  type DesilLevel,
} from "@/lib/diskominfo/desil-colors";

import styles from "./legenda-desil.module.css";

type PropertiLegendaDesil = {
  tampilan?: "panel" | "ringkas";
};

const ITEM_LEGENDA: ReadonlyArray<{
  label: string;
  desil?: DesilLevel;
}> = [
  { label: "D5+", desil: 5 },
  { label: "D4", desil: 4 },
  { label: "D3", desil: 3 },
  { label: "D2", desil: 2 },
  { label: "D1", desil: 1 },
  { label: "Belum ada sumber" },
];

export function LegendaDesil({
  tampilan = "panel",
}: PropertiLegendaDesil) {
  return (
    <div
      className={`${styles.legenda} ${
        tampilan === "ringkas" ? styles.ringkas : styles.panel
      }`}
      aria-label="Legenda desil dominan"
    >
      {tampilan === "panel" && (
        <p className={styles.judul}>Legenda (Desil Dominan)</p>
      )}
      <ul className={styles.daftar}>
        {ITEM_LEGENDA.map((item) => (
          <li key={item.label}>
            <span
              className={`${styles.warna} ${
                item.desil ? "" : styles.tanpaData
              }`}
              style={
                item.desil
                  ? { backgroundColor: DESIL_COLORS[item.desil] }
                  : undefined
              }
              aria-hidden="true"
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
