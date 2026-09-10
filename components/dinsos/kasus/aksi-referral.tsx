"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./referral-kasus.module.css";
export function ReferralAction({caseId}:{caseId:string}){const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState("");async function send(){setBusy(true);setError("");try{const r=await fetch(`/api/dinsos/cases/${caseId}/stabilization/send`,{method:"POST"});const data=await r.json();if(!r.ok)throw new Error(data.error??"Referral gagal dikirim.");router.refresh();}catch(e){setError(e instanceof Error?e.message:"Referral gagal dikirim.");}finally{setBusy(false)}}return <>{error&&<p role="alert" className={styles.error}>{error}</p>}<button onClick={send} disabled={busy} aria-busy={busy}>{busy?"Mengirim...":"Kirim ke Proteksi & Stabilisasi"}</button></>}
