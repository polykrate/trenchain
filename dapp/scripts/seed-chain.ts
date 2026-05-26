/**
 * Seed script: reads JSON rule data and submits them as batched sudo
 * extrinsics to the local TrenchWorld parachain.
 *
 * All identifiers are now code libellé (fixed-size byte arrays).
 *
 * Usage: npx tsx scripts/seed-chain.ts
 */
import { DedotClient, WsProvider } from 'dedot';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { Keyring } from '@polkadot/keyring';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { ParachainTemplateRuntimeApi } from '../src/chain-api/parachain-template-runtime';
import type {
  ParachainTemplateRuntimeRuntimeCallLike,
  TcPrimitivesKeywordKind,
  TcPrimitivesAlignment,
  TcPrimitivesBattlekitType,
  TcPrimitivesWeaponRange,
  TcPrimitivesStatProfile,
  TcPrimitivesBaseSize,
  TcPrimitivesMovementType,
} from '../src/chain-api/parachain-template-runtime/types';
import type { FixedBytes } from 'dedot/codecs';

const WS_ENDPOINT = process.env.WS_ENDPOINT || 'ws://127.0.0.1:9944';
const DATA_DIR = resolve(import.meta.dirname, '../src/data/rules');

function loadJson(relativePath: string) {
  return JSON.parse(readFileSync(resolve(DATA_DIR, relativePath), 'utf-8'));
}

function toCode32(str: string): FixedBytes<32> {
  const buf = new Uint8Array(32);
  const encoded = new TextEncoder().encode(str);
  buf.set(encoded.slice(0, 32));
  return `0x${Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')}` as FixedBytes<32>;
}

function toCode16(str: string): FixedBytes<16> {
  const buf = new Uint8Array(16);
  const encoded = new TextEncoder().encode(str);
  buf.set(encoded.slice(0, 16));
  return `0x${Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')}` as FixedBytes<16>;
}

function mapBattlekitType(raw: string): TcPrimitivesBattlekitType {
  const map: Record<string, TcPrimitivesBattlekitType> = {
    OneHanded: 'OneHanded', TwoHanded: 'TwoHanded', Grenade: 'Grenade',
    Armour: 'Armour', Shield: 'Shield', Equipment: 'Equipment', Special: 'Special',
  };
  return map[raw] || 'Equipment';
}

function mapWeaponRange(raw: any): TcPrimitivesWeaponRange {
  if (!raw) return { type: 'None' };
  if (raw === 'Melee') return { type: 'Melee' };
  if (raw === 'None') return { type: 'None' };
  if (typeof raw === 'object') {
    if (raw.type === 'Melee') return { type: 'Melee' };
    if (raw.type === 'None') return { type: 'None' };
    if (raw.inches) return { type: 'Ranged', value: { inches: raw.inches } };
    return { type: 'None' };
  }
  const match = String(raw).match(/(\d+)/);
  if (match) return { type: 'Ranged', value: { inches: parseInt(match[1]) } };
  return { type: 'None' };
}

function mapBaseSize(raw: string): TcPrimitivesBaseSize {
  if (raw?.includes('x')) {
    const [w, l] = raw.replace('mm', '').split('x').map(Number);
    return { type: 'Oval', value: { widthMm: w, lengthMm: l } };
  }
  return { type: 'Round', value: { diameterMm: parseInt(raw) || 32 } };
}

function mapMovementType(raw: string): TcPrimitivesMovementType {
  return raw === 'Flying' ? 'Flying' : 'Infantry';
}

