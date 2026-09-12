import assert from "node:assert/strict";

import { cleanupWalikotaFixtures, seedWalikotaFixtures } from "./dev/walikota-fixture-lib.mjs";

try {
  const { db, bapperidaActor, walikotaActor, recommendationId, version, targetOpdIds } = await seedWalikotaFixtures();
  if (process.env.WALIKOTA_FIXTURE_TRACE === "true") console.log("walikota workflow: seed PASS");
  const unauthorized = await db.rpc("walikota_review_recommendation", {
    p_recommendation_id: recommendationId, p_expected_version: version,
    p_actor_id: bapperidaActor.id, p_actor_opd_id: bapperidaActor.opd_id,
    p_action: "APPROVE", p_priority_level: "TINGGI", p_leader_note: "Aktor Bapperida tidak boleh memutuskan rekomendasi sendiri.", p_dispositions: [],
  });
  if (process.env.WALIKOTA_FIXTURE_TRACE === "true") console.log("walikota workflow: isolation RPC returned");
  assert.ok(unauthorized.error?.message.includes("WALIKOTA_ACTOR_REQUIRED"));
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const reviewed = await db.rpc("walikota_review_recommendation", {
    p_recommendation_id: recommendationId, p_expected_version: version,
    p_actor_id: walikotaActor.id, p_actor_opd_id: walikotaActor.opd_id,
    p_action: "APPROVE", p_priority_level: "MENDESAK",
    p_leader_note: "Setujui prioritas wilayah dan laporkan perkembangan lintas perangkat daerah setiap pekan.",
    p_dispositions: targetOpdIds.map((opdId) => ({ opdId, instruction: "Koordinasikan rencana tindak lanjut wilayah prioritas dan laporkan progres terukur.", dueDate: tomorrow })),
  });
  if (process.env.WALIKOTA_FIXTURE_TRACE === "true") console.log("walikota workflow: review RPC returned");
  if (reviewed.error) throw reviewed.error;
  assert.equal(reviewed.data.status, "DITINDAKLANJUTI");
  assert.equal(reviewed.data.dispositionCount, 2);
  const recommendation = await db.from("bapperida_recommendations").select("status,version,mayor_note").eq("id", recommendationId).single();
  if (process.env.WALIKOTA_FIXTURE_TRACE === "true") console.log("walikota workflow: recommendation read PASS");
  const decision = await db.from("walikota_decisions").select("action,priority_level,recommendation_version").eq("id", reviewed.data.decisionId).single();
  if (process.env.WALIKOTA_FIXTURE_TRACE === "true") console.log("walikota workflow: decision read PASS");
  const dispositions = await db.from("walikota_dispositions").select("target_opd_id,status").eq("decision_id", reviewed.data.decisionId);
  if (process.env.WALIKOTA_FIXTURE_TRACE === "true") console.log("walikota workflow: dispositions read PASS");
  const events = await db.from("walikota_decision_events").select("event_type").eq("decision_id", reviewed.data.decisionId);
  if (process.env.WALIKOTA_FIXTURE_TRACE === "true") console.log("walikota workflow: events read PASS");
  for (const result of [recommendation, decision, dispositions, events]) if (result.error) throw result.error;
  assert.equal(recommendation.data.status, "DITINDAKLANJUTI");
  assert.equal(decision.data.action, "APPROVE");
  assert.equal(decision.data.priority_level, "MENDESAK");
  assert.equal(dispositions.data.length, 2);
  assert.deepEqual(new Set(events.data.map((event) => event.event_type)), new Set(["APPROVED", "DISPOSITION_ISSUED"]));
  console.log("Workflow WALIKOTA: isolation, approval, priority, disposition, dan audit event PASS");
} finally { await cleanupWalikotaFixtures(); }
