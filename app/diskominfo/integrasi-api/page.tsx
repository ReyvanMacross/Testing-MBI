import { IntegrationsPageShell } from "@/components/diskominfo/integrations/integrations-page-shell";
import { getIntegrations, getIntegrationSummary, type IntegrationStatus } from "@/lib/diskominfo/integrations";
import { getMasterOpdOptions } from "@/lib/diskominfo/users";

import styles from "./integrasi-api.module.css";

type Props = { searchParams: Promise<{ q?: string; status?: string; opd?: string; page?: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["ONLINE", "LAMBAT", "OFFLINE", "BELUM_DITEST"]);

export default async function IntegrationPage({ searchParams }: Props) {
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const filters = {
    search:
      params.q && params.q.trim().length <= 100
        ? params.q.trim()
        : undefined,
    status: params.status && STATUSES.has(params.status) ? params.status as IntegrationStatus : undefined,
    opdId: params.opd && UUID.test(params.opd) ? params.opd : undefined,
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
  const [summary, result, opdOptions] = await Promise.all([getIntegrationSummary(), getIntegrations(filters), getMasterOpdOptions()]);
  return <section className={styles.page} aria-labelledby="integrations-heading"><IntegrationsPageShell summary={summary} filters={filters} result={result} opdOptions={opdOptions} /></section>;
}
