import { KelurahanSurvei } from "@/components/kelurahan/survei/kelurahan-survei";
import { requireKelurahanActor } from "@/lib/auth/require-kelurahan-actor";
import { getKelurahanData } from "@/lib/kelurahan/data";

export default async function KelurahanSurveiPage(){const actor=await requireKelurahanActor();const data=await getKelurahanData(actor);return <KelurahanSurvei data={data}/>;}
