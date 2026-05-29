import type {
  TcPrimitivesBattlekitType,
  TcPrimitivesExplorationTiming,
  TcPrimitivesExplorationTable,
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
} from '../../src/chain-api/parachain-template-runtime/types';
import { loadJson, toBytes, toCode32, toCode16, sudoSendAll, sudoBatch } from './shared';
import type { ChainClient, CallLike } from './shared';

function mapBattlekitType(raw: string): TcPrimitivesBattlekitType {
  const map: Record<string, TcPrimitivesBattlekitType> = {
    OneHanded: 'OneHanded', TwoHanded: 'TwoHanded', Grenade: 'Grenade',
    Armour: 'Armour', Shield: 'Shield', Equipment: 'Equipment', Special: 'Special',
  };
  return map[raw] || 'Equipment';
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

export async function seedEquiprules(client: ChainClient, alice: any) {
  const bkRules = loadJson('battlekit_rules.json');
  const equipCalls: CallLike[] = [];

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
  await sudoBatch(client, alice, 'Equiprules', equipCalls);
}

export async function seedCampaignRules(client: ChainClient, alice: any) {
  const campRules = loadJson('campaign_rules.json');
  const campCalls: CallLike[] = [];

  campCalls.push({ pallet: 'CampaignRules', palletCall: { name: 'SetThresholdTable', params: {
    rows: campRules.threshold_table.map((r: any) => ({
      game: r.game, threshold: r.threshold_value, fieldStrength: r.field_strength,
    })) as PalletCampaignRulesThresholdRow[],
  }}});
  campCalls.push({ pallet: 'CampaignRules', palletCall: { name: 'SetVictoryConfig', params: {
    config: { winner: campRules.victory_points.winner, loser: campRules.victory_points.loser, draw: campRules.victory_points.draw } as PalletCampaignRulesVictoryConfig,
  }}});
  campCalls.push({ pallet: 'CampaignRules', palletCall: { name: 'SetTraumaTable', params: {
    rows: campRules.trauma.trauma_table.map((t: any) => ({
      roll: toBytes(String(t.roll)), name: toBytes(t.name.slice(0, 64)), effect: toBytes(t.effect.slice(0, 256)),
      causesInjury: t.injury, causesBattleScar: t.battle_scar,
    })) as PalletCampaignRulesTraumaRow[],
  }}});
  campCalls.push({ pallet: 'CampaignRules', palletCall: { name: 'SetPhaseSteps', params: {
    steps: campRules.campaign_phase_steps.map((s: any) => ({
      order: s.order, id: toBytes(s.id), name: toBytes(s.name.slice(0, 64)),
      description: toBytes(s.description.slice(0, 256)), mandatory: s.mandatory,
      exclusiveWith: (s.exclusive_with || []).map((e: string) => toBytes(e)),
    })) as PalletCampaignRulesPhaseStep[],
  }}});
  campCalls.push({ pallet: 'CampaignRules', palletCall: { name: 'SetPromotionRules', params: {
    rules: { baseDice: 1, successValue: 6, pityThreshold: 5, maxElites: campRules.promotions.max_elites } as PalletCampaignRulesPromotionRules,
  }}});
  campCalls.push({ pallet: 'CampaignRules', palletCall: { name: 'SetQuartermasterActions', params: {
    actions: campRules.quartermaster.actions.map((a: any) => ({
      id: toBytes(a.id), name: toBytes(a.name.slice(0, 64)), description: toBytes(a.description.slice(0, 256)),
    })) as PalletCampaignRulesQuartermasterAction[],
  }}});

  await sudoBatch(client, alice, 'CampaignRules', campCalls);
}

export async function seedExplorationRules(client: ChainClient, alice: any) {
  const exploData = loadJson('exploration.json');
  const exploCalls: CallLike[] = [];

  exploCalls.push({ pallet: 'ExplorationRules', palletCall: { name: 'SetDiceProgression', params: {
    rows: exploData.dice_progression.map((r: any) => ({
      gamesMin: r.games_min, gamesMax: r.games_max, dice: r.dice,
    })) as PalletExplorationRulesDiceProgressionRow[],
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
          name: toBytes(ev.name.slice(0, 64)), description: toBytes(ev.description.slice(0, 256)),
          options: (ev.options || []).map((opt: any) => ({
            id: toBytes(opt.id.slice(0, 32)), name: toBytes(opt.name.slice(0, 64)),
            factions: (opt.factions || []).map((f: string) => f === 'any' ? toCode16('ANY') : toCode16(f.toUpperCase())),
            effect: toBytes(opt.effect.slice(0, 256)),
            grantsSkill: ev.grants_skill ? toCode16(ev.grants_skill) : undefined,
          })),
        } as PalletExplorationRulesExplorationEvent,
      }}});
    }
  }
  for (const sk of exploData.exploration_skills) {
    exploCalls.push({ pallet: 'ExplorationRules', palletCall: { name: 'SetExplorationSkill', params: {
      code: toCode16(sk.id),
      skill: { name: toBytes(sk.name.slice(0, 64)), effect: toBytes(sk.effect.slice(0, 256)), timing: mapExplorationTiming(sk.timing) } as PalletExplorationRulesExplorationSkillDef,
    }}});
  }

  await sudoBatch(client, alice, 'ExplorationRules', exploCalls);
}

