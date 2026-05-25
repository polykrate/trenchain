import keywordsJson from './rules/keywords.json'
import patronsJson from './rules/patrons.json'
import skillsJson from './rules/skills.json'
import meleeJson from './rules/battlekit/melee_weapons.json'
import rangedJson from './rules/battlekit/ranged_weapons.json'
import shieldsJson from './rules/battlekit/shields.json'
import grenadesJson from './rules/battlekit/grenades.json'
import armourJson from './rules/battlekit/armour.json'
import equipmentJson from './rules/battlekit/equipment.json'

import hereticEntriesJson from './rules/entries/heretic_legions.json'
import pilgrimEntriesJson from './rules/entries/trench_pilgrims.json'
import antiochEntriesJson from './rules/entries/new_antioch.json'
import sultanateEntriesJson from './rules/entries/iron_sultanate.json'
import blackGrailEntriesJson from './rules/entries/black_grail.json'
import courtEntriesJson from './rules/entries/the_court.json'

import hereticArmouryJson from './rules/armoury/heretic_legions.json'
import pilgrimArmouryJson from './rules/armoury/trench_pilgrims.json'
import antiochArmouryJson from './rules/armoury/new_antioch.json'
import sultanateArmouryJson from './rules/armoury/iron_sultanate.json'
import blackGrailArmouryJson from './rules/armoury/black_grail.json'
import courtArmouryJson from './rules/armoury/the_court.json'

import terrainJson from './rules/terrain.json'
import campaignRulesJson from './rules/campaign_rules.json'
import economyJson from './rules/economy.json'
import battlekitRulesJson from './rules/battlekit_rules.json'

export interface Keyword {
  id: number
  code: string
  name: string
  kind: 'Tag' | 'Effect'
  description: string
}

export interface Patron {
  id: number
  code: string
  name: string
  description: string
  factions: string[]
  skills: number[]
}

export interface Skill {
  id: number
  code: string
  name: string
  description: string
}

export interface BattlekitItem {
  code: string
  name: string
  description: string
  battlekit_type: string
  range: string | { Ranged: number } | { DualPurpose: number } | null
  keywords: string[]
  special_rules: string | null
  category: 'melee' | 'ranged' | 'shield' | 'grenade' | 'armour' | 'equipment'
}

export interface Faction {
  id: number
  name: string
  alignment: 'Faithful' | 'Fallen'
  code: string
  description: string
  patron_codes: string[]
}

export const keywords: Keyword[] = keywordsJson.keywords as Keyword[]

export const patrons: Patron[] = patronsJson.patrons as Patron[]

export const skills: Skill[] = skillsJson.skills as Skill[]

function tagItems(items: { code: string; name: string; description: string; battlekit_type: string; range: unknown; keywords: string[]; special_rules: string | null }[], category: BattlekitItem['category']): BattlekitItem[] {
  return items.map(item => ({ ...item, range: item.range as BattlekitItem['range'], category }))
}

export const battlekit: BattlekitItem[] = [
  ...tagItems(meleeJson.items as never[], 'melee'),
  ...tagItems(rangedJson.items as never[], 'ranged'),
  ...tagItems(shieldsJson.items as never[], 'shield'),
  ...tagItems(grenadesJson.items as never[], 'grenade'),
  ...tagItems(armourJson.items as never[], 'armour'),
  ...tagItems(equipmentJson.items as never[], 'equipment'),
]

