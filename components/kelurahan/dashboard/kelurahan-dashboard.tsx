"use client";

import { BarChart3, ChevronLeft, ChevronRight, ClipboardList, Eye, Send, ShieldCheck, Split } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { AssignSurveyDialog, ProposalDrawer, SendDialog, StatusBadge, SurveyDialog } from "@/components/kelurahan/shared/workflow-panels";
import type { KelurahanData, KelurahanProposal } from "@/lib/kelurahan/data";
import styles from "@/components/kelurahan/shared/kelurahan-ui.module.css";

type Mode="assign"|"survey"|"send"|"detail"|null;
function action(proposal:KelurahanProposal):{label:string;mode:Exclude<Mode,null>} {
  if(proposal.status==="MENUNGGU_VERIFIKASI_RT_RW")return{label:"Proses",mode:"assign"};
  if(proposal.status==="SURVEI_LAPANGAN")return{label:"Isi Survei",mode:"survey"};
  if(proposal.status==="SIAP_DIKIRIM_KECAMATAN")return{label:"Kirim",mode:"send"};
  return{label:"Detail",mode:"detail"};
}
export function KelurahanDashboard({data}:{data:KelurahanData}){
  const [selected,setSelected]=useState<KelurahanProposal|null>(null);const [mode,setMode]=useState<Mode>(null);const[search,setSearch]=useState("");const[stage,setStage]=useState("");const[rw,setRw]=useState("");
  const rows=useMemo(()=>data.proposals.filter((row)=>!search||`${row.name} ${row.maskedNik}`.toLowerCase().includes(search.toLowerCase())).filter((row)=>!stage||row.status===stage).filter((row)=>!rw||row.rw===rw),[data.proposals,search,stage,rw]);
  const rwOptions=[...new Set(data.proposals.map((row)=>row.rw))].sort();function open(row:KelurahanProposal,next:Exclude<Mode,null>){setSelected(row);setMode(next);}function close(){setSelected(null);setMode(null);}
  return <section aria-labelledby="kel-dashboard-title"><div className={styles.pageHeading}><div><h1 id="kel-dashboard-title">Antrian Kerja Verifikasi Kelurahan</h1><p>Selamat datang, Tim Kelurahan {data.actor.village}. Berikut adalah daftar antrian tugas verifikasi dan pengusulan warga MBI wilayah {data.actor.village} hari ini.</p></div></div>
    <div className={styles.metricsGrid}><Metric label="Menunggu Verifikasi RT/RW" value={data.summary.waitingRtRw} icon={<ClipboardList/>}/><Metric label="Verifikasi Kelurahan" value={data.summary.villageVerification} icon={<BarChart3/>}/><Metric label="Validasi Kecamatan" value={data.summary.districtValidation} icon={<ShieldCheck/>}/><Metric label="Siap Split Jalur OPD" value={data.summary.readyReferral} icon={<Split/>}/><Metric label="Rujukan Terkirim Bulan Ini" value={data.summary.sentThisMonth} icon={<Send/>}/></div>
    <section className={styles.card}><div className={styles.filters}><h2>Antrian Kerja Hari Ini</h2><div className={styles.filterControls}><input className={styles.searchBox} aria-label="Cari antrian" placeholder="NIK atau Nama..." value={search} onChange={(event)=>setSearch(event.target.value)}/><select aria-label="Filter RW" value={rw} onChange={(event)=>setRw(event.target.value)}><option value="">Semua RW</option>{rwOptions.map((value)=><option key={value} value={value}>RW {value}</option>)}</select><select aria-label="Filter tahap" value={stage} onChange={(event)=>setStage(event.target.value)}><option value="">Semua Tahap</option><option value="MENUNGGU_VERIFIKASI_RT_RW">Verifikasi RT/RW</option><option value="SURVEI_LAPANGAN">Survei Lapangan</option><option value="SIAP_DIKIRIM_KECAMATAN">Siap Dikirim</option><option value="TERKIRIM_KECAMATAN">Terkirim Kecamatan</option></select></div></div>
      <div className={styles.desktopTable}><table><thead><tr><th>NIK</th><th>Nama</th><th>RW / RT</th><th>Tahap Saat Ini</th><th>Prioritas</th><th>Tanggal Masuk</th><th>Aksi</th></tr></thead><tbody>{rows.map((row)=>{const next=action(row);return <tr key={row.id}><td>{row.maskedNik}</td><td><strong>{row.name}</strong></td><td>RW {row.rw} / RT {row.rt}</td><td><StatusBadge status={row.status}/></td><td><span className={`${styles.badge} ${row.estimatedDesil<=2?styles.statusRed:row.estimatedDesil===3?styles.statusOrange:styles.badgeGreen}`}>{row.estimatedDesil<=2?"Tinggi":row.estimatedDesil===3?"Sedang":"Rendah"}</span></td><td>{row.createdAt}</td><td><button className={`${styles.action} ${next.mode!=="detail"?styles.actionPrimary:""}`} onClick={()=>open(row,next.mode)}>{next.mode==="detail"&&<Eye size={16}/>} {next.label}</button></td></tr>;})}</tbody></table></div>
      <div className={styles.mobileCards}>{rows.map((row)=>{const next=action(row);return <article key={row.id}><header><div><h3>{row.name}</h3><span className={styles.muted}>{row.maskedNik} · RW {row.rw}/RT {row.rt}</span></div><StatusBadge status={row.status}/></header><button className={`${styles.action} ${styles.actionPrimary}`} onClick={()=>open(row,next.mode)}>{next.label}</button></article>;})}</div>{!rows.length&&<p className={styles.emptyState}>Belum ada antrian yang sesuai filter.</p>}<nav className={styles.pagination}><p>Menampilkan 1–{rows.length} dari {data.proposals.length} antrian</p><div className={styles.pages}><span><ChevronLeft size={15}/></span><strong>1</strong><span>2</span><span>3</span><span>…</span><span><ChevronRight size={15}/></span></div></nav>
    </section>{selected&&mode==="assign"&&<AssignSurveyDialog proposal={selected} data={data} close={close}/>} {selected&&mode==="survey"&&<SurveyDialog proposal={selected} close={close}/>} {selected&&mode==="send"&&<SendDialog proposal={selected} data={data} close={close}/>} {selected&&mode==="detail"&&<ProposalDrawer proposal={selected} data={data} close={close}/>}</section>;
}
function Metric({label,value,icon}:{label:string;value:number;icon:ReactNode}){return <article className={styles.metric}><span>{label}</span><strong>{value}</strong><small aria-hidden="true">{icon}</small></article>;}
