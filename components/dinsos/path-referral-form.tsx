"use client";

import { useState } from "react";

import {
  DINSOS_PATHS,
  dinsosPathLabel,
  type DinsosPath,
} from "@/lib/dinsos/path-values";

import styles from "./referral.module.css";

type TargetOpd = {
  id: string;
  code: string;
  name: string;
  allowedPaths: DinsosPath[];
};

export function PathReferralForm({
  caseId,
  approvedPath,
  reviewerTargetOpdId,
  targetOpds,
  canOverride,
}: {
  caseId: string;
  approvedPath: DinsosPath;
  reviewerTargetOpdId: string;
  targetOpds: TargetOpd[];
  canOverride: boolean;
}) {
  const [path, setPath] = useState<DinsosPath>(approvedPath);
  const [targetOpdId, setTargetOpdId] = useState(reviewerTargetOpdId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const overrideUsed = path !== approvedPath;
  const availableOpds = targetOpds.filter((opd) =>
    opd.allowedPaths.includes(path),
  );

  function changePath(nextPath: DinsosPath) {
    setPath(nextPath);
    const reviewerTargetStillAllowed = targetOpds.some(
      (opd) =>
        opd.id === reviewerTargetOpdId && opd.allowedPaths.includes(nextPath),
    );
    setTargetOpdId(reviewerTargetStillAllowed ? reviewerTargetOpdId : "");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/dinsos/cases/${caseId}/path/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path,
            targetOpdId,
            overrideReason: overrideUsed ? form.get("overrideReason") : null,
            referralNote: form.get("referralNote"),
          }),
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Referral jalur gagal diterbitkan.");
      }
      setSuccess("Referral jalur berhasil diterbitkan.");
      window.location.reload();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Referral jalur gagal diterbitkan.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.pathForm} onSubmit={submit}>
      <h2>Tindakan Referral</h2>
      <p className={styles.formEyebrow}>Inkubasi Sosial</p>

      <label>
        <span>Jalur Intervensi *</span>
        <select
          name="path"
          value={path}
          disabled={!canOverride || busy}
          onChange={(event) => changePath(event.target.value as DinsosPath)}
        >
          {DINSOS_PATHS.map((item) => (
            <option key={item} value={item}>
              {item === approvedPath
                ? `Gunakan Rekomendasi Supervisor (${dinsosPathLabel(item)})`
                : dinsosPathLabel(item)}
            </option>
          ))}
        </select>
        {!canOverride && (
          <small>Perubahan jalur memerlukan otoritas khusus.</small>
        )}
      </label>

      {overrideUsed && (
        <label>
          <span>Alasan Perubahan *</span>
          <textarea
            name="overrideReason"
            minLength={20}
            maxLength={1000}
            rows={4}
            required
            aria-required="true"
            disabled={busy}
          />
        </label>
      )}

      <label>
        <span>Ditujukan ke OPD *</span>
        <select
          name="targetOpdId"
          value={targetOpdId}
          onChange={(event) => setTargetOpdId(event.target.value)}
          required
          disabled={busy}
        >
          <option value="" disabled>Pilih OPD tujuan</option>
          {availableOpds.map((opd) => (
            <option key={opd.id} value={opd.id}>{opd.name}</option>
          ))}
        </select>
      </label>

      <label>
        <span>Catatan Referral</span>
        <textarea
          name="referralNote"
          maxLength={3000}
          rows={5}
          disabled={busy}
          placeholder="Tuliskan instruksi yang memang perlu diteruskan ke OPD tujuan."
        />
      </label>

      <div className={styles.formFeedback} aria-live="polite">
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {success && <p role="status" className={styles.success}>{success}</p>}
      </div>

      <button type="submit" disabled={busy || !targetOpdId} aria-busy={busy}>
        {busy ? "Menerbitkan…" : "Terbitkan Referral"}
      </button>
    </form>
  );
}