export const factions: Faction[] = [
  {
    id: 1,
    name: 'Heretic Legions',
    alignment: 'Fallen',
    code: 'HERETIC',
    description: 'The damned armies that pour through the gates of Hell, led by infernal nobles and dark priests. Their ranks include twisted humans, demons, and unholy constructs.',
    patron_codes: ['INFERNAL_NOBLE', 'MAMMON'],
  },
  {
    id: 2,
    name: 'Trench Pilgrims',
    alignment: 'Faithful',
    code: 'PILGRIM',
    description: 'Zealous faithful who march into battle with nothing but devotion and improvised weapons. Their numbers are legion and their faith unbreakable.',
    patron_codes: ['WARRIOR_SAINT', 'LEARNED_SAINT'],
  },
  {
    id: 3,
    name: 'Principality of New Antioch',
    alignment: 'Faithful',
    code: 'ANTIOCH',
    description: 'The military might of Christendom reborn. Professional soldiers, elite knights, and advanced weaponry defend the last bastion of humanity.',
    patron_codes: ['TEMPORAL_LORD', 'WARRIOR_SAINT', 'LEARNED_SAINT'],
  },
  {
    id: 4,
    name: 'Sultanate of the Iron Wall',
    alignment: 'Faithful',
    code: 'SULTANATE',
    description: 'The mighty Sultanate stands as an iron wall against the forces of Hell. Janissaries, Sipahi cavalry, and ancient traditions forge their strength.',
    patron_codes: ['SUBLIME_GATE'],
  },
  {
    id: 5,
    name: 'Cult of the Black Grail',
    alignment: 'Fallen',
    code: 'BLACK_GRAIL',
    description: 'Plague-ridden servants of Beelzebub who spread corruption and disease. Their bodies are twisted by the Black Grail infection into monstrous forms.',
    patron_codes: ['THE_ORDER_OF_THE_FLY', 'THE_ANTIPOPE_OF_AVIGNON'],
  },
  {
    id: 6,
    name: 'Court of the Seven-Headed Serpent',
    alignment: 'Fallen',
    code: 'COURT',
    description: 'A cabal of powerful sorcerers and their demonic patrons. They weave dark magic and plot the downfall of humanity from the shadows.',
    patron_codes: ['INFERNAL_NOBLE', 'MAMMON'],
  },
]

export function getKeywordById(id: number): Keyword | undefined {
  return keywords.find(k => k.id === id)
}

export function getKeywordByCode(code: string): Keyword | undefined {
  return keywords.find(k => k.code === code)
}

export function getKeywordsByIds(ids: number[]): Keyword[] {
  return ids.map(id => keywords.find(k => k.id === id)).filter((k): k is Keyword => k !== undefined)
}

export function getKeywordsByCodes(codes: string[]): Keyword[] {
  return codes.map(code => keywords.find(k => k.code === code)).filter((k): k is Keyword => k !== undefined)
}

export function getPatronsByFaction(factionCode: string): Patron[] {
  return patrons.filter(p => p.factions.includes(factionCode))
}

export function getSkillsByIds(ids: number[]): Skill[] {
  return ids.map(id => skills.find(s => s.id === id)).filter((s): s is Skill => s !== undefined)
}

export function getBattlekitByCategory(category: BattlekitItem['category']): BattlekitItem[] {
  return battlekit.filter(b => b.category === category)
}

export function getBattlekitByCode(code: string): BattlekitItem | undefined {
  return battlekit.find(b => b.code === code)
}

export function formatRange(range: BattlekitItem['range']): string {
  if (range === null || range === 'None') return '—'
  if (range === 'Melee') return 'Melee'
  if (typeof range === 'object') {
    if ('Ranged' in range) return `${range.Ranged}″`
    if ('DualPurpose' in range) return `${range.DualPurpose}″ / Melee`
  }
  return String(range)
}

// --- Warband Entries (per faction) ---

export interface EntryAbility {
  name: string
  description: string
}

export interface EntryProfile {
  movement_inches: number
  movement_type: string
  ranged: number | null
  melee: number | null
  armour: number
  base: string
}

export interface WarbandEntry {
  id: string
  name: string
  min_count: number
  max_count: number | null
  cost: number
  profile: EntryProfile
  keywords: string[]
  description: string
  battlekit_rules: string
  included_battlekit: string[]
  abilities: EntryAbility[]
  composition_note: string
}

export interface FactionEntries {
  faction_id: number
  faction_code: string
  entries: WarbandEntry[]
}

const allFactionEntries: FactionEntries[] = [
  hereticEntriesJson as unknown as FactionEntries,
  pilgrimEntriesJson as unknown as FactionEntries,
  antiochEntriesJson as unknown as FactionEntries,
  sultanateEntriesJson as unknown as FactionEntries,
  blackGrailEntriesJson as unknown as FactionEntries,
  courtEntriesJson as unknown as FactionEntries,
]

