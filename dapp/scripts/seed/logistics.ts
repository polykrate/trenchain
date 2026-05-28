/**
 * Logistics seed module:
 * 1. Compute region adjacency from hex_regions.json
 * 2. Compute BFS distances
 * 3. Seed recipes, terrain yields, buildings, demand, min_stock for test regions
 */
import { loadJson, toCode32, toCode16, sudoBatch, sudoSend } from './shared';
import type { ChainClient, CallLike } from './shared';

// Hex neighbor offsets for pointy-top hexagons (odd-q offset)
function hexNeighbors(q: number, r: number): [number, number][] {
  const isOdd = q % 2 !== 0;
  if (isOdd) {
    return [[q+1,r], [q+1,r+1], [q,r+1], [q-1,r+1], [q-1,r], [q,r-1]];
  } else {
    return [[q+1,r-1], [q+1,r], [q,r+1], [q-1,r], [q-1,r-1], [q,r-1]];
  }
}

function computeAdjacency(regions: Record<string, { tiles: number[][] }>): Map<string, Set<string>> {
  // Build tile -> region lookup
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

export async function seedLogistics(client: ChainClient, alice: any): Promise<void> {
  console.log('\n🚚 Seeding logistics...');

  const regions: Record<string, { tiles: number[][] }> = loadJson('hex_regions.json');
  const testData = loadJson('logistics_test.json');

  // 1. Compute adjacency
  console.log('  Computing adjacency...');
  const adjacency = computeAdjacency(regions);
  const regionCodes = Object.keys(regions);
  console.log(`  Found ${regionCodes.length} regions, computing distances...`);

  // 2. Compute distances
  const distances = computeDistances(adjacency);

  // 3. Register known regions
  const regionCodeBytes = regionCodes.map(r => toCode32(r));
  const registerCall: CallLike = {
    pallet: 'Logistics',
    palletCall: {
      name: 'RegisterRegions',
      params: { regions: regionCodeBytes },
    },
  };
  await sudoSend(client, alice, registerCall);
  console.log(`  [Logistics] Registered ${regionCodes.length} regions`);

  // 4. Seed adjacency
  const adjCalls: CallLike[] = [];
  for (const [regionId, neighbors] of adjacency.entries()) {
    if (neighbors.size === 0) continue;
    const neighborsArr = Array.from(neighbors).slice(0, 12).map(n => toCode32(n));
    adjCalls.push({
      pallet: 'Logistics',
      palletCall: {
        name: 'SetAdjacency',
        params: { region: toCode32(regionId), neighbors: neighborsArr },
      },
    });
  }
  await sudoBatch(client, alice, 'Adjacency', adjCalls);

  // 5. Seed distances (batched, only pairs with dist <= 10 to keep it manageable)
  const distCalls: CallLike[] = [];
  const MAX_DIST = 10;
  const pairsPerBatch = 200;
  let pairsBatch: [any, any, number][] = [];

  for (const [from, dists] of distances.entries()) {
    for (const [to, dist] of dists.entries()) {
      if (from >= to) continue; // only one direction (set_distances stores both)
      if (dist > MAX_DIST || dist === 0) continue;
      pairsBatch.push([toCode32(from), toCode32(to), dist]);
      if (pairsBatch.length >= pairsPerBatch) {
        distCalls.push({
          pallet: 'Logistics',
          palletCall: {
            name: 'SetDistances',
            params: { pairs: pairsBatch },
          },
        });
        pairsBatch = [];
      }
    }
  }
  if (pairsBatch.length > 0) {
    distCalls.push({
      pallet: 'Logistics',
      palletCall: {
        name: 'SetDistances',
        params: { pairs: pairsBatch },
      },
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

  // 7. Seed terrain yields
  // We need a terrain name -> terrain ID mapping. Read hex_map for terrain info.
  const terrainMap = loadJson('hex_map.json');
  const terrainNameToId: Record<string, number> = {};
  if (terrainMap.terrain_ids) {
    for (const [name, id] of Object.entries(terrainMap.terrain_ids) as [string, number][]) {
      terrainNameToId[name] = id;
    }
  } else {
    // Fallback: assign sequential IDs based on the terrain_yields keys
    let id = 0;
    for (const name of Object.keys(testData.terrain_yields)) {
      terrainNameToId[name] = id++;
    }
  }

  const tyieldCalls: CallLike[] = [];
  for (const [terrainName, yields] of Object.entries(testData.terrain_yields) as [string, [string, number][]][]) {
    const terrainId = terrainNameToId[terrainName];
    if (terrainId === undefined) continue;
    tyieldCalls.push({
      pallet: 'Production',
      palletCall: {
        name: 'SeedTerrainYield',
        params: {
          terrainId,
          yields: yields.map(([r, q]) => [toCode16(r), q]),
        },
      },
    });
  }
  await sudoBatch(client, alice, 'TerrainYields', tyieldCalls);

  // 8. Seed test buildings
  const buildCalls: CallLike[] = [];
  for (const [regionId, buildings] of Object.entries(testData.test_buildings) as [string, any[]][]) {
    for (const b of buildings) {
      buildCalls.push({
        pallet: 'Production',
        palletCall: {
          name: 'SeedBuilding',
          params: {
            region: toCode32(regionId),
            tile: [b.tile[0], b.tile[1]],
            building: toCode32(b.building),
            level: b.level,
          },
        },
      });
    }
  }
  await sudoBatch(client, alice, 'Buildings', buildCalls);

  // 9. Seed demand
  const demandCalls: CallLike[] = [];
  for (const [regionId, demands] of Object.entries(testData.test_demand) as [string, [string, number][]][]) {
    demandCalls.push({
      pallet: 'Demand',
      palletCall: {
        name: 'SetRegionDemand',
        params: {
          region: toCode32(regionId),
          demands: demands.map(([r, q]) => [toCode16(r), q]),
        },
      },
    });
  }
  await sudoBatch(client, alice, 'Demand', demandCalls);

  // 10. Seed min stock
  const minStockCalls: CallLike[] = [];
  for (const [regionId, resources] of Object.entries(testData.test_min_stock) as [string, Record<string, number>][]) {
    for (const [res, threshold] of Object.entries(resources)) {
      minStockCalls.push({
        pallet: 'Logistics',
        palletCall: {
          name: 'SetMinStock',
          params: {
            region: toCode32(regionId),
            resource: toCode16(res),
            threshold,
          },
        },
      });
    }
  }
  await sudoBatch(client, alice, 'MinStock', minStockCalls);

  // 11. Seed base production for test regions (pre-computed sum of terrain yields)
  // For the test we just compute a simple base production based on tile count
  const baseProdCalls: CallLike[] = [];
  const testRegions = Object.keys(testData.test_buildings);
  for (const regionId of testRegions) {
    const regionDef = regions[regionId];
    if (!regionDef) continue;
    // Simple approximation: each tile gives 1 flesh (from terrain)
    const tileCount = regionDef.tiles.length;
    baseProdCalls.push({
      pallet: 'Production',
      palletCall: {
        name: 'SeedBaseProduction',
        params: {
          region: toCode32(regionId),
          production: [[toCode16('flesh'), Math.floor(tileCount / 3)]],
        },
      },
    });
  }
  await sudoBatch(client, alice, 'BaseProduction', baseProdCalls);

  console.log('  ✓ Logistics seeding complete');
}
