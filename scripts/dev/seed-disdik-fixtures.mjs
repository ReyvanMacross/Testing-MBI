import { seedDisdikFixtures } from "./disdik-fixture-lib.mjs";

const state = await seedDisdikFixtures();
console.log(`Fixture Disdik siap: ${Object.keys(state.referrals).length} referral terkontrol.`);