export async function seedTerrainRules(client: ChainClient, alice: any) {
  const terrainData = loadJson('terrain.json');
  const terrainCalls: CallLike[] = [];

  for (const cat of terrainData.terrain_categories) {
    terrainCalls.push({ pallet: 'TerrainRules', palletCall: { name: 'SetCategory', params: {
      code: toCode16(cat.id),
      category: { name: toBytes(cat.name.slice(0, 64)), description: toBytes(cat.description.slice(0, 256)),
        movementEffect: toBytes((cat.movement_effect || '').slice(0, 128)), providesCover: cat.cover } as PalletTerrainRulesTerrainCategory,
    }}});
  }
  for (const pc of terrainData.terrain_pieces) {
    terrainCalls.push({ pallet: 'TerrainRules', palletCall: { name: 'SetPiece', params: {
      code: toCode16(pc.id),
      piece: { name: toBytes(pc.name.slice(0, 64)), category: toCode16(pc.category),
        description: toBytes(pc.description.slice(0, 256)), providesCover: pc.provides_cover,
        climbing: pc.climbing, special: toBytes((pc.special || '').slice(0, 256)) } as PalletTerrainRulesTerrainPiece,
    }}});
  }
  for (const arch of terrainData.battlefield_archetypes) {
    terrainCalls.push({ pallet: 'TerrainRules', palletCall: { name: 'SetArchetype', params: {
      code: toCode16(arch.id),
      archetype: { name: toBytes(arch.name.slice(0, 64)), description: toBytes(arch.description.slice(0, 256)),
        allowedTerrain: (arch.allowed_terrain || []).map((t: string) => toCode16(t)),
        minimumPieces: toBytes((arch.minimum_pieces || '').slice(0, 128)),
        setupRules: toBytes((arch.setup_rules || '').slice(0, 256)) } as PalletTerrainRulesBattlefieldArchetype,
    }}});
  }
  for (const [terrain, archetypes] of Object.entries(terrainData.terrain_battlefields.mappings) as [string, string[]][]) {
    terrainCalls.push({ pallet: 'TerrainRules', palletCall: { name: 'SetTerrainBattlefieldMapping', params: {
      terrain: toCode16(terrain), archetypes: archetypes.map((a: string) => toCode16(a)),
    }}});
  }
  terrainCalls.push({ pallet: 'TerrainRules', palletCall: { name: 'SetCombatModifiers', params: {
    config: {
      coverRangedPenalty: toBytes(terrainData.combat_modifiers.cover.ranged_penalty.slice(0, 128)),
      coverMeleePenalty: toBytes(terrainData.combat_modifiers.cover.melee_penalty.slice(0, 128)),
      elevationRangedBonus: toBytes(terrainData.combat_modifiers.elevation.ranged_bonus.slice(0, 128)),
      climbingRiskyRoll: toBytes(terrainData.combat_modifiers.climbing.risky_roll.slice(0, 128)),
      jumpingGap: toBytes(terrainData.combat_modifiers.climbing.jumping_gap.slice(0, 128)),
      jumpingDown: toBytes(terrainData.combat_modifiers.climbing.jumping_down.slice(0, 128)),
    } as PalletTerrainRulesCombatModifierConfig,
  }}});

  await sudoBatch(client, alice, 'TerrainRules', terrainCalls);
}

export async function seedRules(client: ChainClient, alice: any) {
  console.log('⚖️  Seeding rules...');
  await seedEquiprules(client, alice);
  await seedCampaignRules(client, alice);
  await seedExplorationRules(client, alice);
  await seedTerrainRules(client, alice);
}
