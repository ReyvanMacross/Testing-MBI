import Link from "next/link";

import { PenjelajahPetaDesil } from "@/components/diskominfo/peta-desil/penjelajah-peta-desil";

import styles from "./peta.module.css";

type PetaPageProps = {
  searchParams: Promise<{
    kecamatan?: string;
    Kecamatan?: string;
    kelurahan?: string;
  }>;
};

export default async function PetaPage({ searchParams }: PetaPageProps) {
  const params = await searchParams;
  const requestedDistrict = params.kecamatan ?? params.Kecamatan;

  return (
    <section className={styles.page} aria-labelledby="map-page-heading">
      <header className={styles.pageHeader}>
        <h1 id="map-page-heading">Peta Sebaran Desil</h1>
        <p>Visualisasi distribusi desil kesejahteraan sosial.</p>
      </header>

      <nav className={styles.tabs} aria-label="Bagian dashboard">
        <Link className={styles.tab} href="/diskominfo">
          Ringkasan
        </Link>
        <Link
          className={`${styles.tab} ${styles.tabActive}`}
          href="/diskominfo/peta"
          aria-current="page"
        >
          Peta Sebaran Desil
        </Link>
      </nav>

      <PenjelajahPetaDesil
        kecamatanDiminta={requestedDistrict}
        kelurahanDiminta={params.kelurahan}
      />
    </section>
  );
}
