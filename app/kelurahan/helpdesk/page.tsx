import { KelurahanHelpdesk } from "@/components/kelurahan/helpdesk/kelurahan-helpdesk";
import { requireKelurahanActor } from "@/lib/auth/require-kelurahan-actor";

export default async function KelurahanHelpdeskPage(){const actor=await requireKelurahanActor();return <KelurahanHelpdesk village={actor.kelurahanNama}/>;}
