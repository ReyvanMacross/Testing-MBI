import { seedDisnakerFixtures } from "./disnaker-fixture-lib.mjs";

const state = await seedDisnakerFixtures();
console.log(`Fixture Disnaker siap: ${Object.keys(state.referrals).length} referral terkontrol.`);
