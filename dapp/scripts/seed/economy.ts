import { loadJson, toCode32, toCode16, sudoBatch } from './shared';
import type { ChainClient } from './shared';

export async function seedBuildings(client: ChainClient, alice: any) {
  const { buildings } = loadJson('economy.json');
  await sudoBatch(client, alice, 'Buildings', buildings.map((b: any) => ({
    pallet: 'Building', palletCall: { name: 'RegisterBuilding', params: {
      code: toCode32(b.id), name: b.name,
      produces: (b.produces || []).slice(0, 8).map((p: any) => [toCode16(p.resource), p.output]),
      buildCost: (b.build_cost || []).slice(0, 8).map((c: any) => [toCode16(c.resource), c.amount]),
      allowedTerrains: (b.allowed_terrain || []).slice(0, 8).map((t: string) => toCode16(t)),
      upgradeLevels: b.upgrade_levels || 1,
    }},
  })));
}

export async function seedResources(client: ChainClient, alice: any) {
  const resources = loadJson('resources.json');
  await sudoBatch(client, alice, 'Resources', resources.map((r: any) => ({
    pallet: 'Building', palletCall: { name: 'RegisterResource', params: {
      code: toCode16(r.code), name: toCode32(r.name),
    }},
  })));
}

export async function seedEconomy(client: ChainClient, alice: any) {
  console.log('💰 Seeding economy...');
  await seedBuildings(client, alice);
  await seedResources(client, alice);
}
