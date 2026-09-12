import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { PanelDataKelurahan } from "@/components/diskominfo/peta-desil/panel-data-kelurahan";
import { PanelDistribusiKota } from "@/components/diskominfo/peta-desil/panel-distribusi-kota";
import { PetaKecamatanBandung } from "@/components/diskominfo/peta-desil/peta-kecamatan-bandung";
import { PetaKelurahanBandung } from "@/components/diskominfo/peta-desil/peta-kelurahan-bandung";
import {
  getCityDesilDistribution,
  getDistrictDesilDistribution,
  getDistrictDrilldown,
} from "@/lib/diskominfo/desil-map";

import styles from "@/app/diskominfo/peta/peta.module.css";

type PropertiPenjelajahPetaDesil = {
  kecamatanDiminta?: string;
  kelurahanDiminta?: string;
  basePath?: string;
  citySidePanel?: ReactNode;
};

export async function PenjelajahPetaDesil({
  kecamatanDiminta,
  kelurahanDiminta,
  basePath = "/diskominfo/peta",
  citySidePanel,
}: PropertiPenjelajahPetaDesil) {
  if (!kecamatanDiminta) {
    const [cityDistribution, districtDistribution] = await Promise.all([
      getCityDesilDistribution(),
      getDistrictDesilDistribution(),
    ]);

    return (
      <section className={styles.mapCard} aria-label="Peta desil Kota Bandung">
        <div className={styles.mapContent}>
          <div className={styles.mapViewport}>
            <PetaKecamatanBandung daftarKecamatan={districtDistribution} basePath={basePath} />
          </div>

          <div className={styles.sidePanel}>
            {citySidePanel ?? (
              <PanelDistribusiKota
                distribusi={cityDistribution.distribution}
                totalKecamatan={districtDistribution.length}
                kecamatanDenganData={districtDistribution.filter(
                  (district) => district.totalWithDesil > 0,
                ).length}
                kecamatanInternal={districtDistribution.filter(
                  (district) => district.source?.kind === "INTERNAL_MBI",
                ).length}
                kecamatanReferensiPublik={districtDistribution.filter(
                  (district) => district.source?.kind === "PUBLIC_REFERENCE",
                ).length}
              />
            )}
          </div>
        </div>
      </section>
    );
  }

  const drilldown = await getDistrictDrilldown(kecamatanDiminta);

  if (!drilldown) {
    redirect(basePath);
  }

  const selectedSubdistrict = kelurahanDiminta
    ? drilldown.kelurahan.find((item) => item.kode === kelurahanDiminta)
    : null;

  if (kelurahanDiminta && !selectedSubdistrict) {
    redirect(
      `${basePath}?kecamatan=${encodeURIComponent(
        drilldown.kecamatan.nama,
      )}`,
    );
  }

  return (
    <section className={styles.drilldownCard}>
      <div className={styles.drilldownHeader}>
        <nav className={styles.breadcrumb} aria-label="Lokasi peta">
          <Link href={basePath}>← Kota Bandung</Link>
          <span aria-hidden="true">›</span>
          <strong>Kec. {drilldown.kecamatan.nama}</strong>
          {selectedSubdistrict && (
            <>
              <span aria-hidden="true">›</span>
              <span>{selectedSubdistrict.nama}</span>
            </>
          )}
        </nav>

        <Link
          href={basePath}
          className={styles.closeButton}
          aria-label="Tutup rincian kecamatan dan kembali ke Kota Bandung"
        >
          ×
        </Link>
      </div>

      <div className={styles.districtSummary}>
        <div>
          <span className={styles.summaryEyebrow}>Kecamatan terpilih</span>
          <h2>{drilldown.kecamatan.nama}</h2>
          <p>Kode wilayah {drilldown.kecamatan.kode}</p>
        </div>
        <dl>
          <div>
            <dt>Kelurahan</dt>
            <dd>{drilldown.kelurahan.length}</dd>
          </div>
          <div>
            <dt>Data terhubung</dt>
            <dd>
              {drilldown.kelurahan.filter((item) => item.totalWithDesil > 0).length}
              /{drilldown.kelurahan.length}
            </dd>
          </div>
        </dl>
      </div>

      <div className={styles.drilldownGrid}>
        <div className={styles.drilldownViewport}>
          <PetaKelurahanBandung
            kecamatan={drilldown.kecamatan.nama}
            daftarKelurahan={drilldown.kelurahan}
            kodeKelurahanTerpilih={selectedSubdistrict?.kode}
            basePath={basePath}
          />
        </div>

        <div className={styles.drilldownSidePanel}>
          <PanelDataKelurahan
            kecamatan={drilldown.kecamatan.nama}
            daftarKelurahan={drilldown.kelurahan}
            wargaBelumTerpetakan={drilldown.dataQuality.unresolvedWarga}
            daftarSumber={drilldown.sources}
            kodeKelurahanTerpilih={selectedSubdistrict?.kode}
            basePath={basePath}
          />
        </div>
      </div>
    </section>
  );
}