export function getEntriesByFaction(factionCode: string): WarbandEntry[] {
  const found = allFactionEntries.find(f => f.faction_code === factionCode)
  return found ? found.entries : []
}

export function getEntryById(id: string): WarbandEntry | undefined {
  for (const faction of allFactionEntries) {
    const entry = faction.entries.find(e => e.id === id)
    if (entry) return entry
  }
  return undefined
}

export function getRequiredEntries(factionCode: string): WarbandEntry[] {
  return getEntriesByFaction(factionCode).filter(e => e.min_count > 0)
}

// --- Armoury (per faction) ---

export interface ArmouryItem {
  item_code: string
  cost: number
  cost_type?: 'ducats' | 'glory'
  tags?: string[]
}

export interface FactionArmoury {
  faction_id: number
  faction_code: string
  items: ArmouryItem[]
}

const allFactionArmoury: FactionArmoury[] = [
  hereticArmouryJson as unknown as FactionArmoury,
  pilgrimArmouryJson as unknown as FactionArmoury,
  antiochArmouryJson as unknown as FactionArmoury,
  sultanateArmouryJson as unknown as FactionArmoury,
  blackGrailArmouryJson as unknown as FactionArmoury,
  courtArmouryJson as unknown as FactionArmoury,
]

export function getArmouryByFaction(factionCode: string): ArmouryItem[] {
  const found = allFactionArmoury.find(f => f.faction_code === factionCode)
  return found ? found.items : []
}

export function getArmouryByCategory(factionCode: string, category: BattlekitItem['category']): ArmouryItem[] {
  return getArmouryByFaction(factionCode).filter(i => {
    const bk = getBattlekitByCode(i.item_code)
    return bk?.category === category
  })
}

// --- Resolved Armoury ---

export interface ResolvedArmouryItem {
  item_code: string
  cost: number
  cost_type?: 'ducats' | 'glory'
  tags?: string[]
  battlekit: BattlekitItem | undefined
}

export function getResolvedArmoury(factionCode: string): ResolvedArmouryItem[] {
  return getArmouryByFaction(factionCode).map(item => ({
    ...item,
    battlekit: getBattlekitByCode(item.item_code),
  }))
}

export function getResolvedArmouryByCategory(factionCode: string, category: BattlekitItem['category']): ResolvedArmouryItem[] {
  return getResolvedArmoury(factionCode).filter(i => i.battlekit?.category === category)
}

// --- Battlekit Rules ---

export interface BattlekitTag {
  name: string
  description?: string
  warband_limit?: number
  requires_keyword?: string
  requires_entry?: string
  requires_entry_any?: string[]
  requires_equipment?: string
  exclusive_slot?: string
  excludes_entry?: string
  one_use?: boolean
  effect?: string
  movement_penalty?: boolean
}

export const battlekitRules = battlekitRulesJson

export function getTagDefinition(tagCode: string): BattlekitTag | undefined {
  return (battlekitRulesJson.tags as Record<string, BattlekitTag>)[tagCode]
    ?? (battlekitRulesJson.model_restriction_tags as Record<string, BattlekitTag>)[tagCode]
}

export function canModelEquip(item: ArmouryItem, modelKeywords: string[], modelEntryCode: string): boolean {
  if (!item.tags || item.tags.length === 0) return true
  for (const tag of item.tags) {
    const def = getTagDefinition(tag)
    if (!def) continue
    if ('requires_keyword' in def && def.requires_keyword) {
      if (!modelKeywords.includes(def.requires_keyword)) return false
    }
    if ('requires_entry' in def && def.requires_entry) {
      if (modelEntryCode !== def.requires_entry) return false
    }
    if ('requires_entry_any' in def && def.requires_entry_any) {
      if (!def.requires_entry_any.includes(modelEntryCode)) {
        if (!('requires_keyword' in def && def.requires_keyword && modelKeywords.includes(def.requires_keyword))) {
          return false
        }
      }
    }
  }
  return true
}

// --- Terrain & Campaign Rules ---

export const terrain = terrainJson
export const campaignRules = campaignRulesJson
export const economy = economyJson
