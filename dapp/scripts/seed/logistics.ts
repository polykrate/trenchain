/**
 * Logistics seed module:
 * 1. Compute region adjacency from hex_regions.json
 * 2. Compute BFS distances
 * 3. Seed recipes, terrain yields from logistics_test.json
 * 4. Seed ALL buildings from region_buildings.json (enriched)
 * 5. Compute base production per region from actual terrain composition
 * 6. Auto-generate demand based on buildings present
 */
import { loadJson, toCode32, toCode16, sudoBatch, sudoSend } from './shared';
import type { ChainClient, CallLike } from './shared';

function hexNeighbors(q: number, r: number): [number, number][] {
  const isOdd = q % 2 !== 0;
  if (isOdd) {
    return [[q+1,r], [q+1,r+1], [q,r+1], [q-1,r+1], [q-1,r], [q,r-1]];
  } else {
    return [[q+1,r-1], [q+1,r], [q,r+1], [q-1,r], [q-1,r-1], [q,r-1]];
  }
}

function computeAdjacency(regions: Record<string, { tiles: number[][] }>): Map<string, Set<string>> {
  const tileToRegion = new Map<string, string>();
  for (const [regionId, region] of Object.entries(regions)) {
    for (const [q, r] of region.tiles) {
      tileToRegion.set(`${q},${r}`, regionId);
    }
  }

  const adjacency = new Map<string, Set<string>>();
  for (const regionId of Object.keys(regions)) {
    adjacency.set(regionId, new Set());
  }

  for (const [regionId, region] of Object.entries(regions)) {
    for (const [q, r] of region.tiles) {
      for (const [nq, nr] of hexNeighbors(q, r)) {
        const neighborRegion = tileToRegion.get(`${nq},${nr}`);
        if (neighborRegion && neighborRegion !== regionId) {
          adjacency.get(regionId)!.add(neighborRegion);
        }
      }
    }
  }

  return adjacency;
}

function computeDistances(adjacency: Map<string, Set<string>>): Map<string, Map<string, number>> {
  const regions = Array.from(adjacency.keys());
  const distances = new Map<string, Map<string, number>>();

  for (const start of regions) {
    const dist = new Map<string, number>();
    dist.set(start, 0);
    const queue = [start];
    let qi = 0;
    while (qi < queue.length) {
      const current = queue[qi++];
      const d = dist.get(current)!;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!dist.has(neighbor)) {
          dist.set(neighbor, d + 1);
          queue.push(neighbor);
        }
      }
    }
    distances.set(start, dist);
  }

  return distances;
}

// Terrain yields (resource produced per tile of that terrain)
// Only buildings produce resources — terrain is passive except Iron Wall (lore: divine fortification)
const TERRAIN_YIELDS: Record<string, [string, number][]> = {
  plains:           [],
  temperate_forest: [],
  mountain:         [],
  marsh:            [],
  mediterranean:    [],
  steppe:           [],
  desert:           [],
  semi_arid:        [],
  taiga:            [],
  tundra:           [],
  snow:             [],
  volcanic:         [],
  iron_wall:        [['iron', 1]],
};

// What each building "demands" as routable goods (consumption per level per tick).
// Ducats are LOCAL-ONLY (currency, not physical goods) — never transported.
// Demands must match recipe inputs for the routing system to deliver the right resources.
const BUILDING_DEMANDS: Record<string, [string, number][]> = {
  barracks:           [['flesh', 1], ['iron', 1], ['powder', 1]],
  foundry:            [['iron', 2]],
  munitions_factory:  [['iron', 1]],
  alchemy_workshop:   [['iron', 1]],
  field_hospital:     [['flesh', 1]],
  apothecary:         [['flesh', 1]],
  trade_post:         [],
  refugee_camp:       [['flesh', 2]],
  market:             [['flesh', 1]],
  harbor_dock:        [],
  lumber_mill:        [],
  shrine:             [],
};

