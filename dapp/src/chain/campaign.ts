import type { WarbandId, Recruit } from './types'

export type CampaignId = string
export type BattleId = string

export type BattleStatus = 'pending_opponent' | 'locked' | 'awaiting_result' | 'post_battle' | 'completed'

export type PostBattlePhase = 'trauma' | 'promotions' | 'reinforcements' | 'exploration' | 'quartermaster' | 'done'

export interface ActiveCampaign {
  id: CampaignId
  name: string
  description: string
  map_id: string
  max_warbands: number
  enrolled_warbands: number
  status: 'recruiting' | 'active' | 'concluded'
}

export interface CampaignWarband {
  id: WarbandId
  name: string
  faction: number
  locked: boolean
  post_battle_phase: PostBattlePhase | null
  pending_battle_id: BattleId | null
}

export interface PendingBattle {
  id: BattleId
  campaign_id: CampaignId
  location_id: number
  location_name: string
  challenger_warband: WarbandId
  challenger_name: string
  defender_warband: WarbandId | null
  defender_name: string | null
  status: BattleStatus
  created_at: number
}

// --- Battle Report: only what players need to input ---

export interface ModelCasualty {
  recruit_index: number
  name: string
  out_of_action: boolean
  killed: boolean
}

export interface BattleReport {
  battle_id: BattleId
  reporter_warband: WarbandId
  winner: WarbandId | null
  loser_route: boolean
  my_casualties: ModelCasualty[]
}

// --- On-chain computed results (returned after both players confirm) ---

export interface BattleResult {
  battle_id: BattleId
  winner: WarbandId | null
  territory_captured: boolean
  challenger_glory: number
  defender_glory: number
  challenger_xp: XpGain[]
  defender_xp: XpGain[]
}

export interface XpGain {
  recruit_index: number
  name: string
  xp_earned: number
  reason: string
}

// --- Post-Battle sequence state ---

export interface PostBattleState {
  battle_id: BattleId
  warband_id: WarbandId
  current_phase: PostBattlePhase
  trauma_done: boolean
  promotions_done: boolean
  reinforcements_done: boolean
  exploration_done: boolean
  quartermaster_done: boolean
  trauma_results: TraumaResult[]
  promotions_pending: PromotionPending[]
  exploration_loot: LootItem[]
}

export interface TraumaResult {
  recruit_index: number
  name: string
  survived: boolean
  battle_scar: string | null
}

export interface PromotionPending {
  recruit_index: number
  name: string
  current_xp: number
  xp_threshold: number
  eligible: boolean
  available_skills: number[]
}

export interface LootItem {
  name: string
  type: string
  value: number
}

// ─── API Stubs ────────────────────────────────────────────────────

export async function getActiveCampaigns(): Promise<ActiveCampaign[]> {
  return [
    {
      id: 'campaign_cordoba',
      name: 'The Breach of Córdoba',
      description: 'Southern Spain, 1914. Fight for control of Andalusia.',
      map_id: 'cordoba',
      max_warbands: 16,
      enrolled_warbands: 8,
      status: 'active',
    },
    {
      id: 'campaign_jerusalem',
      name: 'Siege of Jerusalem — Season 2',
      description: 'The eternal siege continues. New offensives on all fronts.',
      map_id: 'jerusalem',
      max_warbands: 32,
      enrolled_warbands: 24,
      status: 'active',
    },
  ]
}

export async function getMyWarbandsInCampaign(_campaignId: CampaignId, _owner: string): Promise<CampaignWarband[]> {
  return [
    { id: 1, name: 'The Iron Crusaders', faction: 1, locked: false, post_battle_phase: null, pending_battle_id: null },
    { id: 2, name: 'Pilgrims of Wrath', faction: 2, locked: true, post_battle_phase: 'promotions', pending_battle_id: 'battle_002' },
  ]
}

