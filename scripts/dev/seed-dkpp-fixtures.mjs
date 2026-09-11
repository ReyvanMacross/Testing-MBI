import { seedDkppFixtures } from "./dkpp-fixture-lib.mjs";

const state = await seedDkppFixtures();
console.log(`Fixture Dkpp siap: ${Object.keys(state.referrals).length} referral terkontrol.`);
