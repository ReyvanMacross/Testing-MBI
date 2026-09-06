import styles from "./footer.module.css";

export default function DashboardFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <p className={styles.copyright}>
        © {year} Diskominfo Kota Bandung — Platform MBI Internal
      </p>

      <div className={styles.links}>
        <span>Pusat Bantuan</span>
        <span>Kebijakan Privasi</span>
      </div>
    </footer>
  );
}
