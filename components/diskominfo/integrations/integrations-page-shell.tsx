"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { IntegrationDetail, IntegrationFilters, IntegrationHistory, IntegrationListItem, IntegrationSummary as Summary } from "@/lib/diskominfo/integrations";
import type { OpdOption } from "@/lib/diskominfo/users";

import { AddIntegrationDialog } from "./add-integration-dialog";
import { EditIntegrationDialog } from "./edit-integration-dialog";
import { IntegrationDetailDialog } from "./integration-detail";
import { IntegrationFiltersForm } from "./integration-filters";
import { IntegrationPagination } from "./integration-pagination";
import { IntegrationSummary } from "./integration-summary";
import { IntegrationTable } from "./integration-table";
import styles from "./integrations.module.css";

type Props = {
  summary: Summary;
  filters: IntegrationFilters;
  result: { integrations: IntegrationListItem[]; page: number; pageSize: number; total: number; totalPages: number };
  opdOptions: OpdOption[];
};

export function IntegrationsPageShell({ summary, filters, result, opdOptions }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<IntegrationDetail | null>(null);
  const [detail, setDetail] = useState<IntegrationDetail | null>(null);
  const [history, setHistory] = useState<IntegrationHistory[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load(item: IntegrationListItem, mode: "detail" | "edit") {
    setError("");
    try {
      const response = await fetch(`/api/admin/integrations/${item.id}`);
      const payload = (await response.json()) as { integration?: IntegrationDetail; history?: IntegrationHistory[]; error?: string };
      if (!response.ok || !payload.integration) throw new Error(payload.error ?? "Detail tidak dapat diambil.");
      if (mode === "detail") {
        setHistory(payload.history ?? []);
        setDetail(payload.integration);
      } else setEditing(payload.integration);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Detail tidak dapat diambil.");
    }
  }

  async function test(item: IntegrationListItem) {
    if (!item.endpointUrl || testingId) return;
    setTestingId(item.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/integrations/${item.id}/test`, { method: "POST" });
      const payload = (await response.json()) as { status?: string; error?: string; errorMessage?: string };
      if (!response.ok) throw new Error(payload.error ?? "Uji koneksi gagal.");
      setMessage(`Uji koneksi selesai: ${payload.status}${payload.errorMessage ? ` — ${payload.errorMessage}` : ""}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Uji koneksi gagal.");
    } finally {
      setTestingId(null);
    }
  }

  function success(text: string) {
    setAddOpen(false);
    setEditing(null);
    setMessage(text);
    setError("");
    router.refresh();
  }

  return (
    <>
      <header className={styles.pageHeader}><div><h1 id="integrations-heading">Integrasi API</h1><p>Monitoring koneksi dan pertukaran data antar layanan MBI.</p></div><button className={styles.primaryButton} type="button" onClick={() => { setMessage(""); setAddOpen(true); }}>Tambah Integrasi</button></header>
      {message ? <div className={styles.successBanner} role="status">{message}</div> : null}
      {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}
      <IntegrationSummary summary={summary} />
      <IntegrationFiltersForm filters={filters} opdOptions={opdOptions} />
      <div className={styles.tableCard}>
        <IntegrationTable integrations={result.integrations} hasFilters={Boolean(filters.search || filters.status || filters.opdId)} onDetail={(item) => load(item, "detail")} onEdit={(item) => load(item, "edit")} onTest={test} testingId={testingId} />
        <IntegrationPagination filters={filters} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} />
      </div>
      <AddIntegrationDialog open={addOpen} opdOptions={opdOptions} onClose={() => setAddOpen(false)} onSuccess={() => success("Integrasi berhasil dibuat.")} />
      <EditIntegrationDialog integration={editing} opdOptions={opdOptions} onClose={() => setEditing(null)} onSuccess={() => success("Perubahan integrasi berhasil disimpan.")} />
      <IntegrationDetailDialog integration={detail} history={history} onClose={() => { setDetail(null); setHistory([]); }} />
    </>
  );
}
