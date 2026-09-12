import { KelurahanDashboard } from "@/components/kelurahan/dashboard/kelurahan-dashboard";
import { requireKelurahanActor } from "@/lib/auth/require-kelurahan-actor";
import { getKelurahanData } from "@/lib/kelurahan/data";

export default async function KelurahanPage(){const actor=await requireKelurahanActor();const data=await getKelurahanData(actor);return <KelurahanDashboard data={data}/>;}
