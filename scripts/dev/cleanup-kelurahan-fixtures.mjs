import { cleanupKelurahanFixtures } from "./kelurahan-fixture-lib.mjs";
const result=await cleanupKelurahanFixtures();
console.log(`Cleanup fixture Kelurahan: ${result.citizens} warga, ${result.proposals} usulan, ${result.remaining} residu.`);
