import { loadJson, toCode32, toCode16, toBytes, sudoSend } from './shared';
import type { ChainClient } from './shared';

interface TheatreJson {
  id: string;
  name: string;
  description: string;
  lore: string;
  regions: string[];
  objectives: {
    primary: string;
    secondaries: {
      kind: string;
      target_tile?: [number, number];
      target_resource?: string;
      vp_reward: number;
    }[];
  };
}

export async function seedTheatre(client: ChainClient, alice: any) {
  console.log('🎭 Seeding theatre...');
  const theatreData: TheatreJson = loadJson('theatre_cordoba.json');
  const theatreCode = toCode32(theatreData.id);

  const regions = theatreData.regions.map(r => toCode32(r));

  await sudoSend(client, alice, { pallet: 'Theatre', palletCall: { name: 'CreateTheatre', params: {
    code: theatreCode,
    name: toBytes(theatreData.name.slice(0, 128)),
    description: toBytes(theatreData.description.slice(0, 512)),
    lore: toBytes(theatreData.lore.slice(0, 512)),
    regions,
  }}});
  console.log(`  [Theatre] Created "${theatreData.name}" with ${regions.length} regions`);

  const primaryMap: Record<string, string> = { elimination: 'Elimination' };
  const kindMap: Record<string, string> = { kill_leader: 'KillLeader', loot_resource: 'LootResource' };

  const EMPTY_RESOURCE = toCode16('');
  const secondaries = theatreData.objectives.secondaries.map(s => ({
    kind: kindMap[s.kind] || 'KillLeader' as any,
    targetTileQ: s.target_tile != null ? s.target_tile[0] : -1,
    targetTileR: s.target_tile != null ? s.target_tile[1] : -1,
    targetResource: s.target_resource != null ? toCode16(s.target_resource) : EMPTY_RESOURCE,
    vpReward: s.vp_reward,
  }));

  await sudoSend(client, alice, { pallet: 'Theatre', palletCall: { name: 'SetObjectives', params: {
    theatre: theatreCode,
    primary: primaryMap[theatreData.objectives.primary] || 'Elimination',
    secondaries,
  }}});
  console.log(`  [Theatre Objectives] primary=${theatreData.objectives.primary}, ${secondaries.length} secondaries`);
}
