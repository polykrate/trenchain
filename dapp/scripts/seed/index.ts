/**
 * Chain seeding orchestrator.
 *
 * Usage:
 *   npx tsx scripts/seed/index.ts              # seed everything
 *   npx tsx scripts/seed/index.ts compendium   # seed only compendium
 *   npx tsx scripts/seed/index.ts geography theatre  # seed geography + theatre
 *   npx tsx scripts/seed/index.ts --list       # list available modules
 *   npx tsx scripts/seed/index.ts --verify     # only run verification
 *
 * Modules (in dependency order):
 *   compendium  - keywords, skills, factions, battlekit, armoury, entries, patrons
 *   economy     - buildings, resources
 *   geography   - countries, regions, tiles, map config, POIs
 *   theatre     - theatre scenarios (depends on geography)
 *   rules       - equiprules, campaign, exploration, terrain (depends on compendium)
 *
 * Environment:
 *   WS_ENDPOINT=ws://127.0.0.1:9944  (default)
 */
import { createClient, toCode32, toCode16, loadJson } from './shared';
import { seedCompendium } from './compendium';
import { seedEconomy } from './economy';
import { seedGeography } from './geography';
import { seedTheatre } from './theatre';
import { seedRules } from './rules';
import { seedLogistics } from './logistics';

process.on('uncaughtException', (err) => {
  console.error(`\n⚠ Uncaught exception: ${(err as any).message?.slice(0, 200) || err}`);
});
process.on('unhandledRejection', (err: any) => {
  console.error(`\n⚠ Unhandled rejection: ${err?.message?.slice(0, 200) || err}`);
});

const MODULES: Record<string, { fn: (client: any, alice: any) => Promise<void>; deps: string[] }> = {
  compendium: { fn: seedCompendium, deps: [] },
  economy: { fn: seedEconomy, deps: [] },
  geography: { fn: seedGeography, deps: [] },
  theatre: { fn: seedTheatre, deps: ['geography'] },
  rules: { fn: seedRules, deps: ['compendium'] },
  logistics: { fn: seedLogistics, deps: ['geography'] },
};

const MODULE_ORDER = ['compendium', 'economy', 'geography', 'theatre', 'rules', 'logistics'];

function countExpected() {
  const { keywords } = loadJson('keywords.json');
  const { skills } = loadJson('skills.json');
  const { patrons } = loadJson('patrons.json');
  const { buildings } = loadJson('economy.json');
  const bkCats = ['melee_weapons', 'ranged_weapons', 'grenades', 'armour', 'shields', 'equipment'];
  let bkCount = 0;
  for (const cat of bkCats) bkCount += loadJson(`battlekit/${cat}.json`).items.length;
  const factionFiles = ['heretic_legions', 'trench_pilgrims', 'new_antioch', 'iron_sultanate', 'black_grail', 'the_court'];
  let entryCount = 0, armouryCount = 0;
  for (const f of factionFiles) {
    entryCount += loadJson(`entries/${f}.json`).entries.length;
    armouryCount += loadJson(`armoury/${f}.json`).items.length;
  }
  const countries = Object.keys(loadJson('hex_countries.json'));
  const regions = Object.keys(loadJson('hex_regions.json'));
  return {
    keywords: keywords.length, skills: skills.length, factions: factionFiles.length,
    battlekit: bkCount, entries: entryCount, armoury: armouryCount,
    patrons: patrons.length, buildings: buildings.length,
    countries: countries.length, regions: regions.length,
  };
}

async function verify(client: any) {
  const expected = countExpected();
  console.log('\n📋 Verification (expected → on-chain):');
  const checks: [string, number | null, () => Promise<number | string>][] = [
    ['Keywords', expected.keywords, async () => (await client.query.keyword.keywords.entries()).length],
    ['Factions', expected.factions, async () => (await client.query.faction.factions.entries()).length],
    ['Battlekit', expected.battlekit, async () => (await client.query.battlekit.items.entries()).length],
    ['Entries', expected.entries, async () => (await client.query.entry.entries.entries()).length],
    ['Armoury', expected.armoury, async () => (await client.query.armoury.entries.entries()).length],
    ['Patrons', expected.patrons, async () => (await client.query.patron.patrons.entries()).length],
    ['Buildings', expected.buildings, async () => (await client.query.building.buildingDefs.entries()).length],
    ['Countries', expected.countries, async () => (await client.query.country.countries.entries()).length],
    ['Regions', expected.regions, async () => (await client.query.region.regions.entries()).length],
    ['Tiles', null, async () => await client.query.tile.tileCount()],
    ['POIs', null, async () => await client.query.poi.poiCount()],
    ['Theatre', null, async () => (await client.query.theatre.theatres.entries()).length],
    ['Equiprules', null, async () => `handSlots=${await client.query.equiprules.handSlots()}`],
    ['CampaignRules', null, async () => {
      const v = await client.query.campaignRules.victory();
      return v ? `w=${v.winner} l=${v.loser} d=${v.draw}` : '✗ missing';
    }],
    ['ExplorationRules', null, async () => `loot×${await client.query.explorationRules.lootMultiplier()}`],
    ['TerrainRules', null, async () => `${(await client.query.terrainRules.categories.entries()).length} categories`],
  ];

  let allOk = true;
  for (const [name, exp, check] of checks) {
    try {
      const result = await check();
      if (exp !== null) {
        const actual = typeof result === 'number' ? result : parseInt(String(result));
        const match = actual === exp;
        if (!match) allOk = false;
        console.log(`  ${match ? '✓' : '✗'} ${name}: ${actual}/${exp}${match ? '' : ' ← MISMATCH'}`);
      } else {
        const ok = typeof result === 'number' ? result > 0 : !String(result).includes('✗');
        if (!ok) allOk = false;
        console.log(`  ${ok ? '✓' : '✗'} ${name}: ${result}`);
      }
    } catch (e: any) {
      allOk = false;
      console.log(`  ✗ ${name}: error (${e.message?.slice(0, 60)})`);
    }
  }
  return allOk;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    console.log('Available seed modules:');
    for (const name of MODULE_ORDER) {
      const mod = MODULES[name];
      const depsStr = mod.deps.length ? ` (depends on: ${mod.deps.join(', ')})` : '';
      console.log(`  ${name}${depsStr}`);
    }
    process.exit(0);
  }

  console.log('Initializing...');
  const { client, alice } = await createClient();
  console.log('Connected!\n');

  if (args.includes('--verify')) {
    const ok = await verify(client);
    await client.disconnect();
    process.exit(ok ? 0 : 1);
  }

  const requested = args.filter(a => !a.startsWith('-'));
  const modulesToRun = requested.length > 0
    ? MODULE_ORDER.filter(m => requested.includes(m))
    : MODULE_ORDER;

  if (requested.length > 0) {
    const unknown = requested.filter(r => !MODULES[r]);
    if (unknown.length) {
      console.error(`Unknown modules: ${unknown.join(', ')}`);
      console.error(`Available: ${MODULE_ORDER.join(', ')}`);
      process.exit(1);
    }
  }

  const t0 = Date.now();
  for (const name of modulesToRun) {
    await MODULES[name].fn(client, alice);
  }
  const total = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n⏱  Total: ${total}s`);

  const allOk = await verify(client);

  console.log(allOk ? '\n✅ SEED COMPLETE' : '\n⚠️  SEED COMPLETE (with mismatches)');
  await client.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
