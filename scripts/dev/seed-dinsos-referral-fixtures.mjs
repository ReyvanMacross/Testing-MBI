import { seedDinsosReferralFixtures } from "./dinsos-referral-fixture-lib.mjs";
console.log(JSON.stringify(await seedDinsosReferralFixtures(), null, 2));
