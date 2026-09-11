import { seedCiptaBintarFixtures } from "./cipta-bintar-fixture-lib.mjs";

const state = await seedCiptaBintarFixtures();
console.log(`Fixture CiptaBintar siap: ${Object.keys(state.referrals).length} referral terkontrol.`);