export async function getWarbandRoster(_warbandId: WarbandId): Promise<Recruit[]> {
  return [
    { entry_id: 'HERETIC_PRIEST', name: 'Brother Marcus', items: ['SWORD_AXE', 'STANDARD_ARMOUR'], skills: [], xp: 4, battle_scars: 0 },
    { entry_id: 'DEATH_COMMANDO', name: 'Trooper Ezra', items: ['TRENCH_KNIFE'], skills: [1], xp: 7, battle_scars: 1 },
    { entry_id: 'DEATH_COMMANDO', name: 'Trooper Gaius', items: ['GAS_MASK'], skills: [], xp: 2, battle_scars: 0 },
    { entry_id: 'CHORISTER', name: 'Chorister Vex', items: [], skills: [], xp: 0, battle_scars: 0 },
  ]
}

export async function getPendingBattles(_campaignId: CampaignId): Promise<PendingBattle[]> {
  return [
    {
      id: 'battle_001',
      campaign_id: 'campaign_cordoba',
      location_id: 7,
      location_name: 'Carmona',
      challenger_warband: 3,
      challenger_name: "Mammon's Greed",
      defender_warband: null,
      defender_name: null,
      status: 'pending_opponent',
      created_at: Date.now() - 3600000,
    },
    {
      id: 'battle_002',
      campaign_id: 'campaign_cordoba',
      location_id: 11,
      location_name: 'Mezquita-Cathedral',
      challenger_warband: 1,
      challenger_name: 'The Iron Crusaders',
      defender_warband: 4,
      defender_name: "Sultan's Fist",
      status: 'awaiting_result',
      created_at: Date.now() - 86400000,
    },
  ]
}

export async function challengeLocation(
  _campaignId: CampaignId,
  _locationId: number,
  _warbandId: WarbandId,
): Promise<BattleId> {
  console.log('[stub] challengeLocation', { _campaignId, _locationId, _warbandId })
  return `battle_${Date.now()}`
}

export async function acceptChallenge(
  _battleId: BattleId,
  _warbandId: WarbandId,
): Promise<void> {
  console.log('[stub] acceptChallenge', { _battleId, _warbandId })
}

export async function submitBattleReport(_report: BattleReport): Promise<void> {
  console.log('[stub] submitBattleReport', _report)
}

export async function getBattleResult(_battleId: BattleId): Promise<BattleResult> {
  return {
    battle_id: _battleId,
    winner: 1,
    territory_captured: true,
    challenger_glory: 2,
    defender_glory: 1,
    challenger_xp: [
      { recruit_index: 0, name: 'Brother Marcus', xp_earned: 3, reason: 'Survived + won battle' },
      { recruit_index: 1, name: 'Trooper Ezra', xp_earned: 2, reason: 'Survived' },
      { recruit_index: 2, name: 'Trooper Gaius', xp_earned: 0, reason: 'Taken Out of Action' },
    ],
    defender_xp: [],
  }
}

export async function getPostBattleState(_warbandId: WarbandId, _battleId: BattleId): Promise<PostBattleState> {
  return {
    battle_id: _battleId,
    warband_id: _warbandId,
    current_phase: 'trauma',
    trauma_done: false,
    promotions_done: false,
    reinforcements_done: false,
    exploration_done: false,
    quartermaster_done: false,
    trauma_results: [
      { recruit_index: 2, name: 'Trooper Gaius', survived: true, battle_scar: 'Old wound (Movement -1")' },
    ],
    promotions_pending: [
      { recruit_index: 1, name: 'Trooper Ezra', current_xp: 9, xp_threshold: 10, eligible: false, available_skills: [] },
      { recruit_index: 0, name: 'Brother Marcus', current_xp: 7, xp_threshold: 10, eligible: false, available_skills: [] },
    ],
    exploration_loot: [
      { name: 'Ancient Relic', type: 'equipment', value: 20 },
    ],
  }
}

export async function advancePostBattle(
  _warbandId: WarbandId,
  _battleId: BattleId,
  _phase: PostBattlePhase,
  _decisions: Record<string, unknown>,
): Promise<PostBattleState> {
  console.log('[stub] advancePostBattle', { _warbandId, _battleId, _phase, _decisions })
  return getPostBattleState(_warbandId, _battleId)
}

export async function completePostBattle(
  _warbandId: WarbandId,
  _battleId: BattleId,
): Promise<void> {
  console.log('[stub] completePostBattle — warband unlocked', { _warbandId, _battleId })
}
