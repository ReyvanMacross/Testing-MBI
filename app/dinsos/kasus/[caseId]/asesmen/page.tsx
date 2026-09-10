import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AssessmentForm } from "@/components/dinsos/kasus/formulir-asesmen";
import { TabTahapanKasus } from "@/components/dinsos/kasus/tab-tahapan-kasus";
import styles from "@/components/dinsos/kasus/kasus.module.css";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { getDinsosCaseById } from "@/lib/dinsos/cases";
import { canOpenAssessment } from "@/lib/dinsos/case-stage";

export default async function AssessmentPage({params}:{params:Promise<{caseId:string}>}){const {caseId}=await params;const actor=await requireDinsosActor();const item=await getDinsosCaseById(caseId,actor.profileId);if(!item)notFound();const completed=item.assessment?.status==="COMPLETED";if(!canOpenAssessment(item.currentStage,item.assessment?.status as string|undefined))redirect(`/dinsos/kasus/${caseId}`);return <section><div className={styles.breadcrumb}><span>Antrian Kerja Harian &nbsp;/&nbsp; Data Warga &nbsp;/&nbsp; <strong>Asesmen Sosial</strong></span><Link className={styles.back} href="/dinsos">← Kembali ke Antrian</Link></div><header className={styles.caseTitle}><h1>Detail Kasus Warga</h1><p>Asesmen dan verifikasi data sosial untuk menentukan kelayakan program bantuan.</p></header><TabTahapanKasus caseId={caseId} active="assessment" assessmentReady={completed} resultReady={item.result?.status==="CONFIRMED"}/><h2 className={styles.formTitle}>Formulir Asesmen Sosial</h2><AssessmentForm caseId={caseId} initial={item.assessment} official={item.officialDesil} completed={completed}/></section>}