async function main() {
  console.log('Initializing crypto...');
  await cryptoWaitReady();
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');

  console.log(`Connecting to ${WS_ENDPOINT}...`);
  const client = await DedotClient.new<ParachainTemplateRuntimeApi>({
    provider: new WsProvider(WS_ENDPOINT),
    rpcVersion: 'legacy',
  });
  console.log('Connected!\n');

  // ─── 1. Keywords ─────────────────────────────────────────────────
  const { keywords } = loadJson('keywords.json');
  await seedBatch(client, alice, 'Keywords', keywords.map((kw: any) => ({
    pallet: 'Keyword',
    palletCall: {
      name: 'RegisterKeyword',
      params: {
        code: toCode32(kw.code),
        name: kw.name,
        description: (kw.description || '').slice(0, 256),
        kind: (kw.kind === 'Effect' ? 'Effect' : 'Tag') as TcPrimitivesKeywordKind,
      },
    },
  })), async () => {
    const sample = await client.query.keyword.keywords(toCode32(keywords[0].code));
    return sample ? `verified (${keywords[0].code})` : `FAILED`;
  });

  // ─── 2. Skills ───────────────────────────────────────────────────
  const { skills } = loadJson('skills.json');
  await seedBatch(client, alice, 'Skills', skills.map((s: any) => ({
    pallet: 'Skill',
    palletCall: {
      name: 'RegisterSkill',
      params: {
        code: toCode32(s.code),
        name: s.name,
        description: (s.description || '').slice(0, 512),
      },
    },
  })), async () => {
    const sample = await client.query.skill.skills(toCode32(skills[0].code));
    return sample ? `verified (${skills[0].code})` : `FAILED`;
  });

  // ─── 3. Factions ─────────────────────────────────────────────────
  const factionFiles = ['heretic_legions', 'trench_pilgrims', 'new_antioch', 'iron_sultanate', 'black_grail', 'the_court'];
  const factionCalls: ParachainTemplateRuntimeRuntimeCallLike[] = [];

  for (const f of factionFiles) {
    const data = loadJson(`entries/${f}.json`);
    const alignment: TcPrimitivesAlignment =
      ['HERETIC', 'BLACK_GRAIL', 'COURT'].includes(data.faction_code) ? 'Fallen' : 'Faithful';
    factionCalls.push({
      pallet: 'Faction',
      palletCall: {
        name: 'RegisterFaction',
        params: {
          code: toCode16(data.faction_code),
          name: data.faction_code,
          alignment,
          keywords: [],
        },
      },
    });
  }
  await seedBatch(client, alice, 'Factions', factionCalls, async () => {
    const firstData = loadJson(`entries/${factionFiles[0]}.json`);
    const sample = await client.query.faction.factions(toCode16(firstData.faction_code));
    return sample ? `verified (${firstData.faction_code})` : `FAILED`;
  });

  // ─── 4. Battlekit ────────────────────────────────────────────────
  const bkCategories = ['melee_weapons', 'ranged_weapons', 'grenades', 'armour', 'shields', 'equipment'];
  const allItems: any[] = [];
  for (const cat of bkCategories) {
    const { items } = loadJson(`battlekit/${cat}.json`);
    allItems.push(...items);
  }

  await seedBatch(client, alice, 'Battlekit', allItems.map((item: any) => ({
    pallet: 'Battlekit',
    palletCall: {
      name: 'RegisterItem',
      params: {
        code: toCode32(item.code),
        name: item.name,
        description: (item.description || '').slice(0, 256),
        battlekitType: mapBattlekitType(item.battlekit_type),
        range: mapWeaponRange(item.range),
        cost: item.cost || 0,
        keywords: (item.keywords || []).map((k: string) => toCode32(k)),
      },
    },
  })), async () => {
    const sample = await client.query.battlekit.items(toCode32(allItems[0].code));
    return sample ? `verified (${allItems[0].code})` : `FAILED`;
  });

  // ─── 5. Armoury ─────────────────────────────────────────────────
  const armouryCalls: ParachainTemplateRuntimeRuntimeCallLike[] = [];
  for (const f of factionFiles) {
    const data = loadJson(`armoury/${f}.json`);
    for (const entry of data.items) {
      armouryCalls.push({
        pallet: 'Armoury',
        palletCall: {
          name: 'AddEntry',
          params: {
            faction: toCode16(data.faction_code),
            item: toCode32(entry.item_code),
          },
        },
      });
    }
  }
  await seedBatch(client, alice, 'Armoury', armouryCalls, async () => {
    const firstArm = loadJson(`armoury/${factionFiles[0]}.json`);
    const sample = await client.query.armoury.entries([
      toCode16(firstArm.faction_code),
      toCode32(firstArm.items[0].item_code),
    ]);
    return sample !== undefined ? `verified` : `FAILED`;
  });

  // ─── 6. Entries ─────────────────────────────────────────────────
  const entryCalls: ParachainTemplateRuntimeRuntimeCallLike[] = [];
  for (const f of factionFiles) {
    const data = loadJson(`entries/${f}.json`);
    for (const entry of data.entries) {
      const profile: TcPrimitivesStatProfile = {
        movementInches: entry.profile.movement_inches,
        movementType: mapMovementType(entry.profile.movement_type),
        ranged: entry.profile.ranged ?? undefined,
        melee: entry.profile.melee ?? undefined,
        armour: entry.profile.armour,
        base: mapBaseSize(entry.profile.base),
      };
      entryCalls.push({
        pallet: 'Entry',
        palletCall: {
          name: 'RegisterEntry',
          params: {
            code: toCode32(entry.id),
            name: entry.name,
            faction: toCode16(data.faction_code),
            minCount: entry.min_count,
            maxCount: entry.max_count ?? undefined,
            cost: entry.cost,
            profile,
            description: entry.name.slice(0, 256),
            keywords: (entry.keywords || []).map((k: string) => toCode32(k)),
          },
        },
      });
    }
  }
  await seedBatch(client, alice, 'Entries', entryCalls, async () => {
    const firstData = loadJson(`entries/${factionFiles[0]}.json`);
    const sample = await client.query.entry.entries(toCode32(firstData.entries[0].id));
    return sample ? `verified (${firstData.entries[0].id})` : `FAILED`;
  });

  // ─── 7. Patrons ─────────────────────────────────────────────────
  const { patrons } = loadJson('patrons.json');
  await seedBatch(client, alice, 'Patrons', patrons.map((p: any) => ({
    pallet: 'Patron',
    palletCall: {
      name: 'RegisterPatron',
      params: {
        code: toCode32(p.code),
        name: p.name,
        description: (p.description || '').slice(0, 256),
        factions: (p.factions || []).map((f: string) => toCode16(f)),
        skills: (p.skills || []).map((s: string) => toCode32(s)),
      },
    },
  })), async () => {
    const sample = await client.query.patron.patrons(toCode32(patrons[0].code));
    return sample ? `verified (${patrons[0].code})` : `FAILED`;
  });

  // ─── 8. Buildings ───────────────────────────────────────────────
  const { buildings } = loadJson('economy.json');
  await seedBatch(client, alice, 'Buildings', buildings.map((b: any) => ({
    pallet: 'Building',
    palletCall: {
      name: 'RegisterBuilding',
      params: {
        code: toCode32(b.id),
        name: b.name,
        production: (b.produces?.[0]?.output || 0) as number,
        costDucats: (b.build_cost?.find((c: any) => c.resource === 'ducats')?.amount || 0) as number,
        allowedTerrains: (b.allowed_terrain || []).slice(0, 8).map((t: string) => toCode16(t)),
      },
    },
  })), async () => {
    const sample = await client.query.building.buildingDefs(toCode32(buildings[0].id));
    return sample ? `verified (${buildings[0].id})` : `FAILED`;
  });

  console.log('\nAll reference data seeded!');
  await client.disconnect();
  process.exit(0);
}

async function seedBatch(
  client: DedotClient<ParachainTemplateRuntimeApi>,
  signer: any,
  label: string,
  calls: ParachainTemplateRuntimeRuntimeCallLike[],
  verify: () => Promise<string>,
) {
  if (calls.length === 0) { console.log(`[${label}] Nothing to seed.`); return; }

  const BATCH_SIZE = 50;
  const t0 = Date.now();
  const chunks = Math.ceil(calls.length / BATCH_SIZE);

  for (let i = 0; i < calls.length; i += BATCH_SIZE) {
    const chunk = calls.slice(i, i + BATCH_SIZE);

    const batchCall: ParachainTemplateRuntimeRuntimeCallLike = {
      pallet: 'Utility',
      palletCall: { name: 'BatchAll', params: { calls: chunk } },
    };

    try {
      await client.tx.sudo.sudo(batchCall).signAndSend(signer).untilFinalized();
    } catch (err: any) {
      console.error(`  [${label}] chunk ${Math.floor(i / BATCH_SIZE) + 1}/${chunks} FAILED: ${err.message?.slice(0, 120)}`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const storageInfo = await verify();
  console.log(`[${label}] ${calls.length} calls in ${chunks} batch(es) -> ${storageInfo} (${elapsed}s)`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
