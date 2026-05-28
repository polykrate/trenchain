import type {
  TcPrimitivesKeywordKind,
  TcPrimitivesAlignment,
  TcPrimitivesBattlekitType,
  TcPrimitivesWeaponRange,
  TcPrimitivesStatProfile,
  TcPrimitivesBaseSize,
  TcPrimitivesMovementType,
  TcPrimitivesCostType,
} from '../../src/chain-api/parachain-template-runtime/types';
import { loadJson, toCode32, toCode16, sudoBatch, sudoSendAll } from './shared';
import type { ChainClient, CallLike } from './shared';

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
    if (raw.Ranged != null) return { type: 'Ranged', value: { inches: raw.Ranged } };
    if (raw.DualPurpose != null) return { type: 'DualPurpose', value: { inches: raw.DualPurpose } };
    if (raw.type === 'Melee') return { type: 'Melee' };
    if (raw.type === 'Ranged') return { type: 'Ranged', value: { inches: raw.value?.inches ?? 0 } };
    if (raw.type === 'DualPurpose') return { type: 'DualPurpose', value: { inches: raw.value?.inches ?? 0 } };
    return { type: 'None' };
  }
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

const FACTION_FILES = ['heretic_legions', 'trench_pilgrims', 'new_antioch', 'iron_sultanate', 'black_grail', 'the_court'];

// Build keyword normalization: accepts either a code or a display name, returns the canonical code
function buildKeywordNormalizer() {
  const { keywords } = loadJson('keywords.json');
  const codeSet = new Set<string>(keywords.map((kw: any) => kw.code));
  const nameToCode = new Map<string, string>();
  for (const kw of keywords) {
    nameToCode.set(kw.name.toUpperCase(), kw.code);
  }
  return (raw: string): string | null => {
    if (codeSet.has(raw)) return raw;
    const byName = nameToCode.get(raw.toUpperCase());
    if (byName) return byName;
    // Try normalizing: replace spaces/hyphens with underscore, uppercase
    const normalized = raw.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (codeSet.has(normalized)) return normalized;
    return null;
  };
}

export async function seedKeywords(client: ChainClient, alice: any) {
  const { keywords } = loadJson('keywords.json');
  await sudoBatch(client, alice, 'Keywords', keywords.map((kw: any) => ({
    pallet: 'Keyword', palletCall: { name: 'RegisterKeyword', params: {
      code: toCode32(kw.code), name: kw.name,
      description: (kw.description || '').slice(0, 512),
      kind: (kw.kind === 'Effect' ? 'Effect' : 'Tag') as TcPrimitivesKeywordKind,
    }},
  })));
}

export async function seedSkills(client: ChainClient, alice: any) {
  const { skills } = loadJson('skills.json');
  await sudoBatch(client, alice, 'Skills', skills.map((s: any) => ({
    pallet: 'Skill', palletCall: { name: 'RegisterSkill', params: {
      code: toCode32(s.code), name: s.name, description: (s.description || '').slice(0, 512),
    }},
  })));
}

export async function seedFactions(client: ChainClient, alice: any) {
  const factionMeta: Record<string, { name: string; description: string }> = {
    HERETIC: { name: 'Heretic Legions', description: 'The damned armies that pour through the gates of Hell, led by infernal nobles and dark priests.' },
    PILGRIM: { name: 'Trench Pilgrims', description: 'Zealous faithful who march into battle with nothing but devotion and improvised weapons.' },
    ANTIOCH: { name: 'Principality of New Antioch', description: 'The military might of Christendom reborn. Professional soldiers and elite knights.' },
    SULTANATE: { name: 'Sultanate of the Iron Wall', description: 'The mighty Sultanate stands as an iron wall against the forces of Hell.' },
    BLACK_GRAIL: { name: 'Cult of the Black Grail', description: 'Plague-ridden servants of Beelzebub who spread corruption and disease.' },
    COURT: { name: 'Court of the Seven-Headed Serpent', description: 'A cabal of powerful sorcerers and their demonic patrons.' },
  };
  await sudoBatch(client, alice, 'Factions', FACTION_FILES.map(f => {
    const data = loadJson(`entries/${f}.json`);
    const meta = factionMeta[data.faction_code] || { name: data.faction_code, description: '' };
    const alignment: TcPrimitivesAlignment =
      ['HERETIC', 'BLACK_GRAIL', 'COURT'].includes(data.faction_code) ? 'Fallen' : 'Faithful';
    return { pallet: 'Faction', palletCall: { name: 'RegisterFaction', params: {
      code: toCode16(data.faction_code), name: meta.name,
      description: meta.description, alignment, keywords: [],
    }}} as CallLike;
  }));
}

