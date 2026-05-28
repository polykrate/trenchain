import { getChainClient } from '../hooks/useChainClient';
import { decodeBytes } from '../lib/chainCodec';
import type { Recruit } from './roster';

export type CampaignId = number;
export type PostBattlePhase = 'trauma' | 'promotions' | 'reinforcements' | 'exploration' | 'quartermaster' | 'done';

export interface ActiveCampaign {
  id: CampaignId;
  name: string;
  status: string;
  description: string;
  enrolled_warbands: number;
  max_warbands: number;
}

export interface CampaignWarband {
  id: number;
  name: string;
  locked: boolean;
  pending_battle_id: number | null;
  post_battle_phase: PostBattlePhase | null;
}

export interface PendingBattle {
  id: number;
  status: 'pending_opponent' | 'awaiting_result';
  location_name: string;
  challenger_warband: number;
  challenger_name: string;
  defender_warband: number | null;
  defender_name: string | null;
}

export interface ModelCasualty {
  recruit_index: number;
  name: string;
  out_of_action: boolean;
  killed: boolean;
}

export interface BattleResult {
  winner: number | null;
  territory_captured: boolean;
  challenger_glory: number;
  defender_glory: number;
  challenger_xp: { name: string; xp_earned: number; reason: string }[];
  defender_xp: { name: string; xp_earned: number; reason: string }[];
}

export interface PostBattleState {
  current_phase: PostBattlePhase;
  trauma_results: { name: string; survived: boolean; battle_scar: string | null }[];
  promotions_pending: { name: string; current_xp: number; xp_threshold: number; eligible: boolean }[];
  exploration_loot: { name: string; type: string; value: number }[];
}

export async function getActiveCampaigns(): Promise<ActiveCampaign[]> {
  const all = await getAllCampaigns();
  return all.map(c => ({
    id: c.id,
    name: c.name,
    status: typeof c.status === 'string' ? c.status.toLowerCase() : 'active',
    description: `Campaign #${c.id}`,
    enrolled_warbands: c.enrolledWarbands.length,
    max_warbands: c.maxWarbands,
  }));
}

export async function getMyWarbandsInCampaign(_campaignId: CampaignId, _owner: string): Promise<CampaignWarband[]> {
  return [];
}

export async function getPendingBattles(_campaignId: CampaignId): Promise<PendingBattle[]> {
  return [];
}

export async function challengeLocation(_campaignId: CampaignId, _locationId: number, _warbandId: number): Promise<void> {}

export async function getWarbandRoster(_warbandId: number): Promise<Recruit[]> {
  return [];
}

export async function submitBattleReport(_report: any): Promise<void> {}

export async function getPostBattleState(_warbandId: number, _battleId: number): Promise<PostBattleState> {
  return { current_phase: 'done', trauma_results: [], promotions_pending: [], exploration_loot: [] };
}

export async function getBattleResult(_battleId: number): Promise<BattleResult> {
  return { winner: null, territory_captured: false, challenger_glory: 0, defender_glory: 0, challenger_xp: [], defender_xp: [] };
}

export async function advancePostBattle(_warbandId: number, _battleId: number, _phase: PostBattlePhase, _data: any): Promise<PostBattleState> {
  return { current_phase: 'done', trauma_results: [], promotions_pending: [], exploration_loot: [] };
}

export async function completePostBattle(_warbandId: number, _battleId: number): Promise<void> {}

export interface CampaignMeta {
  id: CampaignId;
  creator: string;
  name: string;
  theatreId: string;
  status: 'Recruiting' | 'Active' | 'Concluded';
  maxWarbands: number;
  currentGame: number;
  enrolledWarbands: number[];
}

export async function getCampaign(id: CampaignId): Promise<CampaignMeta | null> {
  const client = await getChainClient();
  const raw = await client.query.campaign.campaigns(id);
  if (!raw) return null;
  const r = raw as any;
  const enrolled = await client.query.campaign.enrollments(id);
  return {
    id,
    creator: r.creator?.toString?.() ?? r.creator,
    name: decodeBytes(r.name),
    theatreId: decodeBytes(r.theatreId ?? r.theatre_id),
    status: r.status?.type ?? r.status ?? 'Recruiting',
    maxWarbands: r.maxWarbands ?? r.max_warbands ?? 16,
    currentGame: r.currentGame ?? r.current_game ?? 0,
    enrolledWarbands: (enrolled as any) ?? [],
  };
}

export async function getAllCampaigns(): Promise<CampaignMeta[]> {
  const client = await getChainClient();
  const entries = await client.query.campaign.campaigns.entries();
  const results: CampaignMeta[] = [];
  for (const [key, value] of entries) {
    const id = key as any as number;
    const r = value as any;
    const enrolled = await client.query.campaign.enrollments(id);
    results.push({
      id,
      creator: r.creator?.toString?.() ?? r.creator,
      name: decodeBytes(r.name),
      theatreId: decodeBytes(r.theatreId ?? r.theatre_id),
      status: r.status?.type ?? r.status ?? 'Recruiting',
      maxWarbands: r.maxWarbands ?? r.max_warbands ?? 16,
      currentGame: r.currentGame ?? r.current_game ?? 0,
      enrolledWarbands: (enrolled as any) ?? [],
    });
  }
  return results;
}
