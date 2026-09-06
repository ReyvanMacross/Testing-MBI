"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import styles from "./login.module.css";

type LoginFormProps = {
  initialError?: boolean;
};

export default function LoginForm({ initialError = false }: LoginFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState(initialError);
  const [supportTopic, setSupportTopic] = useState<"password" | "contact">(
    "contact",
  );
  const supportDialog = useRef<HTMLDialogElement>(null);
  const errorMessage = useRef<HTMLDivElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setLoginError(false);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    const identifier = String(formData.get("identifier") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      if (!response.ok) {
        setLoginError(true);
        requestAnimationFrame(() => errorMessage.current?.focus());
        return;
      }

      router.replace("/diskominfo");
      router.refresh();
    } catch {
      setLoginError(true);
      requestAnimationFrame(() => errorMessage.current?.focus());
    } finally {
      setIsSubmitting(false);
    }
  }

  function openSupport(topic: "password" | "contact") {
    setSupportTopic(topic);
    supportDialog.current?.showModal();
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <p className={styles.brand}>
          PLATFORM MBI — DISKOMINFO KOTA BANDUNG
        </p>
        <h1 id="login-heading" className={styles.heading}>
          Masuk
        </h1>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        {loginError && (
          <div
            id="login-error"
            className={styles.error}
            role="alert"
            aria-live="polite"
            tabIndex={-1}
            ref={errorMessage}
          >
            <span className={styles.errorIcon} aria-hidden="true">
              !
            </span>
            <p>
              Kombinasi Nama Pengguna/NIP atau Kata Sandi salah. Silakan coba
              lagi atau hubungi Admin.
            </p>
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="identifier">Nama Pengguna atau NIP</label>
          <input
            className={styles.input}
            id="identifier"
            name="identifier"
            type="text"
            placeholder="Masukkan NIP Anda"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            pattern={".*\\S.*"}
            title="Masukkan nama pengguna atau NIP."
            aria-invalid={loginError}
            aria-describedby={loginError ? "login-error" : undefined}
            onChange={() => setLoginError(false)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="password">Kata Sandi</label>
          <div className={styles.passwordField}>
            <input
              className={`${styles.input} ${styles.passwordInput}`}
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Masukkan kata sandi"
              autoComplete="current-password"
              required
              aria-invalid={loginError}
              aria-describedby={loginError ? "login-error" : undefined}
              onChange={() => setLoginError(false)}
            />
            <button
              className={styles.passwordToggle}
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={
                showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
              }
              aria-controls="password"
              aria-pressed={showPassword}
            >
              <Image
                src="/images/password-eye.svg"
                alt=""
                width={18.3333}
                height={12.5}
                className={styles.eyeIcon}
              />
            </button>
          </div>
        </div>

        <div className={styles.utilities}>
          <label className={styles.remember} htmlFor="remember-me">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Ingat saya</span>
          </label>
          <button
            className={styles.textButton}
            type="button"
            onClick={() => openSupport("password")}
          >
            Lupa kata sandi?
          </button>
        </div>

        <button
          className={styles.submit}
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          Masuk
        </button>

        <p className={styles.help}>
          Perlu bantuan?{" "}
          <button
            className={styles.textButton}
            type="button"
            onClick={() => openSupport("contact")}
          >
            Hubungi Admin
          </button>
        </p>
      </form>

      <footer className={styles.footer}>
        <p>
          Sistem ini hanya untuk pengguna internal Diskominfo, Dinas{" "}
          <br className={styles.footerBreak} />
          Sosial, dan OPD terkait Kota Bandung.
        </p>
      </footer>

      <dialog
        className={styles.supportDialog}
        ref={supportDialog}
        aria-labelledby="support-heading"
        aria-describedby="support-description"
      >
        <h2 id="support-heading">
          {supportTopic === "password" ? "Lupa kata sandi?" : "Bantuan akses akun"}
        </h2>
        <p id="support-description">
          {supportTopic === "password"
            ? "Untuk mengatur ulang kata sandi, hubungi administrator Platform MBI melalui kanal internal instansi Anda."
            : "Untuk bantuan akses Platform MBI, hubungi administrator Diskominfo melalui kanal internal instansi Anda."}
        </p>
        <form method="dialog">
          <button className={styles.submit} type="submit">
            Tutup
          </button>
        </form>
      </dialog>
    </div>
  );
}
