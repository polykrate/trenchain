import { getChainClient } from '../hooks/useChainClient';
import { decodeBytes, decodeCode } from '../lib/chainCodec';
import type { WarbandId } from './warband';

export interface Recruit {
  entryCode: string;
  name: string;
  items: string[];
  skills: string[];
  xp: number;
  battleScars: number;
  isElite: boolean;
}

export async function getRoster(warbandId: WarbandId): Promise<Recruit[]> {
  const client = await getChainClient();
  const raw = await client.query.roster.roster(warbandId);
  if (!raw) return [];
  return (raw as any[]).map((r: any) => ({
    entryCode: decodeCode(r.entryId ?? r.entry_id),
    name: decodeBytes(r.name),
    items: (r.items ?? []).map((i: any) => decodeCode(i)),
    skills: (r.skills ?? []).map((s: any) => decodeCode(s)),
    xp: r.xp ?? 0,
    battleScars: r.battleScars ?? r.battle_scars ?? 0,
    isElite: r.isElite ?? r.is_elite ?? false,
  }));
}
