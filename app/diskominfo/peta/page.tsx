import Link from "next/link";
import { redirect } from "next/navigation";

import { BandungDistrictMap } from "@/components/diskominfo/desil-map/bandung-district-map";
import { BandungSubdistrictMap } from "@/components/diskominfo/desil-map/bandung-subdistrict-map";
import { CityDistributionPanel } from "@/components/diskominfo/desil-map/city-distribution-panel";
import { SubdistrictDataPanel } from "@/components/diskominfo/desil-map/subdistrict-data-panel";
import {
  getCityDesilDistribution,
  getDistrictDesilDistribution,
  getDistrictDrilldown,
} from "@/lib/diskominfo/desil-map";

import styles from "./peta.module.css";

type PetaPageProps = {
  searchParams: Promise<{
    kecamatan?: string;
    Kecamatan?: string;
  }>;
};

export default async function PetaPage({ searchParams }: PetaPageProps) {
  const params = await searchParams;
  const requestedDistrict = params.kecamatan ?? params.Kecamatan;
  const drilldown = requestedDistrict
    ? await getDistrictDrilldown(requestedDistrict)
    : null;

  if (requestedDistrict && !drilldown) {
    redirect("/diskominfo/peta");
  }

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

      {drilldown ? (
        <section className={styles.drilldownCard}>
          <div className={styles.drilldownHeader}>
            <nav className={styles.breadcrumb} aria-label="Lokasi peta">
              <Link href="/diskominfo/peta">← Kota Bandung</Link>
              <span aria-hidden="true">›</span>
              <strong>Kec. {drilldown.kecamatan.nama}</strong>
            </nav>

            <Link
              href="/diskominfo/peta"
              className={styles.closeButton}
              aria-label="Tutup rincian kecamatan dan kembali ke Kota Bandung"
            >
              ×
            </Link>
          </div>

          <div className={styles.drilldownGrid}>
            <div className={styles.drilldownViewport}>
              <BandungSubdistrictMap
                kecamatan={drilldown.kecamatan.nama}
                kelurahan={drilldown.kelurahan}
              />
            </div>

            <div className={styles.drilldownSidePanel}>
              <SubdistrictDataPanel
                kecamatan={drilldown.kecamatan.nama}
                kelurahan={drilldown.kelurahan}
                unresolvedWarga={drilldown.dataQuality.unresolvedWarga}
              />
            </div>
          </div>
        </section>
      ) : (
        <DefaultMapState />
      )}
    </section>
  );
}

async function DefaultMapState() {
  const [cityDistribution, districtDistribution] = await Promise.all([
    getCityDesilDistribution(),
    getDistrictDesilDistribution(),
  ]);

  return (
    <section className={styles.mapCard} aria-label="Peta desil Kota Bandung">
      <div className={styles.mapContent}>
        <div className={styles.mapViewport}>
          <BandungDistrictMap districts={districtDistribution} />
        </div>

        <div className={styles.sidePanel}>
          <CityDistributionPanel
            distribution={cityDistribution.distribution}
          />
        </div>
      </div>
    </section>
  );
}