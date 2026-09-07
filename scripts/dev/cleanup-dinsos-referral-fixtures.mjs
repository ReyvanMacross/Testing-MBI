import { cleanupDinsosReferralFixtures } from "./dinsos-referral-fixture-lib.mjs";
console.log(JSON.stringify({ deleted: await cleanupDinsosReferralFixtures() }, null, 2));
