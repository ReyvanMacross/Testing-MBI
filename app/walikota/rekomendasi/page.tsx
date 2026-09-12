import { ExecutiveRecommendations } from "@/components/walikota/recommendation/executive-recommendations";
import styles from "@/components/walikota/walikota.module.css";
import { getExecutiveRecommendations } from "@/lib/walikota/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { items } = await getExecutiveRecommendations();
  return <div className={styles.page}><ExecutiveRecommendations items={items} /></div>;
}
