import styles from "./informasi-peta-aktif.module.css";

type PropertiInformasiPetaAktif = {
  judul: string;
  keterangan: string;
};

export function InformasiPetaAktif({
  judul,
  keterangan,
}: PropertiInformasiPetaAktif) {
  return (
    <div className={styles.informasi} aria-live="polite">
      <strong>{judul}</strong>
      <span>{keterangan}</span>
    </div>
  );
}
