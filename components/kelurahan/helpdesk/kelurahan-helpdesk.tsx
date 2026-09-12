"use client";

import { Headphones, Send } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import styles from "@/components/kelurahan/shared/kelurahan-ui.module.css";

export function KelurahanHelpdesk({village}:{village:string}){
  const[category,setCategory]=useState("Data kependudukan");const[description,setDescription]=useState("");const[busy,setBusy]=useState(false);const[message,setMessage]=useState("");const[error,setError]=useState("");
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError("");setMessage("");try{const response=await fetch("/api/kelurahan/helpdesk",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({category,description})});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.message??"Tiket tidak dapat dikirim.");setMessage(`Tiket ${payload.ticketCode} berhasil dikirim.`);setDescription("");}catch(cause){setError(cause instanceof Error?cause.message:"Tiket tidak dapat dikirim.");}finally{setBusy(false);}}
  return <section aria-labelledby="helpdesk-title"><div className={styles.pageHeading}><div><h1 id="helpdesk-title">Helpdesk Operator Kelurahan</h1><p>Laporkan anomali data kependudukan, kendala wilayah, atau kegagalan pengiriman usulan dari Kelurahan {village}.</p></div></div><div className={styles.dashboardBottom}><section className={styles.panel}><form className={styles.form} onSubmit={submit}><label><strong>Kategori Kendala</strong><select value={category} onChange={(event)=>setCategory(event.target.value)}><option>Data kependudukan</option><option>Wilayah RT/RW</option><option>Survei lapangan</option><option>Pengiriman ke Kecamatan</option></select></label><label><strong>Deskripsi Kendala</strong><textarea value={description} onChange={(event)=>setDescription(event.target.value)} placeholder="Jelaskan kendala dan langkah yang sudah dicoba..."/></label>{message&&<p className={styles.notice}>{message}</p>}{error&&<p className={`${styles.notice} ${styles.noticeError}`}>{error}</p>}<button className={styles.primary} disabled={busy}><Send size={16}/>{busy?"Mengirim...":"Kirim Tiket Helpdesk"}</button></form></section><aside className={styles.panel}><Headphones size={34}/><h2>Pusdatin Diskominfo</h2><p>Tim helpdesk memantau tiket operator kewilayahan dan membantu penyelarasan data MBI.</p><p className={styles.muted}>Sertakan kategori dan kronologi yang cukup agar tiket dapat ditangani tanpa membuka data pribadi warga.</p></aside></div></section>;
}
