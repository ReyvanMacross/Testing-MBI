import { seedDP3AFixtures } from "./dp3a-fixture-lib.mjs";

const state = await seedDP3AFixtures();
console.log(`Fixture DP3A siap: ${Object.keys(state.referrals).length} referral terkontrol.`);