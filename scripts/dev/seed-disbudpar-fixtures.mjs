import { seedDisbudparFixtures } from "./disbudpar-fixture-lib.mjs";

const state = await seedDisbudparFixtures();
console.log(`Fixture Disbudpar siap: ${Object.keys(state.referrals).length} referral terkontrol.`);
