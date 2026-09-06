import Link from "next/link";

import type {
  OpdOption,
  UserFilters,
  WilayahOption,
} from "@/lib/diskominfo/users";

import styles from "./users.module.css";

type UserFiltersProps = {
  filters: UserFilters;
  opdOptions: OpdOption[];
  wilayahOptions: WilayahOption[];
};

export function UserFiltersForm({
  filters,
  opdOptions,
  wilayahOptions,
}: UserFiltersProps) {
  const kecamatan = wilayahOptions.filter(
    (option) => option.jenis === "KECAMATAN",
  );
  const kelurahan = wilayahOptions.filter(
    (option) => option.jenis === "KELURAHAN",
  );

  return (
    <form className={styles.filters} method="get">
      <label className={styles.searchField}>
        <span className={styles.srOnly}>Cari pengguna</span>
        <input
          defaultValue={filters.search ?? ""}
          name="q"
          placeholder="Cari nama pengguna..."
          type="search"
        />
      </label>

      <label>
        <span className={styles.srOnly}>Filter instansi</span>
        <select defaultValue={filters.opdId ?? ""} name="opd">
          <option value="">Semua Instansi</option>
          {opdOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.nama}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className={styles.srOnly}>Filter wilayah</span>
        <select defaultValue={filters.wilayahId ?? ""} name="wilayah">
          <option value="">Semua Wilayah</option>
          <optgroup label="Kecamatan">
            {kecamatan.map((option) => (
              <option key={option.id} value={option.id}>
                {option.nama}
              </option>
            ))}
          </optgroup>
          <optgroup label="Kelurahan">
            {kelurahan.map((option) => (
              <option key={option.id} value={option.id}>
                {option.nama}
                {option.parentNama ? ` — ${option.parentNama}` : ""}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <input name="page" type="hidden" value="1" />

      <div className={styles.filterActions}>
        <button className={styles.filterButton} type="submit">
          Terapkan
        </button>
        <Link className={styles.resetButton} href="/diskominfo/pengguna">
          Reset
        </Link>
      </div>
    </form>
  );
}
