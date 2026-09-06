"use client";

import { FormEvent, useState } from "react";

import type { IntegrationDetail } from "@/lib/diskominfo/integrations";
import type { OpdOption } from "@/lib/diskominfo/users";

import styles from "./integrations.module.css";

type Props = {
  integration?: IntegrationDetail;
  opdOptions: OpdOption[];
  onCancel: () => void;
  onSuccess: () => void;
};

export function IntegrationForm({ integration, opdOptions, onCancel, onSuccess }: Props) {
  const [credentialType, setCredentialType] = useState(integration?.credentialType ?? "NONE");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const payload = {
      layanan: values.get("layanan"),
      instansi: values.get("instansi"),
      opdId: values.get("opdId") || null,
      endpointUrl: values.get("endpointUrl") || null,
      httpMethod: values.get("httpMethod"),
      timeoutMs: Number(values.get("timeoutMs")),
      expectedStatusMin: Number(values.get("expectedStatusMin")),
      expectedStatusMax: Number(values.get("expectedStatusMax")),
      credentialType: values.get("credentialType"),
      credentialRef: values.get("credentialRef") || null,
      healthcheckEnabled: values.get("healthcheckEnabled") === "on",
      isCritical: values.get("isCritical") === "on",
      criticalOrder: Number(values.get("criticalOrder")) || null,
      notes: values.get("notes") || null,
    };
    try {
      const response = await fetch(integration ? `/api/admin/integrations/${integration.id}` : "/api/admin/integrations", {
        method: integration ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Data integrasi tidak dapat disimpan.");
        return;
      }
      onSuccess();
    } catch {
      setError("Data integrasi tidak dapat disimpan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.integrationForm} onSubmit={handleSubmit}>
      {error ? <div className={styles.formError} role="alert">{error}</div> : null}
      <div className={styles.formGrid}>
        <label>Nama Layanan *<input name="layanan" required maxLength={160} defaultValue={integration?.layanan ?? ""} /></label>
        <label>Instansi *<input name="instansi" required maxLength={160} defaultValue={integration?.instansi ?? ""} /></label>
        <label>OPD<select name="opdId" defaultValue={integration?.opdId ?? ""}><option value="">Sumber eksternal / tanpa OPD</option>{opdOptions.map((opd) => <option key={opd.id} value={opd.id}>{opd.nama}</option>)}</select></label>
        <label>HTTP Method<select name="httpMethod" defaultValue={integration?.httpMethod ?? "GET"}><option>GET</option><option>HEAD</option><option>POST</option></select></label>
        <label className={styles.fullField}>Endpoint URL<input name="endpointUrl" type="url" placeholder="https://api.instansi.go.id/health" defaultValue={integration?.endpointUrl ?? ""} /><small>Opsional untuk data legacy. Host harus terdaftar pada allowlist server.</small></label>
        <label>Timeout (ms) *<input name="timeoutMs" type="number" min={500} max={30000} required defaultValue={integration?.timeoutMs ?? 5000} /></label>
        <label>Urutan Kritis<input name="criticalOrder" type="number" min={1} defaultValue={integration?.criticalOrder ?? ""} /></label>
        <label>Expected HTTP Min *<input name="expectedStatusMin" type="number" min={100} max={599} required defaultValue={integration?.expectedStatusMin ?? 200} /></label>
        <label>Expected HTTP Max *<input name="expectedStatusMax" type="number" min={100} max={599} required defaultValue={integration?.expectedStatusMax ?? 299} /></label>
        <label>Credential<select name="credentialType" value={credentialType} onChange={(event) => setCredentialType(event.target.value as "NONE" | "BEARER")}><option value="NONE">Tanpa Credential</option><option value="BEARER">Bearer via Environment</option></select></label>
        <label>Credential Reference {credentialType === "BEARER" ? "*" : ""}<input name="credentialRef" required={credentialType === "BEARER"} pattern="[A-Z][A-Z0-9_]{2,100}" placeholder="DINSOS_API_TOKEN" defaultValue={integration?.credentialRef ?? ""} disabled={credentialType === "NONE"} /><small>Nama environment variable saja; nilai secret tidak disimpan.</small></label>
        <label className={styles.checkboxLabel}><input name="healthcheckEnabled" type="checkbox" defaultChecked={integration?.healthcheckEnabled ?? true} /> Healthcheck Aktif</label>
        <label className={styles.checkboxLabel}><input name="isCritical" type="checkbox" defaultChecked={integration?.isCritical ?? false} /> Endpoint Kritis</label>
        <label className={styles.fullField}>Catatan<textarea name="notes" rows={3} maxLength={2000} defaultValue={integration?.notes ?? ""} /></label>
      </div>
      <div className={styles.dialogActions}>
        <button className={styles.secondaryButton} type="button" onClick={onCancel} disabled={submitting}>Batal</button>
        <button className={styles.primaryButton} type="submit" disabled={submitting}>{submitting ? "Menyimpan..." : integration ? "Simpan Perubahan" : "Simpan Integrasi"}</button>
      </div>
    </form>
  );
}
