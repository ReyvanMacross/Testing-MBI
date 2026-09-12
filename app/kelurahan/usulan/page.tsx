import { KelurahanUsulan } from "@/components/kelurahan/usulan/kelurahan-usulan";
import { requireKelurahanActor } from "@/lib/auth/require-kelurahan-actor";
import { getKelurahanData } from "@/lib/kelurahan/data";

export default async function KelurahanUsulanPage(){const actor=await requireKelurahanActor();const data=await getKelurahanData(actor);return <KelurahanUsulan data={data}/>;}