export async function seedBattlekit(client: ChainClient, alice: any) {
  const normalize = buildKeywordNormalizer();
  const bkCategories = ['melee_weapons', 'ranged_weapons', 'grenades', 'armour', 'shields', 'equipment'];
  const allItems: any[] = [];
  for (const cat of bkCategories) { allItems.push(...loadJson(`battlekit/${cat}.json`).items); }

  let skippedKw = 0;
  const calls = allItems.map((item: any) => {
    const resolvedKw: string[] = [];
    for (const kw of (item.keywords || [])) {
      const code = normalize(kw);
      if (code) resolvedKw.push(code);
      else { skippedKw++; console.warn(`    ⚠ Unknown keyword "${kw}" in item ${item.code}`); }
    }
    return {
      pallet: 'Battlekit', palletCall: { name: 'RegisterItem', params: {
        code: toCode32(item.code), name: item.name.slice(0, 64),
        description: (item.description || '').slice(0, 512),
        battlekitType: mapBattlekitType(item.battlekit_type),
        range: mapWeaponRange(item.range), cost: item.cost || 0,
        keywords: resolvedKw.slice(0, 8).map((k: string) => toCode32(k)),
        specialRules: (item.special_rules || '').slice(0, 512),
      }},
    };
  });
  if (skippedKw > 0) console.warn(`  ⚠ ${skippedKw} keyword references could not be resolved`);
  await sudoBatch(client, alice, 'Battlekit', calls);
}

export async function seedArmoury(client: ChainClient, alice: any) {
  const armouryCalls: CallLike[] = [];
  for (const f of FACTION_FILES) {
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
}

export async function seedEntries(client: ChainClient, alice: any) {
  const normalize = buildKeywordNormalizer();
  const entryCalls: CallLike[] = [];
  const abilityCalls: CallLike[] = [];
  for (const f of FACTION_FILES) {
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
      const resolvedKw = (entry.keywords || [])
        .map((k: string) => normalize(k))
        .filter((k: string | null): k is string => k !== null);
      entryCalls.push({ pallet: 'Entry', palletCall: { name: 'RegisterEntry', params: {
        code: toCode32(entry.id), name: entry.name, faction: toCode16(data.faction_code),
        minCount: entry.min_count, maxCount: entry.max_count ?? undefined,
        cost: entry.cost, profile,
        description: (entry.description || entry.name).slice(0, 1024),
        lore: (entry.lore || '').slice(0, 2048),
        battlekitRules: (entry.battlekit_rules || '').slice(0, 512),
        compositionNote: (entry.composition_note || '').slice(0, 256),
        keywords: resolvedKw.slice(0, 16).map((k: string) => toCode32(k)),
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
  await sudoBatch(client, alice, 'Entries', entryCalls, 10);
  await sudoBatch(client, alice, 'Abilities', abilityCalls);
}

export async function seedPatrons(client: ChainClient, alice: any) {
  const { patrons } = loadJson('patrons.json');
  await sudoBatch(client, alice, 'Patrons', patrons.map((p: any) => ({
    pallet: 'Patron', palletCall: { name: 'RegisterPatron', params: {
      code: toCode32(p.code), name: p.name, description: (p.description || '').slice(0, 256),
      factions: (p.factions || []).map((f: string) => toCode16(f)),
      skills: (p.skills || []).map((s: string) => toCode32(s)),
    }},
  })));
}

export async function seedCompendium(client: ChainClient, alice: any) {
  console.log('📖 Seeding compendium...');
  await seedKeywords(client, alice);
  await seedSkills(client, alice);
  await seedFactions(client, alice);
  await seedBattlekit(client, alice);
  await seedArmoury(client, alice);
  await seedEntries(client, alice);
  await seedPatrons(client, alice);
}
