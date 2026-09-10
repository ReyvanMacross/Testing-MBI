import { seedDiskopFixtures } from "./diskop-fixture-lib.mjs";

const state = await seedDiskopFixtures();
console.log(`Fixture Diskop siap: ${Object.keys(state.referrals).length} referral terkontrol.`);
