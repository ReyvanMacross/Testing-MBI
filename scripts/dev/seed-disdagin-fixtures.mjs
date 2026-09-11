import { seedDisdaginFixtures } from "./disdagin-fixture-lib.mjs";

const state = await seedDisdaginFixtures();
console.log(`Fixture Disdagin siap: ${Object.keys(state.referrals).length} referral terkontrol.`);
