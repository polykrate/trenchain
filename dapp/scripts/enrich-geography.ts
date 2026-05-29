/**
 * Geographic enrichment script.
 *
 * 1. Diversifies terrain biomes in hex_map.json (breaks monotonous regions)
 * 2. Assigns gameplay "node types" to tiles (city, port, mine, forest, etc.)
 * 3. Places buildings coherently based on node types + economy.json constraints
 * 4. Names notable tiles with real geographic names where known
 * 5. Updates logistics_test.json with full building placements per region
 *
 * Usage: npx tsx scripts/enrich-geography.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const DATA_DIR = resolve(import.meta.dirname, '../src/data/rules');

function load(name: string) {
  return JSON.parse(readFileSync(resolve(DATA_DIR, name), 'utf-8'));
}

function save(name: string, data: any) {
  writeFileSync(resolve(DATA_DIR, name), JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Load data ──────────────────────────────────────────────────────────────

const hexMap = load('hex_map.json');
const hexRegions: Record<string, { name: string; country: string; tiles: number[][]; control: string }> = load('hex_regions.json');
const hexCountries: Record<string, { name: string; faction: string; regions: string[] }> = load('hex_countries.json');
const economy = load('economy.json');

// Build tile lookup: "q,r" -> tile object
const tileLookup = new Map<string, any>();
for (const tile of hexMap.tiles) {
  tileLookup.set(`${tile.q},${tile.r}`, tile);
}

// ─── Constants ──────────────────────────────────────────────────────────────

const BIOMES = ['plains', 'temperate_forest', 'desert', 'taiga', 'mountain', 'steppe', 'semi_arid', 'mediterranean', 'marsh', 'iron_wall'] as const;

// Biome -> gameplay terrain mapping (what gameplay node type a biome naturally supports)
const BIOME_TO_GAMEPLAY: Record<string, string[]> = {
  plains: ['plains', 'village', 'crossroads', 'encampment'],
  temperate_forest: ['forest', 'village'],
  desert: ['plains', 'ruins'],
  taiga: ['forest', 'village'],
  mountain: ['mountain', 'mine', 'mountain_pass', 'fortress'],
  steppe: ['plains', 'encampment', 'crossroads'],
  semi_arid: ['plains', 'ruins', 'encampment'],
  mediterranean: ['village', 'coastal', 'plains'],
  marsh: ['marsh'],
  iron_wall: [],
};

// Latitude bands (row ranges) for biome enrichment
function latitudeBand(r: number): 'arctic' | 'boreal' | 'temperate' | 'subtropical' | 'arid' {
  if (r <= 10) return 'arctic';
  if (r <= 18) return 'boreal';
  if (r <= 35) return 'temperate';
  if (r <= 45) return 'subtropical';
  return 'arid';
}

// What extra biomes fit each latitude
const LATITUDE_VARIETY: Record<string, string[]> = {
  arctic: ['taiga', 'mountain', 'marsh'],
  boreal: ['taiga', 'mountain', 'marsh'],
  temperate: ['temperate_forest', 'mountain', 'marsh', 'plains'],
  subtropical: ['mediterranean', 'semi_arid', 'mountain', 'steppe'],
  arid: ['desert', 'semi_arid', 'mountain', 'steppe'],
};

// Hex neighbors (offset coordinates, even/odd q)
function hexNeighbors(q: number, r: number): [number, number][] {
  const isOdd = q % 2 !== 0;
  if (isOdd) return [[q+1,r],[q+1,r+1],[q,r+1],[q-1,r+1],[q-1,r],[q,r-1]];
  return [[q+1,r-1],[q+1,r],[q,r+1],[q-1,r],[q-1,r-1],[q,r-1]];
}

function isAdjacentToSea(q: number, r: number): boolean {
  for (const [nq, nr] of hexNeighbors(q, r)) {
    const t = tileLookup.get(`${nq},${nr}`);
    if (t && t.t === 'sea') return true;
  }
  return false;
}

// Seeded random for reproducibility
let seed = 42;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)]; }

// ─── Phase 1: Terrain Enrichment ────────────────────────────────────────────

console.log('Phase 1: Enriching terrain diversity...');

let enriched = 0;
const regionStats: Record<string, { biomes: Record<string, number>; tileCount: number }> = {};

for (const [regionId, region] of Object.entries(hexRegions)) {
  const biomeCount: Record<string, number> = {};
  for (const [q, r] of region.tiles) {
    const tile = tileLookup.get(`${q},${r}`);
    if (!tile) continue;
    biomeCount[tile.t] = (biomeCount[tile.t] || 0) + 1;
  }
  regionStats[regionId] = { biomes: biomeCount, tileCount: region.tiles.length };

  const distinctBiomes = Object.keys(biomeCount).length;
  if (distinctBiomes > 2 || region.tiles.length < 5) continue;

  // Monotonous region — inject variety
  const dominantBiome = Object.entries(biomeCount).sort((a, b) => b[1] - a[1])[0][0];
  if (dominantBiome === 'iron_wall') continue;

  const targetVariety = Math.min(4, Math.max(2, Math.floor(region.tiles.length / 5)));
  const avgR = region.tiles.reduce((s, t) => s + t[1], 0) / region.tiles.length;
  const band = latitudeBand(avgR);
  const candidates = LATITUDE_VARIETY[band].filter(b => b !== dominantBiome);

  // Assign variety to ~20-30% of tiles
  const tilesToChange = Math.floor(region.tiles.length * 0.25);
  let changed = 0;

  for (const [q, r] of region.tiles) {
    if (changed >= tilesToChange) break;
    const tile = tileLookup.get(`${q},${r}`);
    if (!tile || tile.t !== dominantBiome) continue;
    if (tile.w) continue; // don't touch iron_wall water tiles

    // Coastal tiles become mediterranean or marsh
    if (isAdjacentToSea(q, r)) {
      if (band === 'subtropical' || band === 'temperate') {
        tile.t = 'mediterranean';
      } else if (band === 'boreal' || band === 'arctic') {
        tile.t = rand() > 0.5 ? 'marsh' : 'taiga';
      }
      changed++;
      enriched++;
      continue;
    }

    // Interior tiles get variety from latitude candidates
    if (candidates.length > 0 && rand() < 0.4) {
      tile.t = pick(candidates.slice(0, targetVariety));
      changed++;
      enriched++;
    }
  }
}

console.log(`  Enriched ${enriched} tiles across regions`);

// ─── Phase 2: Assign gameplay node types ────────────────────────────────────

console.log('Phase 2: Assigning gameplay node types...');

interface TileFeature {
  q: number;
  r: number;
  nodeType: string;
  name?: string;
  buildings: { id: string; level: number }[];
}

const regionFeatures: Record<string, TileFeature[]> = {};

// Notable real-world locations for naming
const NOTABLE_CITIES: Record<string, Record<string, string>> = {
  gb_northern_england: { '9,20': 'York', '10,19': 'Durham', '9,17': 'Carlisle' },
  gb_southern_england: { '10,23': 'London', '9,24': 'Canterbury', '9,23': 'Winchester' },
  gb_eastern_england: { '12,22': 'Norwich', '11,21': 'Cambridge', '13,22': 'Ipswich' },
  gb_wales: { '7,22': 'Cardiff', '8,21': 'Caernarvon' },
  gb_scottish_lowlands: { '8,16': 'Edinburgh', '7,16': 'Glasgow' },
  fr_ile_de_france: { '15,27': 'Paris' },
  fr_normandie: { '12,27': 'Rouen', '14,27': 'Caen' },
  fr_bretagne: { '8,28': 'Rennes', '6,28': 'Brest' },
  fr_aquitaine: { '12,32': 'Bordeaux' },
  fr_languedoc: { '15,34': 'Toulouse', '16,35': 'Montpellier' },
  de_rhineland: { '23,24': 'Köln', '22,25': 'Frankfurt' },
  de_bavaria: { '29,27': 'München', '28,26': 'Nürnberg' },
  de_saxony: { '28,22': 'Dresden', '27,22': 'Leipzig' },
  nl_netherlands: { '20,22': 'Amsterdam', '21,22': 'Utrecht' },
  be_flanders: { '18,24': 'Bruxelles', '19,24': 'Gent' },
  es_castilla_y_leon: { '7,36': 'Burgos', '6,37': 'Valladolid' },
  es_castilla_la_mancha: { '9,39': 'Toledo', '8,39': 'Madrid' },
  es_cataluna: { '15,37': 'Barcelona' },
  es_andalucia: { '7,42': 'Córdoba', '6,43': 'Sevilla' },
  pt_portugal: { '1,39': 'Lisboa', '1,38': 'Porto' },
  it_lombardia: { '26,31': 'Milano', '27,32': 'Verona' },
  it_toscana: { '29,34': 'Firenze', '28,35': 'Siena' },
  it_lazio: { '30,36': 'Roma' },
  it_piedmont: { '24,32': 'Torino', '23,31': 'Genova' },
  ch_switzerland: { '24,30': 'Bern', '23,29': 'Genève' },
  at_austria: { '33,29': 'Wien', '31,29': 'Salzburg' },
  hu_hungary: { '41,29': 'Budapest', '40,30': 'Pécs' },
  pl_greater_poland: { '38,21': 'Poznań', '39,22': 'Warszawa' },
  cz_bohemia: { '33,25': 'Praha', '35,26': 'Brno' },
  dk_denmark: { '26,16': 'København', '25,16': 'Odense' },
  se_gotaland: { '32,14': 'Göteborg', '33,13': 'Stockholm' },
  no_stlandet: { '24,10': 'Oslo', '23,11': 'Bergen' },
  ru_muscovy: { '64,16': 'Moskva', '63,17': 'Tver' },
  ru_novgorod: { '56,12': 'Novgorod', '55,13': 'Pskov' },
  ua_kyiv: { '54,25': 'Kyiv', '53,24': 'Chernihiv' },
  tr_central_anatolia: { '62,40': 'Ankara', '60,39': 'Konya' },
  tr_marmara: { '52,37': 'Constantinople' },
  eg_lower_egypt: { '55,49': 'Cairo', '56,49': 'Alexandria' },
  iq_iraq: { '74,46': 'Baghdad', '72,45': 'Basra' },
  ma_northern_morocco: { '7,45': 'Fès', '8,46': 'Meknès' },
  dz_tell_atlas: { '14,44': 'Alger', '18,43': 'Constantine' },
  tn_tunisia: { '25,44': 'Tunis', '26,45': 'Kairouan' },
};

const terrainBuildings: Record<string, string[]> = economy.terrain_buildings.mappings;

for (const [regionId, region] of Object.entries(hexRegions)) {
  const features: TileFeature[] = [];
  const tiles = region.tiles;
  if (tiles.length === 0) continue;

  // Find the "center" tile (closest to centroid)
  const avgQ = tiles.reduce((s, t) => s + t[0], 0) / tiles.length;
  const avgR = tiles.reduce((s, t) => s + t[1], 0) / tiles.length;
  let centerTile = tiles[0];
  let minDist = Infinity;
  for (const [q, r] of tiles) {
    const d = Math.abs(q - avgQ) + Math.abs(r - avgR);
    if (d < minDist) { minDist = d; centerTile = [q, r]; }
  }

  // Assign node types based on tile biome and position
  const assignedTypes = new Set<string>();

  for (const [q, r] of tiles) {
    const tile = tileLookup.get(`${q},${r}`);
    if (!tile || tile.t === 'sea' || tile.t === 'iron_wall') continue;

    let nodeType: string | null = null;
    const biome = tile.t;
    const key = `${q},${r}`;
    const notableName = NOTABLE_CITIES[regionId]?.[key];

    // Center tile = city (if region has enough tiles)
    if (q === centerTile[0] && r === centerTile[1] && tiles.length >= 5) {
      nodeType = 'city';
    }
    // Adjacent to sea = coastal/port
    else if (isAdjacentToSea(q, r)) {
      if (!assignedTypes.has('port') && tiles.length >= 8 && rand() < 0.3) {
        nodeType = 'port';
      } else {
        nodeType = 'coastal';
      }
    }
    // Mountain biome
    else if (biome === 'mountain') {
      if (!assignedTypes.has('mine') && rand() < 0.3) nodeType = 'mine';
      else if (!assignedTypes.has('fortress') && rand() < 0.2) nodeType = 'fortress';
      else nodeType = 'mountain';
    }
    // Forest/taiga
    else if (biome === 'temperate_forest' || biome === 'taiga') {
      if (!assignedTypes.has('village') && rand() < 0.25) nodeType = 'village';
      else nodeType = 'forest';
    }
    // Marsh
    else if (biome === 'marsh') {
      nodeType = 'marsh';
    }
    // Plains/steppe
    else if (biome === 'plains' || biome === 'steppe') {
      if (!assignedTypes.has('village') && rand() < 0.2) nodeType = 'village';
      else if (!assignedTypes.has('crossroads') && rand() < 0.15) nodeType = 'crossroads';
      else nodeType = 'plains';
    }
    // Mediterranean/semi_arid
    else if (biome === 'mediterranean' || biome === 'semi_arid') {
      if (!assignedTypes.has('village') && rand() < 0.2) nodeType = 'village';
      else nodeType = 'plains';
    }
    // Desert
    else if (biome === 'desert') {
      if (!assignedTypes.has('ruins') && rand() < 0.15) nodeType = 'ruins';
      else nodeType = 'plains';
    }

    if (!nodeType) continue;
    if (nodeType !== 'plains' && nodeType !== 'forest' && nodeType !== 'mountain' && nodeType !== 'coastal') {
      assignedTypes.add(nodeType);
    }

    // Named tile = always city
    if (notableName) {
      nodeType = 'city';
    }

    features.push({ q, r, nodeType, name: notableName, buildings: [] });
  }

  regionFeatures[regionId] = features;
}

// ─── Phase 3: Place buildings ───────────────────────────────────────────────

console.log('Phase 3: Placing buildings...');

let totalBuildings = 0;
const buildingsPerRegion: Record<string, { tile: [number, number]; building: string; level: number; tileName?: string }[]> = {};

for (const [regionId, features] of Object.entries(regionFeatures)) {
  const regionBuildings: { tile: [number, number]; building: string; level: number; tileName?: string }[] = [];
  const usedBuildings = new Set<string>();

  // Check if region has any coastal tile
  const hasCoast = features.some(f => f.nodeType === 'coastal' || f.nodeType === 'port');

  // Determine how many buildings this region should have (based on size)
  const maxBuildings = Math.min(6, Math.max(1, Math.floor(features.length / 4)));

  // Sort features by "importance" (city first, then port, fortress, mine, village...)
  const priority: Record<string, number> = {
    city: 10, port: 9, fortress: 8, mine: 7, harbor: 7,
    village: 6, crossroads: 5, factory: 5, ruins: 4,
    marsh: 3, forest: 3, mountain: 2, plains: 1, coastal: 1,
  };

  const sorted = [...features].sort((a, b) => (priority[b.nodeType] || 0) - (priority[a.nodeType] || 0));

  for (const feature of sorted) {
    if (regionBuildings.length >= maxBuildings) break;

    const availableBuildings = terrainBuildings[feature.nodeType];
    if (!availableBuildings || availableBuildings.length === 0) continue;

    // Pick a building not yet used in this region; skip harbor/port for landlocked
    const candidates = availableBuildings.filter(b => {
      if (usedBuildings.has(b)) return false;
      if (!hasCoast && (b === 'harbor_dock')) return false;
      return true;
    });
    if (candidates.length === 0) continue;

    const building = pick(candidates);
    usedBuildings.add(building);

    const level = feature.nodeType === 'city' ? 2 : 1;
    regionBuildings.push({
      tile: [feature.q, feature.r],
      building,
      level,
      tileName: feature.name,
    });
    totalBuildings++;

    // Also push into the feature
    feature.buildings.push({ id: building, level });
  }

  if (regionBuildings.length > 0) {
    buildingsPerRegion[regionId] = regionBuildings;
  }
}

console.log(`  Placed ${totalBuildings} buildings across ${Object.keys(buildingsPerRegion).length} regions`);

// ─── Phase 4: Save outputs ──────────────────────────────────────────────────

console.log('Phase 4: Saving...');

// Save enriched hex_map
save('hex_map.json', hexMap);
console.log('  ✓ hex_map.json updated with terrain diversity');

// Save tile features (node types + names)
const tileFeatures: Record<string, { nodeType: string; name?: string }> = {};
for (const features of Object.values(regionFeatures)) {
  for (const f of features) {
    if (f.nodeType !== 'plains' && f.nodeType !== 'forest' && f.nodeType !== 'mountain' && f.nodeType !== 'coastal') {
      tileFeatures[`${f.q},${f.r}`] = { nodeType: f.nodeType, ...(f.name ? { name: f.name } : {}) };
    } else if (f.name) {
      tileFeatures[`${f.q},${f.r}`] = { nodeType: f.nodeType, name: f.name };
    }
  }
}
save('tile_features.json', tileFeatures);
console.log(`  ✓ tile_features.json: ${Object.keys(tileFeatures).length} notable tiles`);

// Save building placements
save('region_buildings.json', buildingsPerRegion);
console.log(`  ✓ region_buildings.json: ${Object.keys(buildingsPerRegion).length} regions with buildings`);

// Update logistics_test.json with real buildings from enrichment
const logisticsTest = load('logistics_test.json');
logisticsTest.test_buildings = {};
const testRegions = ['gb_northern_england', 'gb_eastern_england', 'gb_wales', 'gb_southern_england'];
for (const rid of testRegions) {
  if (buildingsPerRegion[rid]) {
    logisticsTest.test_buildings[rid] = buildingsPerRegion[rid].map(b => ({
      tile: b.tile,
      building: b.building,
      level: b.level,
    }));
  }
}
save('logistics_test.json', logisticsTest);
console.log('  ✓ logistics_test.json updated with enriched buildings');

// ─── Report ─────────────────────────────────────────────────────────────────

console.log('\n📊 Summary:');

// Terrain distribution after enrichment
const newBiomeCounts: Record<string, number> = {};
for (const tile of hexMap.tiles) {
  if (tile.t === 'sea') continue;
  newBiomeCounts[tile.t] = (newBiomeCounts[tile.t] || 0) + 1;
}
console.log('  Terrain distribution (land tiles):');
const sortedBiomes = Object.entries(newBiomeCounts).sort((a, b) => b[1] - a[1]);
for (const [biome, count] of sortedBiomes) {
  const pct = ((count / Object.values(newBiomeCounts).reduce((a, b) => a + b, 0)) * 100).toFixed(1);
  console.log(`    ${biome.padEnd(18)} ${String(count).padStart(5)} (${pct}%)`);
}

// Region diversity stats
let monoRegions = 0;
for (const [regionId, region] of Object.entries(hexRegions)) {
  const biomes = new Set<string>();
  for (const [q, r] of region.tiles) {
    const tile = tileLookup.get(`${q},${r}`);
    if (tile && tile.t !== 'sea') biomes.add(tile.t);
  }
  if (biomes.size <= 1) monoRegions++;
}
console.log(`\n  Mono-terrain regions: ${monoRegions}/162 (was 60)`);
console.log(`  Total buildings placed: ${totalBuildings}`);
console.log('\n✅ Done! Run `npx tsx scripts/seed/index.ts geography logistics` to re-seed the chain.');
