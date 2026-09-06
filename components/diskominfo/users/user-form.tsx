"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  MANAGED_USER_ROLES,
  USER_ROLE_RULES,
  getUserRoleLabel,
  isManagedUserRole,
} from "@/lib/diskominfo/user-role-config";
import type {
  ManagedUser,
  OpdOption,
  WilayahOption,
} from "@/lib/diskominfo/users";

import styles from "./users.module.css";

type UserFormProps = {
  mode: "add" | "edit";
  user?: ManagedUser;
  opdOptions: OpdOption[];
  wilayahOptions: WilayahOption[];
  onClose: () => void;
  onSuccess: () => void;
};

export function UserForm({
  mode,
  user,
  opdOptions,
  wilayahOptions,
  onClose,
  onSuccess,
}: UserFormProps) {
  const initialRole = user?.role ?? "Admin Diskominfo";
  const [role, setRole] = useState(initialRole);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const firstInputRef = useRef<HTMLInputElement>(null);
  const titleId = mode === "add" ? "add-user-title" : "edit-user-title";
  const roleRule = isManagedUserRole(role) ? USER_ROLE_RULES[role] : null;
  const allowedWilayah = wilayahOptions.filter((option) =>
    roleRule
      ? (roleRule.allowedWilayahTypes as readonly string[]).includes(
          option.jenis,
        )
      : true,
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstInputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSubmitting, onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      namaLengkap: String(formData.get("namaLengkap") ?? ""),
      email: String(formData.get("email") ?? ""),
      username: String(formData.get("username") ?? ""),
      nip: String(formData.get("nip") ?? ""),
      role: String(formData.get("role") ?? ""),
      opdId: String(formData.get("opdId") ?? ""),
      wilayahId:
        role === "Admin Diskominfo"
          ? ""
          : String(formData.get("wilayahId") ?? ""),
      status:
        mode === "edit" ? String(formData.get("status") ?? "AKTIF") : "AKTIF",
      ...(mode === "add"
        ? { password: String(formData.get("password") ?? "") }
        : {}),
    };

    try {
      const response = await fetch(
        mode === "add" ? "/api/admin/users" : `/api/admin/users/${user?.id}`,
        {
          method: mode === "add" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Permintaan tidak dapat diproses.");
        return;
      }

      onSuccess();
    } catch {
      setError("Tidak dapat terhubung ke server. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className={styles.dialogOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={styles.dialogHeader}>
          <div>
            <h2 id={titleId}>
              {mode === "add" ? "Tambah Akun" : "Edit Akun"}
            </h2>
            <p>
              {mode === "add"
                ? "Buat akun internal baru beserta penugasannya."
                : "Perbarui profil, penugasan, dan status akun."}
            </p>
          </div>
          <button
            type="button"
            className={styles.dialogClose}
            aria-label="Tutup dialog"
            disabled={isSubmitting}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form className={styles.userForm} onSubmit={handleSubmit}>
          {error ? (
            <div className={styles.formError} role="alert">
              {error}
            </div>
          ) : null}

          <div className={styles.formGrid}>
            <label className={styles.fullField}>
              <span>Nama Lengkap *</span>
              <input
                ref={firstInputRef}
                defaultValue={user?.namaLengkap ?? ""}
                name="namaLengkap"
                required
                maxLength={120}
              />
            </label>

            <label className={styles.fullField}>
              <span>Email *</span>
              <input
                defaultValue={user?.email ?? ""}
                name="email"
                type="email"
                required
                readOnly={mode === "edit"}
                aria-readonly={mode === "edit"}
              />
            </label>

            <label>
              <span>Username</span>
              <input
                defaultValue={user?.username ?? ""}
                name="username"
                minLength={3}
                maxLength={50}
                pattern="[a-z0-9._-]{3,50}"
                placeholder="contoh: budi.s"
              />
            </label>

            <label>
              <span>NIP</span>
              <input
                defaultValue={user?.nip ?? ""}
                name="nip"
                inputMode="numeric"
                pattern="[0-9]{18}"
                maxLength={18}
                placeholder="18 digit"
              />
            </label>

            <p className={`${styles.fieldHint} ${styles.fullField}`}>
              Isi minimal salah satu: Username atau NIP.
            </p>

            <label>
              <span>Role *</span>
              <select
                name="role"
                required
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                {!isManagedUserRole(initialRole) ? (
                  <option value={initialRole}>{initialRole} (legacy)</option>
                ) : null}
                {MANAGED_USER_ROLES.map((option) => (
                  <option key={option} value={option}>
                    {getUserRoleLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Instansi/OPD</span>
              <select defaultValue={user?.opdId ?? ""} name="opdId">
                <option value="">Tanpa OPD khusus</option>
                {opdOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.nama}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.fullField}>
              <span>
                Wilayah Penugasan{roleRule?.requiresWilayah ? " *" : ""}
              </span>
              <select
                defaultValue={user?.wilayahId ?? ""}
                disabled={role === "Admin Diskominfo"}
                name="wilayahId"
                required={Boolean(roleRule?.requiresWilayah)}
              >
                <option value="">
                  {role === "Admin Diskominfo"
                    ? "Semua Wilayah"
                    : "Pilih wilayah"}
                </option>
                {allowedWilayah.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.jenis === "KECAMATAN" ? "Kec." : "Kel."}{" "}
                    {option.nama}
                    {option.parentNama ? ` — ${option.parentNama}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {mode === "add" ? (
              <label className={styles.fullField}>
                <span>Kata Sandi Sementara *</span>
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                  required
                />
                <small>Minimal 12 karakter.</small>
              </label>
            ) : (
              <label className={styles.fullField}>
                <span>Status *</span>
                <select defaultValue={user?.status ?? "AKTIF"} name="status">
                  <option value="AKTIF">AKTIF</option>
                  <option value="NONAKTIF">NONAKTIF</option>
                </select>
              </label>
            )}
          </div>

          <footer className={styles.dialogActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={isSubmitting}
              onClick={onClose}
            >
              Batal
            </button>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {mode === "add" ? "Simpan Akun" : "Simpan Perubahan"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