export async function seedLogistics(client: ChainClient, alice: any): Promise<void> {
  console.log('\n🚚 Seeding logistics...');

  const regions: Record<string, { tiles: number[][] }> = loadJson('hex_regions.json');
  const hexMap: { tiles: { q: number; r: number; t: string }[] } = loadJson('hex_map.json');
  const testData = loadJson('logistics_test.json');
  const regionBuildings: Record<string, { tile: number[]; building: string; level: number }[]> = loadJson('region_buildings.json');

  // Build tile → terrain lookup
  const tileTerrain = new Map<string, string>();
  for (const t of hexMap.tiles) {
    if (t.t !== 'sea') tileTerrain.set(`${t.q},${t.r}`, t.t);
  }

  // 1. Compute adjacency
  console.log('  Computing adjacency...');
  const adjacency = computeAdjacency(regions);
  const regionCodes = Object.keys(regions);
  console.log(`  Found ${regionCodes.length} regions, computing distances...`);

  // 2. Compute distances
  const distances = computeDistances(adjacency);

  // 3. Register known regions
  const regionCodeBytes = regionCodes.map(r => toCode32(r));
  await sudoSend(client, alice, {
    pallet: 'Logistics',
    palletCall: { name: 'RegisterRegions', params: { regions: regionCodeBytes } },
  });
  console.log(`  [Logistics] Registered ${regionCodes.length} regions`);

  // 4. Seed adjacency
  const adjCalls: CallLike[] = [];
  for (const [regionId, neighbors] of adjacency.entries()) {
    if (neighbors.size === 0) continue;
    const neighborsArr = Array.from(neighbors).slice(0, 12).map(n => toCode32(n));
    adjCalls.push({
      pallet: 'Logistics',
      palletCall: { name: 'SetAdjacency', params: { region: toCode32(regionId), neighbors: neighborsArr } },
    });
  }
  await sudoBatch(client, alice, 'Adjacency', adjCalls);

  // 5. Seed distances (pairs with dist <= 10)
  const distCalls: CallLike[] = [];
  const MAX_DIST = 10;
  let pairsBatch: [any, any, number][] = [];

  for (const [from, dists] of distances.entries()) {
    for (const [to, dist] of dists.entries()) {
      if (from >= to) continue;
      if (dist > MAX_DIST || dist === 0) continue;
      pairsBatch.push([toCode32(from), toCode32(to), dist]);
      if (pairsBatch.length >= 200) {
        distCalls.push({
          pallet: 'Logistics',
          palletCall: { name: 'SetDistances', params: { pairs: pairsBatch } },
        });
        pairsBatch = [];
      }
    }
  }
  if (pairsBatch.length > 0) {
    distCalls.push({
      pallet: 'Logistics',
      palletCall: { name: 'SetDistances', params: { pairs: pairsBatch } },
    });
  }
  await sudoBatch(client, alice, 'Distances', distCalls, 10);

  // 6. Seed recipes
  const recipeCalls: CallLike[] = [];
  for (const [buildingId, recipe] of Object.entries(testData.recipes) as [string, any][]) {
    recipeCalls.push({
      pallet: 'Production',
      palletCall: {
        name: 'SeedRecipe',
        params: {
          building: toCode32(buildingId),
          inputs: recipe.inputs.map(([r, q]: [string, number]) => [toCode16(r), q]),
          outputs: recipe.outputs.map(([r, q]: [string, number]) => [toCode16(r), q]),
        },
      },
    });
  }
  await sudoBatch(client, alice, 'Recipes', recipeCalls);

  // 7. Seed terrain yields (use terrain name as sequential ID)
  const terrainNameToId: Record<string, number> = {};
  let tid = 0;
  for (const name of Object.keys(TERRAIN_YIELDS)) {
    terrainNameToId[name] = tid++;
  }

  const tyieldCalls: CallLike[] = [];
  for (const [terrainName, yields] of Object.entries(TERRAIN_YIELDS)) {
    const terrainId = terrainNameToId[terrainName];
    if (terrainId === undefined) continue;
    tyieldCalls.push({
      pallet: 'Production',
      palletCall: {
        name: 'SeedTerrainYield',
        params: { terrainId, yields: yields.map(([r, q]) => [toCode16(r), q]) },
      },
    });
  }
  await sudoBatch(client, alice, 'TerrainYields', tyieldCalls);

  // 8. Seed ALL buildings from region_buildings.json
  const buildCalls: CallLike[] = [];
  let totalBuildings = 0;
  for (const [regionId, buildings] of Object.entries(regionBuildings)) {
    for (const b of buildings) {
      buildCalls.push({
        pallet: 'Production',
        palletCall: {
          name: 'SeedBuilding',
          params: {
            region: toCode32(regionId),
            tile: [b.tile[0], b.tile[1]] as [number, number],
            building: toCode32(b.building),
            level: b.level,
          },
        },
      });
      totalBuildings++;
    }
  }
  await sudoBatch(client, alice, 'Buildings', buildCalls);
  console.log(`  [Buildings] ${totalBuildings} placed across ${Object.keys(regionBuildings).length} regions`);

  // 9. Compute and seed base production for ALL regions from actual terrain tiles
  const baseProdCalls: CallLike[] = [];
  for (const [regionId, regionDef] of Object.entries(regions)) {
    const production = new Map<string, number>();
    for (const [q, r] of regionDef.tiles) {
      const terrain = tileTerrain.get(`${q},${r}`);
      if (!terrain) continue;
      const yields = TERRAIN_YIELDS[terrain];
      if (!yields) continue;
      for (const [res, qty] of yields) {
        production.set(res, (production.get(res) || 0) + qty);
      }
    }
    if (production.size === 0) continue;
    const prodArray = Array.from(production.entries()).map(([res, qty]) => [toCode16(res), qty] as [any, number]);
    baseProdCalls.push({
      pallet: 'Production',
      palletCall: {
        name: 'SeedBaseProduction',
        params: { region: toCode32(regionId), production: prodArray },
      },
    });
  }
  await sudoBatch(client, alice, 'BaseProduction', baseProdCalls);
  console.log(`  [BaseProduction] ${baseProdCalls.length} regions with terrain yields`);

  // 10. Auto-generate demand based on buildings in each region
  const demandCalls: CallLike[] = [];
  for (const [regionId, buildings] of Object.entries(regionBuildings)) {
    const demandMap = new Map<string, number>();
    for (const b of buildings) {
      const needs = BUILDING_DEMANDS[b.building];
      if (!needs) continue;
      for (const [res, qty] of needs) {
        demandMap.set(res, (demandMap.get(res) || 0) + qty * b.level);
      }
    }
    if (demandMap.size === 0) continue;
    const demandArray = Array.from(demandMap.entries()).map(([res, qty]) => [toCode16(res), qty] as [any, number]);
    demandCalls.push({
      pallet: 'Demand',
      palletCall: {
        name: 'SetRegionDemand',
        params: { region: toCode32(regionId), demands: demandArray },
      },
    });
  }
  await sudoBatch(client, alice, 'Demand', demandCalls);
  console.log(`  [Demand] ${demandCalls.length} regions with demand`);

  // 11. Seed min stock (keep a strategic reserve before exporting)
  const minStockCalls: CallLike[] = [];
  for (const regionId of regionCodes) {
    const buildings = regionBuildings[regionId];
    if (!buildings || buildings.length === 0) continue;
    // Regions with barracks/foundry keep reserves
    const hasBarracks = buildings.some(b => b.building === 'barracks');
    const hasFoundry = buildings.some(b => b.building === 'foundry');
    if (hasBarracks) {
      minStockCalls.push({
        pallet: 'Logistics',
        palletCall: { name: 'SetMinStock', params: { region: toCode32(regionId), resource: toCode16('flesh'), threshold: 5 } },
      });
      minStockCalls.push({
        pallet: 'Logistics',
        palletCall: { name: 'SetMinStock', params: { region: toCode32(regionId), resource: toCode16('powder'), threshold: 3 } },
      });
    }
    if (hasFoundry) {
      minStockCalls.push({
        pallet: 'Logistics',
        palletCall: { name: 'SetMinStock', params: { region: toCode32(regionId), resource: toCode16('iron'), threshold: 5 } },
      });
    }
  }
  await sudoBatch(client, alice, 'MinStock', minStockCalls);
  console.log(`  [MinStock] ${minStockCalls.length} thresholds set`);

  console.log('  ✓ Logistics seeding complete');
}
