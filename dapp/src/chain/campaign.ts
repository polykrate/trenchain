import { getChainClient } from '../hooks/useChainClient';
import { decodeBytes } from '../lib/chainCodec';

export type CampaignId = number;

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
