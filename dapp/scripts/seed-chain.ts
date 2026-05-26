/**
 * Seed script: reads JSON rule data and submits them as sudo extrinsics.
 * Uses RuntimeCallLike objects for dedot encoding.
 * Entries are sent individually (not batched) to avoid encoding issues.
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
  TcPrimitivesCostType,
  TcPrimitivesExplorationTiming,
  TcPrimitivesExplorationTable,
  PalletEntryAbilityDef,
  PalletCampaignRulesThresholdRow,
  PalletCampaignRulesVictoryConfig,
  PalletCampaignRulesTraumaRow,
  PalletCampaignRulesPhaseStep,
  PalletCampaignRulesPromotionRules,
  PalletCampaignRulesQuartermasterAction,
  PalletExplorationRulesDiceProgressionRow,
  PalletExplorationRulesTableProgressionRow,
  PalletExplorationRulesExplorationEvent,
  PalletExplorationRulesExplorationSkillDef,
  PalletTerrainRulesTerrainCategory,
  PalletTerrainRulesTerrainPiece,
  PalletTerrainRulesBattlefieldArchetype,
  PalletTerrainRulesCombatModifierConfig,
} from '../src/chain-api/parachain-template-runtime/types';
import type { FixedBytes } from 'dedot/codecs';

process.on('uncaughtException', (err) => {
  console.error(`\n⚠ Uncaught exception: ${(err as any).message?.slice(0, 200) || err}`);
});
process.on('unhandledRejection', (err: any) => {
  console.error(`\n⚠ Unhandled rejection: ${err?.message?.slice(0, 200) || err}`);
});

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

function mapCostType(raw: string | undefined): TcPrimitivesCostType {
  return raw === 'glory' ? 'Glory' : 'Ducats';
}

function mapExplorationTiming(raw: string): TcPrimitivesExplorationTiming {
  if (raw === 'before_roll') return 'BeforeRoll';
  if (raw === 'after_modify') return 'AfterModify';
  return 'AfterRoll';
}

function mapExplorationTable(raw: string): TcPrimitivesExplorationTable {
  if (raw === 'rare') return 'Rare';
  if (raw === 'legendary') return 'Legendary';
  return 'Common';
}

async function sudoSend(
  client: DedotClient<ParachainTemplateRuntimeApi>,
  signer: any,
  call: ParachainTemplateRuntimeRuntimeCallLike,
): Promise<boolean> {
  try {
    await client.tx.sudo.sudo(call).signAndSend(signer).untilFinalized();
    return true;
  } catch (e: any) {
    console.error(`    ⚠ ${e.message?.slice(0, 100)}`);
    return false;
  }
}

async function sudoBatch(
  client: DedotClient<ParachainTemplateRuntimeApi>,
  signer: any,
  label: string,
  calls: ParachainTemplateRuntimeRuntimeCallLike[],
  batchSize = 50,
): Promise<void> {
  if (calls.length === 0) return;
  const t0 = Date.now();
  for (let i = 0; i < calls.length; i += batchSize) {
    const chunk = calls.slice(i, i + batchSize);
    const batchCall: ParachainTemplateRuntimeRuntimeCallLike = {
      pallet: 'Utility',
      palletCall: { name: 'Batch', params: { calls: chunk } },
    };
    await sudoSend(client, signer, batchCall);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[${label}] ${calls.length} calls (${elapsed}s)`);
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

  const factionFiles = ['heretic_legions', 'trench_pilgrims', 'new_antioch', 'iron_sultanate', 'black_grail', 'the_court'];

  // ─── 1. Keywords ─────────────────────────────────────────────────
  const { keywords } = loadJson('keywords.json');
  await sudoBatch(client, alice, 'Keywords', keywords.map((kw: any) => ({
    pallet: 'Keyword', palletCall: { name: 'RegisterKeyword', params: {
      code: toCode32(kw.code), name: kw.name,
      description: (kw.description || '').slice(0, 512),
      kind: (kw.kind === 'Effect' ? 'Effect' : 'Tag') as TcPrimitivesKeywordKind,
    }},
  })));

  // ─── 2. Skills ───────────────────────────────────────────────────
  const { skills } = loadJson('skills.json');
  await sudoBatch(client, alice, 'Skills', skills.map((s: any) => ({
    pallet: 'Skill', palletCall: { name: 'RegisterSkill', params: {
      code: toCode32(s.code), name: s.name, description: (s.description || '').slice(0, 512),
    }},
  })));

  // ─── 3. Factions ─────────────────────────────────────────────────
  const factionMeta: Record<string, { name: string; description: string }> = {
    HERETIC: { name: 'Heretic Legions', description: 'The damned armies that pour through the gates of Hell, led by infernal nobles and dark priests. Their ranks include twisted humans, demons, and unholy constructs.' },
    PILGRIM: { name: 'Trench Pilgrims', description: 'Zealous faithful who march into battle with nothing but devotion and improvised weapons. Their numbers are legion and their faith unbreakable.' },
    ANTIOCH: { name: 'Principality of New Antioch', description: 'The military might of Christendom reborn. Professional soldiers, elite knights, and advanced weaponry defend the last bastion of humanity.' },
    SULTANATE: { name: 'Sultanate of the Iron Wall', description: 'The mighty Sultanate stands as an iron wall against the forces of Hell. Janissaries, Sipahi cavalry, and ancient traditions forge their strength.' },
    BLACK_GRAIL: { name: 'Cult of the Black Grail', description: 'Plague-ridden servants of Beelzebub who spread corruption and disease. Their bodies are twisted by the Black Grail infection into monstrous forms.' },
    COURT: { name: 'Court of the Seven-Headed Serpent', description: 'A cabal of powerful sorcerers and their demonic patrons. They weave dark magic and plot the downfall of humanity from the shadows.' },
  };
  await sudoBatch(client, alice, 'Factions', factionFiles.map(f => {
    const data = loadJson(`entries/${f}.json`);
    const meta = factionMeta[data.faction_code] || { name: data.faction_code, description: '' };
    const alignment: TcPrimitivesAlignment =
      ['HERETIC', 'BLACK_GRAIL', 'COURT'].includes(data.faction_code) ? 'Fallen' : 'Faithful';
    return { pallet: 'Faction', palletCall: { name: 'RegisterFaction', params: {
      code: toCode16(data.faction_code), name: meta.name,
      description: meta.description, alignment, keywords: [],
    }}} as ParachainTemplateRuntimeRuntimeCallLike;
  }));

  // ─── 4. Battlekit ─────────────────────────────────────────────────
  const bkCategories = ['melee_weapons', 'ranged_weapons', 'grenades', 'armour', 'shields', 'equipment'];
  const allItems: any[] = [];
  for (const cat of bkCategories) { allItems.push(...loadJson(`battlekit/${cat}.json`).items); }

  await sudoBatch(client, alice, 'Battlekit', allItems.map((item: any) => ({
    pallet: 'Battlekit', palletCall: { name: 'RegisterItem', params: {
      code: toCode32(item.code), name: item.name,
      description: (item.description || '').slice(0, 256),
      battlekitType: mapBattlekitType(item.battlekit_type),
      range: mapWeaponRange(item.range), cost: item.cost || 0,
      keywords: (item.keywords || []).map((k: string) => toCode32(k)),
      specialRules: (item.special_rules || '').slice(0, 512),
    }},
  })));

  // ─── 5. Armoury ──────────────────────────────────────────────────
  const armouryCalls: ParachainTemplateRuntimeRuntimeCallLike[] = [];
  for (const f of factionFiles) {
    const data = loadJson(`armoury/${f}.json`);
    for (const entry of data.items) {
      armouryCalls.push({ pallet: 'Armoury', palletCall: { name: 'AddEntry', params: {
        faction: toCode16(data.faction_code), item: toCode32(entry.item_code),
        cost: entry.cost || 0, costType: mapCostType(entry.cost_type),
        tags: (entry.tags || []).map((t: string) => toCode32(t)),
      }}});
    }
  }
  await sudoBatch(client, alice, 'Armoury', armouryCalls);

  // ─── 6. Entries (individual — no batch, avoids encoding bug) ──────
  const entryCalls: ParachainTemplateRuntimeRuntimeCallLike[] = [];
  const abilityCalls: ParachainTemplateRuntimeRuntimeCallLike[] = [];
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
      entryCalls.push({ pallet: 'Entry', palletCall: { name: 'RegisterEntry', params: {
        code: toCode32(entry.id), name: entry.name, faction: toCode16(data.faction_code),
        minCount: entry.min_count, maxCount: entry.max_count ?? undefined,
        cost: entry.cost, profile,
        description: (entry.description || entry.name).slice(0, 1024),
        lore: (entry.lore || '').slice(0, 2048),
        battlekitRules: (entry.battlekit_rules || '').slice(0, 512),
        compositionNote: (entry.composition_note || '').slice(0, 256),
        keywords: (entry.keywords || []).map((k: string) => toCode32(k)),
        includedBattlekit: (entry.included_battlekit || []).map((b: string) => toCode32(b)),
      }}});
      if (entry.abilities?.length > 0) {
        abilityCalls.push({ pallet: 'Entry', palletCall: { name: 'SetEntryAbilities', params: {
          code: toCode32(entry.id),
          abilities: entry.abilities.map((a: any) => ({
            name: a.name.slice(0, 64), description: a.description.slice(0, 512),
          })),
        }}});
      }
    }
  }

  // Send entries one by one (batch encoding crashes for this pallet)
  const t0 = Date.now();
  let ok = 0;
  for (const call of entryCalls) {
    if (await sudoSend(client, alice, call)) ok++;
  }
  console.log(`[Entries] ${ok}/${entryCalls.length} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  const t1 = Date.now();
  let okAb = 0;
  for (const call of abilityCalls) {
    if (await sudoSend(client, alice, call)) okAb++;
  }
  console.log(`[Abilities] ${okAb}/${abilityCalls.length} (${((Date.now() - t1) / 1000).toFixed(1)}s)`);

  // ─── 7. Patrons ──────────────────────────────────────────────────
  const { patrons } = loadJson('patrons.json');
  await sudoBatch(client, alice, 'Patrons', patrons.map((p: any) => ({
    pallet: 'Patron', palletCall: { name: 'RegisterPatron', params: {
      code: toCode32(p.code), name: p.name, description: (p.description || '').slice(0, 256),
      factions: (p.factions || []).map((f: string) => toCode16(f)),
      skills: (p.skills || []).map((s: string) => toCode32(s)),
    }},
  })));

  // ─── 8. Buildings ─────────────────────────────────────────────────
  const { buildings } = loadJson('economy.json');
  await sudoBatch(client, alice, 'Buildings', buildings.map((b: any) => ({
    pallet: 'Building', palletCall: { name: 'RegisterBuilding', params: {
      code: toCode32(b.id), name: b.name,
      produces: (b.produces || []).slice(0, 8).map((p: any) => [toCode16(p.resource), p.output]),
      buildCost: (b.build_cost || []).slice(0, 8).map((c: any) => [toCode16(c.resource), c.amount]),
      allowedTerrains: (b.allowed_terrain || []).slice(0, 8).map((t: string) => toCode16(t)),
      upgradeLevels: b.upgrade_levels || 1,
    }},
  })));

  // ─── 9. Resources ────────────────────────────────────────────────
  const resources = loadJson('resources.json');
  await sudoBatch(client, alice, 'Resources', resources.map((r: any) => ({
    pallet: 'Building', palletCall: { name: 'RegisterResource', params: {
      code: toCode16(r.code), name: toCode32(r.name),
    }},
  })));

  // ─── 10. Countries ────────────────────────────────────────────────
  const countriesData = loadJson('hex_countries.json');
  const countryEntries = Object.entries(countriesData) as [string, any][];
  await sudoBatch(client, alice, 'Countries', countryEntries.map(([code, c]) => ({
    pallet: 'Country', palletCall: { name: 'RegisterCountry', params: {
      code: toCode32(code), name: c.name,
      alignment: (c.faction === 'HERETIC' ? 'Fallen' : c.faction === 'NEUTRAL' ? 'Neutral' : 'Faithful') as TcPrimitivesAlignment,
      regions: (c.regions || []).slice(0, 32).map((r: string) => toCode32(r)),
    }},
  })));

  // ─── 11. Regions ──────────────────────────────────────────────────
  const regionsData = loadJson('hex_regions.json');
  const regionEntries = Object.entries(regionsData) as [string, any][];
  await sudoBatch(client, alice, 'Regions', regionEntries.map(([code, r]) => ({
    pallet: 'Region', palletCall: { name: 'RegisterRegion', params: {
      code: toCode32(code), name: r.name, country: toCode32(r.country),
      control: { type: 'Sovereign' },
    }},
  })));

  // ─── 12. Tiles ────────────────────────────────────────────────────
  const hexMap = loadJson('hex_map.json');
  const allTiles: any[] = hexMap.tiles.filter((t: any) => t.t !== 'sea');
  const tileToRegion: Record<string, string> = {};
  for (const [regionCode, regionData] of regionEntries) {
    for (const [q, r] of (regionData as any).tiles || []) {
      tileToRegion[`${q},${r}`] = regionCode;
    }
  }
  const tileCalls: ParachainTemplateRuntimeRuntimeCallLike[] = [];
  for (let i = 0; i < allTiles.length; i += 200) {
    const chunk = allTiles.slice(i, i + 200);
    tileCalls.push({ pallet: 'Tile', palletCall: { name: 'RegisterTilesBatch', params: {
      tiles: chunk.map((t: any) => {
        const regionCode = tileToRegion[`${t.q},${t.r}`];
        return [[t.q, t.r], toCode16(t.t), t.g || undefined, regionCode ? toCode32(regionCode) : undefined];
      }),
    }}});
  }
  await sudoBatch(client, alice, 'Tiles', tileCalls, 5);

  // ─── 13. Equiprules ───────────────────────────────────────────────
  const bkRules = loadJson('battlekit_rules.json');
  const equipCalls: ParachainTemplateRuntimeRuntimeCallLike[] = [];
  equipCalls.push({ pallet: 'Equiprules', palletCall: { name: 'SetHandSlots', params: { hands: bkRules.slot_system.hands } } });
  for (const rule of bkRules.slot_system.rules) {
    equipCalls.push({ pallet: 'Equiprules', palletCall: { name: 'SetSlotRule', params: {
      battlekitType: mapBattlekitType(rule.type), slots: rule.slots,
      maxPerModel: rule.max_per_model ?? undefined, offHandOnly: rule.off_hand_only || false,
    }}});
  }
  const allTags = { ...bkRules.tags, ...bkRules.model_restriction_tags };
  for (const [code, tag] of Object.entries(allTags) as [string, any][]) {
    equipCalls.push({ pallet: 'Equiprules', palletCall: { name: 'RegisterTag', params: {
      code: toCode32(code), name: tag.name || code,
      description: (tag.description || '').slice(0, 256),
      requiresKeyword: tag.requires_keyword ? toCode32(tag.requires_keyword) : undefined,
      requiresEntry: tag.requires_entry ? toCode32(tag.requires_entry) : undefined,
      requiresEntryAny: (tag.requires_entry_any || []).map((e: string) => toCode32(e)),
      requiresEquipment: tag.requires_equipment ? toCode32(tag.requires_equipment) : undefined,
      excludesEntry: tag.excludes_entry ? toCode32(tag.excludes_entry) : undefined,
      exclusiveSlot: tag.exclusive_slot ? toCode32(tag.exclusive_slot) : undefined,
      warbandLimit: tag.warband_limit ?? undefined, oneUse: tag.one_use || false,
      movementPenalty: tag.movement_penalty || false,
    }}});
  }
  // Send equiprules individually (batch encoding fails for new pallets in nested sudo)
  const t1b = Date.now();
  let okEquip = 0;
  for (const call of equipCalls) { if (await sudoSend(client, alice, call)) okEquip++; }
  console.log(`[Equiprules] ${okEquip}/${equipCalls.length} (${((Date.now() - t1b) / 1000).toFixed(1)}s)`);

  // ─── 14. Campaign Rules ───────────────────────────────────────────
  const campRules = loadJson('campaign_rules.json');
  const campCalls: ParachainTemplateRuntimeRuntimeCallLike[] = [];

  campCalls.push({ pallet: 'CampaignRules', palletCall: { name: 'SetThresholdTable', params: {
    rows: campRules.threshold_table.map((r: any) => ({ game: r.game, threshold: r.threshold_value, fieldStrength: r.field_strength })) as PalletCampaignRulesThresholdRow[],
  }}});
  campCalls.push({ pallet: 'CampaignRules', palletCall: { name: 'SetVictoryConfig', params: {
    config: { winner: campRules.victory_points.winner, loser: campRules.victory_points.loser, draw: campRules.victory_points.draw } as PalletCampaignRulesVictoryConfig,
  }}});
  campCalls.push({ pallet: 'CampaignRules', palletCall: { name: 'SetTraumaTable', params: {
    rows: campRules.trauma.trauma_table.map((t: any) => ({
      roll: t.roll, name: t.name.slice(0, 64), effect: t.effect.slice(0, 256),
      causesInjury: t.injury, causesBattleScar: t.battle_scar,
    })) as PalletCampaignRulesTraumaRow[],
  }}});
  campCalls.push({ pallet: 'CampaignRules', palletCall: { name: 'SetPhaseSteps', params: {
    steps: campRules.campaign_phase_steps.map((s: any) => ({
      order: s.order, id: s.id, name: s.name.slice(0, 64),
      description: s.description.slice(0, 256), mandatory: s.mandatory,
    })) as PalletCampaignRulesPhaseStep[],
  }}});
  campCalls.push({ pallet: 'CampaignRules', palletCall: { name: 'SetPromotionRules', params: {
    rules: { baseDice: 1, successValue: 6, pityThreshold: 5, maxElites: campRules.promotions.max_elites } as PalletCampaignRulesPromotionRules,
  }}});
  campCalls.push({ pallet: 'CampaignRules', palletCall: { name: 'SetQuartermasterActions', params: {
    actions: campRules.quartermaster.actions.map((a: any) => ({
      id: a.id, name: a.name.slice(0, 64), description: a.description.slice(0, 256),
    })) as PalletCampaignRulesQuartermasterAction[],
  }}});

  // Send campaign rules individually (complex nested structures)
  const t2 = Date.now();
  for (const call of campCalls) { await sudoSend(client, alice, call); }
  console.log(`[CampaignRules] ${campCalls.length} calls (${((Date.now() - t2) / 1000).toFixed(1)}s)`);

  // ─── 15. Exploration Rules ────────────────────────────────────────
  const exploData = loadJson('exploration.json');
  const exploCalls: ParachainTemplateRuntimeRuntimeCallLike[] = [];

  exploCalls.push({ pallet: 'ExplorationRules', palletCall: { name: 'SetDiceProgression', params: {
    rows: exploData.dice_progression.map((r: any) => ({ gamesMin: r.games_min, gamesMax: r.games_max, dice: r.dice })) as PalletExplorationRulesDiceProgressionRow[],
  }}});
  exploCalls.push({ pallet: 'ExplorationRules', palletCall: { name: 'SetTableProgression', params: {
    rows: exploData.table_progression.map((r: any) => ({
      gamesMin: r.games_min, gamesMax: r.games_max, tables: r.tables.map(mapExplorationTable),
    })) as PalletExplorationRulesTableProgressionRow[],
  }}});
  exploCalls.push({ pallet: 'ExplorationRules', palletCall: { name: 'SetLootAndRerolls', params: {
    lootMultiplier: exploData.loot_formula.multiplier,
    rerollsBase: exploData.rerolls.base, rerollsBonusIfWon: exploData.rerolls.bonus_if_won,
  }}});

  for (const [tableName, events] of Object.entries(exploData.tables) as [string, any[]][]) {
    const table = mapExplorationTable(tableName);
    for (const ev of events) {
      exploCalls.push({ pallet: 'ExplorationRules', palletCall: { name: 'SetExplorationEvent', params: {
        table, roll: ev.roll,
        event: {
          name: ev.name.slice(0, 64), description: ev.description.slice(0, 256),
          options: (ev.options || []).map((opt: any) => ({
            id: opt.id.slice(0, 32), name: opt.name.slice(0, 64),
            factions: (opt.factions || []).map((f: string) => f === 'any' ? toCode16('ANY') : toCode16(f.toUpperCase())),
            effect: opt.effect.slice(0, 256),
            grantsSkill: ev.grants_skill ? toCode16(ev.grants_skill) : undefined,
          })),
        } as PalletExplorationRulesExplorationEvent,
      }}});
    }
  }
  for (const sk of exploData.exploration_skills) {
    exploCalls.push({ pallet: 'ExplorationRules', palletCall: { name: 'SetExplorationSkill', params: {
      code: toCode16(sk.id),
      skill: { name: sk.name.slice(0, 64), effect: sk.effect.slice(0, 256), timing: mapExplorationTiming(sk.timing) } as PalletExplorationRulesExplorationSkillDef,
    }}});
  }

  // Send exploration individually (nested structs)
  const t3 = Date.now();
  for (const call of exploCalls) { await sudoSend(client, alice, call); }
  console.log(`[ExplorationRules] ${exploCalls.length} calls (${((Date.now() - t3) / 1000).toFixed(1)}s)`);

  // ─── 16. Terrain Rules ────────────────────────────────────────────
  const terrainData = loadJson('terrain.json');
  const terrainCalls: ParachainTemplateRuntimeRuntimeCallLike[] = [];

  for (const cat of terrainData.terrain_categories) {
    terrainCalls.push({ pallet: 'TerrainRules', palletCall: { name: 'SetCategory', params: {
      code: toCode16(cat.id),
      category: { name: cat.name.slice(0, 64), description: cat.description.slice(0, 256),
        movementEffect: (cat.movement_effect || '').slice(0, 128), providesCover: cat.cover } as PalletTerrainRulesTerrainCategory,
    }}});
  }
  for (const pc of terrainData.terrain_pieces) {
    terrainCalls.push({ pallet: 'TerrainRules', palletCall: { name: 'SetPiece', params: {
      code: toCode16(pc.id),
      piece: { name: pc.name.slice(0, 64), category: toCode16(pc.category),
        description: pc.description.slice(0, 256), providesCover: pc.provides_cover,
        climbing: pc.climbing, special: (pc.special || '').slice(0, 256) } as PalletTerrainRulesTerrainPiece,
    }}});
  }
  for (const arch of terrainData.battlefield_archetypes) {
    terrainCalls.push({ pallet: 'TerrainRules', palletCall: { name: 'SetArchetype', params: {
      code: toCode16(arch.id),
      archetype: { name: arch.name.slice(0, 64), description: arch.description.slice(0, 256),
        allowedTerrain: (arch.allowed_terrain || []).map((t: string) => toCode16(t)),
        minimumPieces: (arch.minimum_pieces || '').slice(0, 128),
        setupRules: (arch.setup_rules || '').slice(0, 256) } as PalletTerrainRulesBattlefieldArchetype,
    }}});
  }
  for (const [terrain, archetypes] of Object.entries(terrainData.terrain_battlefields.mappings) as [string, string[]][]) {
    terrainCalls.push({ pallet: 'TerrainRules', palletCall: { name: 'SetTerrainBattlefieldMapping', params: {
      terrain: toCode16(terrain), archetypes: archetypes.map((a: string) => toCode16(a)),
    }}});
  }
  terrainCalls.push({ pallet: 'TerrainRules', palletCall: { name: 'SetCombatModifiers', params: {
    config: {
      coverRangedPenalty: terrainData.combat_modifiers.cover.ranged_penalty.slice(0, 128),
      coverMeleePenalty: terrainData.combat_modifiers.cover.melee_penalty.slice(0, 128),
      elevationRangedBonus: terrainData.combat_modifiers.elevation.ranged_bonus.slice(0, 128),
      climbingRiskyRoll: terrainData.combat_modifiers.climbing.risky_roll.slice(0, 128),
      jumpingGap: terrainData.combat_modifiers.climbing.jumping_gap.slice(0, 128),
      jumpingDown: terrainData.combat_modifiers.climbing.jumping_down.slice(0, 128),
    } as PalletTerrainRulesCombatModifierConfig,
  }}});

  // Send terrain individually (nested structs)
  const t4 = Date.now();
  for (const call of terrainCalls) { await sudoSend(client, alice, call); }
  console.log(`[TerrainRules] ${terrainCalls.length} calls (${((Date.now() - t4) / 1000).toFixed(1)}s)`);

  // ─── Verification ─────────────────────────────────────────────────
  console.log('\n📋 Verification:');
  const checks = [
    ['Keywords', async () => !!(await client.query.keyword.keywords(toCode32(keywords[0].code)))],
    ['Factions', async () => !!(await client.query.faction.factions(toCode16('HERETIC')))],
    ['Battlekit', async () => !!(await client.query.battlekit.items(toCode32(allItems[0].code)))],
    ['Entries', async () => !!(await client.query.entry.entries(toCode32('HERETIC_PRIEST')))],
    ['Abilities', async () => (await client.query.entry.entryAbilities(toCode32('HERETIC_PRIEST')))?.length > 0],
    ['Equiprules', async () => (await client.query.equiprules.handSlots()) === 2],
    ['CampaignRules', async () => !!(await client.query.campaignRules.victory())],
    ['ExplorationRules', async () => (await client.query.explorationRules.lootMultiplier()) === 10],
    ['TerrainRules', async () => !!(await client.query.terrainRules.categories(toCode16('open')))],
    ['Tiles', async () => (await client.query.tile.tileCount()) > 0],
  ] as const;

  for (const [name, check] of checks) {
    const ok = await check();
    console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  }

  console.log('\n✅ Done!');
  await client.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
