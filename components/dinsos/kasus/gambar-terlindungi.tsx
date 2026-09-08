"use client";

import { ImageIcon, UserRound } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import styles from "./kasus.module.css";

type GambarTerlindungiProps = {
  tersedia: boolean;
  src: string;
  alt: string;
  jenis: "profil" | "dokumen";
  fallbackSrc?: string;
};

export function GambarTerlindungi({ tersedia, src, alt, jenis, fallbackSrc }: GambarTerlindungiProps) {
  const [gambarUtamaGagal, setGambarUtamaGagal] = useState(false);
  const [gambarPenggantiGagal, setGambarPenggantiGagal] = useState(false);
  const className = jenis === "profil" ? styles.avatarWarga : styles.documentPreview;
  const memakaiGambarUtama = tersedia && !gambarUtamaGagal;
  const memakaiGambarPengganti = Boolean(fallbackSrc) && !gambarPenggantiGagal;

  if (!memakaiGambarUtama && !memakaiGambarPengganti) {
    return (
      <span className={className} aria-label={`${alt} belum tersedia`}>
        {jenis === "profil"
          ? <UserRound size={30} strokeWidth={1.5} />
          : <ImageIcon size={44} strokeWidth={1.25} />}
      </span>
    );
  }

  return (
    <span className={`${className} ${styles.gambarTersedia}`} role="img" aria-label={alt}>
      {memakaiGambarPengganti && (
        <Image
          src={fallbackSrc!}
          alt=""
          aria-hidden="true"
          fill
          sizes={jenis === "profil" ? "72px" : "(max-width: 760px) 100vw, 260px"}
          unoptimized
          onError={() => setGambarPenggantiGagal(true)}
        />
      )}
      {memakaiGambarUtama && (
        <Image
          src={src}
          alt=""
          aria-hidden="true"
          fill
          sizes={jenis === "profil" ? "72px" : "(max-width: 760px) 100vw, 260px"}
          unoptimized
          onError={() => setGambarUtamaGagal(true)}
        />
      )}
    </span>
  );
}
