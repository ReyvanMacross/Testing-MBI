import styles from "./summary-card.module.css";

type SummaryCardProps = {
  title: string;
  value: string;
  badge?: string;
  description?: string;
};

export function SummaryCard({
  title,
  value,
  badge,
  description,
}: SummaryCardProps) {
  return (
    <article className={styles.card}>
      <p className={styles.title}>{title}</p>

      <div className={styles.valueRow}>
        <strong className={styles.value}>{value}</strong>

        {badge && (
          <span
            className={`${styles.badge} ${
              badge === "NORMAL" ? styles.badgeNormal : styles.badgeWarning
            }`}
          >
            {badge}
          </span>
        )}
      </div>

      {description && <p className={styles.description}>{description}</p>}
    </article>
  );
}
