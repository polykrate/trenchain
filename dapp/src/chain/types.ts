export type FactionId = number
export type EntryId = string
export type ItemId = string
export type SkillId = number
export type PatronId = number
export type WarbandId = number
export type KeywordId = string

export type AccountId = string

export interface StatProfile {
  movement_inches: number
  movement_type: 'Infantry' | 'Flying'
  ranged: number | null
  melee: number | null
  armour: number
  base: { type: 'round'; diameter_mm: number } | { type: 'oval'; width_mm: number; length_mm: number }
}

export interface Faction {
  id: FactionId
  name: string
  alignment: 'Faithful' | 'Fallen'
}

export interface Patron {
  id: PatronId
  code: string
  name: string
  description: string
  factions: FactionId[]
  skills: SkillId[]
}

export interface Ability {
  name: string
  description: string
}

export interface WarbandEntry {
  id: EntryId
  name: string
  faction: FactionId
  min_count: number
  max_count: number | null
  cost: number
  profile: StatProfile
  keywords: KeywordId[]
  description: string
  lore: string
  battlekit_rules: string
  abilities: Ability[]
  composition_note: string
}

export interface Recruit {
  entry_id: EntryId
  name: string
  items: ItemId[]
  skills: SkillId[]
  xp: number
  battle_scars: number
}

export interface Warband {
  id: WarbandId
  owner: AccountId
  faction: FactionId
  patron: PatronId
  name: string
  ducats: number
  glory: number
  elites: number
  roster: Recruit[]
}

export interface MatchResult {
  id: string
  warband_a: WarbandId
  warband_b: WarbandId
  winner: WarbandId | null
  glory_a: number
  glory_b: number
  timestamp: number
}

export interface HexRegion {
  id: number
  name: string
  controller: FactionId | null
  resource_output: number
  contested: boolean
  adjacent: number[]
}

export type ResourceType = 'ducats' | 'iron' | 'powder' | 'flesh' | 'relics' | 'alchemy' | 'occult'

export type TerrainType =
  | 'port'
  | 'coastal'
  | 'fortress'
  | 'mountain_pass'
  | 'mountain'
  | 'forest'
  | 'ruins'
  | 'factory'
  | 'city'
  | 'village'
  | 'plains'
  | 'bridge'
  | 'cathedral'
  | 'marsh'
  | 'mine'
  | 'quarry'
  | 'laboratory'
  | 'monastery'
  | 'hellgate'
  | 'crossroads'
  | 'harbor'
  | 'encampment'

export interface MapResource {
  type: ResourceType
  output: number
}

export interface BuildingType {
  id: string
  name: string
  description: string
  produces: { resource: ResourceType; output: number }[]
  allowed_terrain: TerrainType[]
  build_cost: { resource: ResourceType; amount: number }[]
  upgrade_levels: number
}

export interface CampaignLocation {
  id: number
  name: string
  subtitle: string
  description: string
  terrain: TerrainType
  resources: MapResource[]
  connections: number[]
  position: { x: number; y: number }
}

export interface LeaderboardEntry {
  warband_id: WarbandId
  warband_name: string
  faction: FactionId
  glory: number
  wins: number
  losses: number
}

export interface Tournament {
  id: string
  name: string
  status: 'registration' | 'in_progress' | 'completed'
  participants: WarbandId[]
  rounds: TournamentRound[]
}

export interface TournamentRound {
  round_number: number
  matches: { warband_a: WarbandId; warband_b: WarbandId; winner: WarbandId | null }[]
}
