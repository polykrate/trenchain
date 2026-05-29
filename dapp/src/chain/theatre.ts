import { getChainClient } from '../hooks/useChainClient';
import { decodeBytes, decodeCode, toCode32 } from '../lib/chainCodec';

export interface SecondaryObjective {
  kind: 'kill_leader' | 'loot_resource';
  targetTile: [number, number] | null;
  targetResource: string | null;
  vpReward: number;
}

export interface TheatreObjectives {
  primary: 'elimination';
  secondaries: SecondaryObjective[];
}

export interface Theatre {
  id: string;
  name: string;
  description: string;
  lore: string;
  regions: string[];
  objectives: TheatreObjectives | null;
  status: 'active' | 'draft';
}

export async function getTheatres(): Promise<Theatre[]> {
  const client = await getChainClient();
  const q = client.query as any;
  const entries = await q.theatre.theatres.entries();
  const theatres: Theatre[] = [];

  for (const [key, def] of entries) {
    const code = decodeCode(key);
    if (!def) continue;

    let regions: string[] = [];
    try {
      const regionsRaw = await q.theatre.theatreRegions(toCode32(code));
      regions = (regionsRaw ?? []).map((r: any) => decodeCode(r));
    } catch { /* no regions */ }

    let objectives: TheatreObjectives | null = null;
    try {
      const objRaw = await q.theatre.theatreObjectives(toCode32(code));
      if (objRaw) {
        const obj = objRaw as any;
        objectives = {
          primary: 'elimination',
          secondaries: (obj.secondaries ?? []).map((s: any) => ({
            kind: s.kind?.type === 'LootResource' ? 'loot_resource' : 'kill_leader',
            targetTile: (s.targetTileQ >= 0 && s.targetTileR >= 0) ? [s.targetTileQ, s.targetTileR] as [number, number] : null,
            targetResource: s.targetResource ? decodeCode(s.targetResource) : null,
            vpReward: s.vpReward ?? 0,
          })),
        };
      }
    } catch { /* objectives not set yet */ }

    theatres.push({
      id: code,
      name: decodeBytes((def as any).name),
      description: decodeBytes((def as any).description),
      lore: decodeBytes((def as any).lore),
      regions,
      objectives,
      status: objectives ? 'active' : 'draft',
    });
  }

  return theatres;
}

export async function getTheatre(id: string): Promise<Theatre | null> {
  const client = await getChainClient();
  const q = client.query as any;
  const code32 = toCode32(id);
  const def = await q.theatre.theatres(code32) as any;
  if (!def) return null;

  let regions: string[] = [];
  try {
    const regionsRaw = await q.theatre.theatreRegions(code32);
    regions = (regionsRaw ?? []).map((r: any) => decodeCode(r));
  } catch { /* no regions */ }

  let objectives: TheatreObjectives | null = null;
  try {
    const objRaw = await q.theatre.theatreObjectives(code32);
    if (objRaw) {
      const obj = objRaw as any;
      objectives = {
        primary: 'elimination',
        secondaries: (obj.secondaries ?? []).map((s: any) => ({
          kind: s.kind?.type === 'LootResource' ? 'loot_resource' : 'kill_leader',
          targetTile: (s.targetTileQ >= 0 && s.targetTileR >= 0) ? [s.targetTileQ, s.targetTileR] as [number, number] : null,
          targetResource: s.targetResource ? decodeCode(s.targetResource) : null,
          vpReward: s.vpReward ?? 0,
        })),
      };
    }
  } catch { /* objectives not set yet */ }

  return {
    id,
    name: decodeBytes(def.name),
    description: decodeBytes(def.description),
    lore: decodeBytes(def.lore),
    regions,
    objectives,
    status: objectives ? 'active' : 'draft',
  };
}

export async function createTheatre(_data: Partial<Theatre>): Promise<string> {
  return `theatre_${Date.now()}`;
}
