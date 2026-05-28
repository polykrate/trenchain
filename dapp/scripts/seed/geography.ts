import type { TcPrimitivesAlignment } from '../../src/chain-api/parachain-template-runtime/types';
import { loadJson, toCode32, toCode16, toBytes, sudoBatch, sudoSend } from './shared';
import type { ChainClient, CallLike } from './shared';

const TERRAIN_MAP: Record<string, number> = {
  plains: 1,
  temperate_forest: 2,
  desert: 3,
  taiga: 4,
  mountain: 5,
  steppe: 6,
  semi_arid: 7,
  mediterranean: 8,
  marsh: 9,
  iron_wall: 10,
};

export async function seedTerrainRegistry(client: ChainClient, alice: any) {
  const calls: CallLike[] = Object.entries(TERRAIN_MAP).map(([name, id]) => ({
    pallet: 'Tile', palletCall: { name: 'RegisterTerrain', params: {
      id,
      code: toCode16(name),
      name: toBytes(name.replace(/_/g, ' ')),
    }},
  }));
  await sudoBatch(client, alice, 'TerrainRegistry', calls);
}

export async function seedCountries(client: ChainClient, alice: any) {
  const countriesData = loadJson('hex_countries.json');
  const countryEntries = Object.entries(countriesData) as [string, any][];
  await sudoBatch(client, alice, 'Countries', countryEntries.map(([code, c]) => ({
    pallet: 'Country', palletCall: { name: 'RegisterCountry', params: {
      code: toCode32(code), name: c.name,
      alignment: (c.faction === 'HERETIC' ? 'Fallen' : c.faction === 'NEUTRAL' ? 'Neutral' : 'Faithful') as TcPrimitivesAlignment,
      regions: (c.regions || []).slice(0, 32).map((r: string) => toCode32(r)),
    }},
  })));
}

export async function seedRegions(client: ChainClient, alice: any) {
  const regionsData = loadJson('hex_regions.json');
  const regionEntries = Object.entries(regionsData) as [string, any][];
  await sudoBatch(client, alice, 'Regions', regionEntries.map(([code, r]) => ({
    pallet: 'Region', palletCall: { name: 'RegisterRegion', params: {
      code: toCode32(code), name: r.name, country: toCode32(r.country),
      control: { type: 'Sovereign' },
    }},
  })));
}

export async function seedRegionTiles(client: ChainClient, alice: any) {
  const regionsData = loadJson('hex_regions.json');
  const regionEntries = Object.entries(regionsData) as [string, any][];
  const calls: CallLike[] = regionEntries
    .filter(([, r]) => (r as any).tiles?.length > 0)
    .map(([code, r]) => ({
      pallet: 'Region', palletCall: { name: 'SetRegionTiles', params: {
        code: toCode32(code),
        tiles: ((r as any).tiles as [number, number][]).slice(0, 300).map(([q, row]) => [q, row]),
      }},
    }));
  await sudoBatch(client, alice, 'RegionTiles', calls, 20);
}

export async function seedTiles(client: ChainClient, alice: any) {
  const hexMap = loadJson('hex_map.json');
  const allTiles: any[] = hexMap.tiles;
  const landTiles = allTiles.filter((t: any) => t.t !== 'sea');

  const tileCalls: CallLike[] = [];
  for (let i = 0; i < landTiles.length; i += 200) {
    const chunk = landTiles.slice(i, i + 200);
    tileCalls.push({ pallet: 'Tile', palletCall: { name: 'RegisterTilesBatch', params: {
      tiles: chunk.map((t: any) => {
        const terrainId = TERRAIN_MAP[t.t] ?? 0;
        const water = t.w === true;
        return [[t.q, t.r], terrainId, water];
      }),
    }}});
  }
  await sudoBatch(client, alice, 'Tiles', tileCalls, 5);
}

export async function seedMapConfig(client: ChainClient, alice: any) {
  const hexMap = loadJson('hex_map.json');
  await sudoSend(client, alice, { pallet: 'Tile', palletCall: { name: 'SetMapConfig', params: {
    config: {
      cols: hexMap.meta.cols,
      rows: hexMap.meta.rows,
      hexSizeX100: Math.round(hexMap.meta.hex_size * 100),
      svgWidth: hexMap.meta.svg_width,
      svgHeight: hexMap.meta.svg_height,
    },
  }}});
  console.log('  [MapConfig] set');
}

export async function seedPois(client: ChainClient, alice: any) {
  const poisData = loadJson('hex_poi.json') as any[];
  const poiTypeMap: Record<string, string> = {
    heretic_landmark: 'HereticLandmark',
    faithful_fortress: 'FaithfulFortress',
    heretic_fortress: 'HereticFortress',
    heretic_outpost: 'HereticOutpost',
    neutral_fortress: 'NeutralFortress',
    battlefield: 'Battlefield',
    wall_gate: 'WallGate',
    faithful_city: 'FaithfulCity',
    divine_site: 'DivineSite',
  };
  const poiCalls: CallLike[] = [];
  for (const poi of poisData) {
    poiCalls.push({ pallet: 'Poi', palletCall: { name: 'RegisterPoi', params: {
      code: toCode32(poi.id),
      name: poi.name.slice(0, 64),
      tile: poi.tile ? [poi.tile[0], poi.tile[1]] : undefined,
      poiType: poiTypeMap[poi.type] || 'Battlefield',
      lore: (poi.lore || '').slice(0, 256),
    }}});
  }
  await sudoBatch(client, alice, 'POIs', poiCalls, 10);
}

export async function seedGeography(client: ChainClient, alice: any) {
  console.log('🗺️  Seeding geography...');
  await seedTerrainRegistry(client, alice);
  await seedCountries(client, alice);
  await seedRegions(client, alice);
  await seedRegionTiles(client, alice);
  await seedTiles(client, alice);
  await seedMapConfig(client, alice);
  await seedPois(client, alice);
}
