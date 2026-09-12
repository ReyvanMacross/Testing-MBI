import assert from "node:assert/strict";
import { cleanupBapperidaFixtures, seedBapperidaFixtures } from "./dev/bapperida-fixture-lib.mjs";

try{
  const {db,actor,recommendationId,version,recipients}=await seedBapperidaFixtures();
  const [rowResult,recipientResult,eventResult]=await Promise.all([
    db.from("bapperida_recommendations").select("status,version").eq("id",recommendationId).single(),
    db.from("bapperida_recommendation_recipients").select("opd_id").eq("recommendation_id",recommendationId),
    db.from("bapperida_recommendation_events").select("event_type").eq("recommendation_id",recommendationId),
  ]);for(const result of [rowResult,recipientResult,eventResult])if(result.error)throw result.error;
  assert.equal(rowResult.data.status,"DRAFT");assert.equal(recipientResult.data.length,2);assert.equal(eventResult.data[0].event_type,"DRAFT_SAVED");
  const submitted=await db.rpc("bapperida_submit_recommendation",{p_recommendation_id:recommendationId,p_expected_version:version,p_actor_id:actor.id,p_actor_opd_id:actor.opd_id});if(submitted.error)throw submitted.error;
  assert.equal(submitted.data.status,"MENUNGGU_PERSETUJUAN");assert.equal(submitted.data.version,version+1);
  const duplicate=await db.rpc("bapperida_submit_recommendation",{p_recommendation_id:recommendationId,p_expected_version:submitted.data.version,p_actor_id:actor.id,p_actor_opd_id:actor.opd_id});assert.ok(duplicate.error?.message.includes("NOT_SUBMITTABLE"));
  const recipientAfter=await db.from("bapperida_recommendation_recipients").select("opd_id").eq("recommendation_id",recommendationId);if(recipientAfter.error)throw recipientAfter.error;assert.deepEqual(new Set(recipientAfter.data.map((row)=>row.opd_id)),new Set(recipients));
  console.log("Workflow rekomendasi BAPPERIDA: draft, recipient, submit, duplicate guard PASS");
}finally{await cleanupBapperidaFixtures();}
