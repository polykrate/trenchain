/**
 * Global chain data store with lazy loading and caching.
 *
 * Strategy:
 * - Each "dataset" is loaded independently and cached with TTL
 * - .entries() for bulk fetches (one RPC call returns all storage items)
 * - Hooks are per-page: only fetch what's needed
 * - Data persists across navigations via module-level cache
 */
import { useState, useEffect, useRef } from 'react';
import { getChainClient } from './useChainClient';
import { decodeBytes, decodeCode } from '../lib/chainCodec';

// ─── Types ──────────────────────────────────────────────────────────────────

export type { CampaignRulesData, ExplorationRulesData, BuildingData, MapData, TheatreData } from './useChainRules';
export type {
  ChainTile, ChainMapConfig, ChainRegion, ChainCountry, ChainPoi, ChainTerrainEntry,
  ChainTheatre, ChainTheatreNode, ChainTheatreEdge, ChainContextTile,
  ChainTraumaRow, ChainPhaseStep, ChainPromotionRules, ChainVictoryConfig,
  ChainThresholdRow, ChainQuartermasterAction,
  ChainDiceProgressionRow, ChainTableProgressionRow, ChainExplorationEvent, ChainExplorationSkill,
  ChainBuildingDef, ChainResource,
} from './useChainRules';

import type {
  CampaignRulesData, ExplorationRulesData, BuildingData, MapData, TheatreData,
  ChainTile, ChainMapConfig, ChainRegion, ChainCountry, ChainPoi, ChainTerrainEntry,
  ChainTheatre, ChainTheatreNode, ChainTheatreEdge, ChainContextTile,
} from './useChainRules';

// ─── Cache Layer ────────────────────────────────────────────────────────────

interface CacheEntry<T> { data: T; ts: number }

const CACHE = new Map<string, CacheEntry<any>>();
const TTL = 5 * 60_000; // 5 min
const inflight = new Map<string, Promise<any>>();

function getCached<T>(key: string): T | null {
  const entry = CACHE.get(key);
  if (entry && Date.now() - entry.ts < TTL) return entry.data;
  return null;
}

function setCache<T>(key: string, data: T) {
  CACHE.set(key, { data, ts: Date.now() });
}

async function fetchOnce<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const cached = getCached<T>(key);
  if (cached) return cached;

  if (inflight.has(key)) return inflight.get(key) as Promise<T>;

  const promise = loader().then(data => {
    setCache(key, data);
    inflight.delete(key);
    return data;
  }).catch(err => {
    inflight.delete(key);
    throw err;
  });
  inflight.set(key, promise);
  return promise;
}

// ─── Generic Hook ───────────────────────────────────────────────────────────

interface UseDataResult<T> { data: T | null; loading: boolean; error: string | null }

function useData<T>(key: string, loader: () => Promise<T>): UseDataResult<T> {
  const cached = getCached<T>(key);
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (data) return;
    fetchOnce(key, loader)
      .then(result => { if (mountedRef.current) { setData(result); setLoading(false); } })
      .catch(e => { if (mountedRef.current) { setError(e?.message || 'fetch failed'); setLoading(false); } });
    return () => { mountedRef.current = false; };
  }, [key]);

  return { data, loading, error };
}

// ─── Loaders ────────────────────────────────────────────────────────────────

interface MapMeta {
  config: ChainMapConfig | null;
  terrains: ChainTerrainEntry[];
  regions: ChainRegion[];
  countries: ChainCountry[];
  pois: ChainPoi[];
}

async function loadMapMeta(): Promise<MapMeta> {
  const client = await getChainClient();
  const [configRaw, terrainsRaw, regionsRaw, regionTilesRaw, countriesRaw, poisRaw] = await Promise.all([
    client.query.tile.config(),
    client.query.tile.terrainRegistry.entries(),
    client.query.region.regions.entries(),
    client.query.region.regionTiles.entries(),
    client.query.country.countries.entries(),
    client.query.poi.pois.entries(),
  ]);

  const regionTilesMap = new Map<string, [number, number][]>();
  for (const [key, value] of regionTilesRaw as any[]) {
    const code = decodeCode(key);
    regionTilesMap.set(code, (value as any[]).map((c: any) => [c[0], c[1]] as [number, number]));
  }

  return {
    config: configRaw ? {
      cols: (configRaw as any).cols,
      rows: (configRaw as any).rows,
      hexSize: (configRaw as any).hexSizeX100 / 100,
      svgWidth: (configRaw as any).svgWidth,
      svgHeight: (configRaw as any).svgHeight,
    } : null,
    terrains: (terrainsRaw as any[]).map(([key, value]: any) => ({
      id: key as number,
      code: decodeCode(value.code),
      name: decodeBytes(value.name),
    })),
    regions: regionsRaw.map(([key, value]: any) => {
      const code = decodeCode(key);
      return {
        code, name: decodeBytes(value.name),
        country: decodeCode(value.country ?? ''), control: value.control?.type ?? 'Sovereign',
        tiles: regionTilesMap.get(code) ?? [],
      };
    }),
    countries: countriesRaw.map(([key, value]: any) => ({
      code: decodeCode(key), name: decodeBytes(value.name),
      alignment: value.alignment?.type ?? value.alignment ?? 'Neutral',
      regions: (value.regions ?? []).map((r: any) => decodeCode(r)),
    })),
    pois: poisRaw.map(([key, value]: any) => ({
      code: decodeCode(key), name: decodeBytes(value.name),
      tile: value.tile ?? null, poiType: value.poiType?.type ?? value.poiType ?? 'Battlefield',
      lore: decodeBytes(value.lore),
    })),
  };
}

async function loadTiles(): Promise<ChainTile[]> {
  const client = await getChainClient();
  const tilesRaw = await client.query.tile.tiles.entries();

  const meta = getCached<MapMeta>('map:meta');
  const terrainMap = new Map<number, string>();
  if (meta?.terrains) {
    for (const t of meta.terrains) terrainMap.set(t.id, t.code);
  }

  const regionByTile = new Map<string, string>();
  if (meta?.regions) {
    for (const r of meta.regions) {
      for (const [q, row] of r.tiles) regionByTile.set(`${q},${row}`, r.code);
    }
  }

  return tilesRaw.map(([key, value]: any) => {
    const coord = key as [number, number];
    const terrainId = (value as any).terrain as number;
    return {
      coord,
      terrain: terrainId,
      terrainName: terrainMap.get(terrainId) ?? `terrain_${terrainId}`,
      water: (value as any).water ?? false,
      region: regionByTile.get(`${coord[0]},${coord[1]}`) ?? '',
    };
  });
}

async function loadTheatre(theatreCode: string): Promise<ChainTheatre | null> {
  const client = await getChainClient();
  const code32 = toFixedCode(theatreCode, 32);
  const def = await client.query.theatre.theatres(code32) as any;
  if (!def) return null;

  const nodeCount = def.nodeCount ?? 0;
  const [nodesResult, edgesRaw, ctxRaw] = await Promise.all([
    Promise.all(Array.from({ length: nodeCount }, (_, i) => client.query.theatre.nodes(code32, i))),
    client.query.theatre.edges(code32),
    client.query.theatre.contextTiles(code32),
  ]);

  const nodes: ChainTheatreNode[] = nodesResult.filter(Boolean).map((n: any) => ({
    coord: n.coord as [number, number],
    terrain: decodeCode(n.terrain ?? ''),
    name: decodeBytes(n.name),
    nodeType: decodeBytes(n.nodeType),
    control: n.control?.type ?? n.control ?? 'Neutral',
    desc: decodeBytes(n.desc),
    supplySource: n.supplySource ?? false,
    demand: n.demand ?? 2,
    buildings: (n.buildings ?? []).map((b: any) => decodeCode(b)),
  }));

  const edges: ChainTheatreEdge[] = ((edgesRaw as any[]) ?? []).map((e: any) => ({
    from: e.from, to: e.to, capacity: e.capacity,
  }));

  const contextTiles: ChainContextTile[] = ((ctxRaw as any[]) ?? []).map((ct: any) => ({
    coord: ct.coord as [number, number],
    terrain: decodeCode(ct.terrain ?? ''),
  }));

  return {
    code: theatreCode,
    name: decodeBytes(def.name),
    description: decodeBytes(def.description),
    lore: decodeBytes(def.lore),
    nodes, edges, contextTiles,
  };
}

async function loadCampaignRules(): Promise<CampaignRulesData> {
  const client = await getChainClient();
  const [traumaRaw, phaseRaw, promoRaw, victoryRaw, thresholdRaw, qmRaw] = await Promise.all([
    client.query.campaignRules.traumaTable(),
    client.query.campaignRules.phaseSteps(),
    client.query.campaignRules.promotions(),
    client.query.campaignRules.victory(),
    client.query.campaignRules.thresholdTable(),
    client.query.campaignRules.quartermasterActions(),
  ]);
  return {
    traumaTable: (traumaRaw as any[]).map(r => ({
      roll: decodeBytes(r.roll), name: decodeBytes(r.name), effect: decodeBytes(r.effect),
      causesInjury: r.causesInjury ?? false, causesBattleScar: r.causesBattleScar ?? false,
    })),
    phaseSteps: (phaseRaw as any[]).map(s => ({
      order: s.order, id: decodeBytes(s.id), name: decodeBytes(s.name),
      description: decodeBytes(s.description), mandatory: s.mandatory ?? false,
      exclusiveWith: (s.exclusiveWith ?? []).map((e: any) => decodeBytes(e)),
    })),
    promotions: promoRaw ? {
      baseDice: (promoRaw as any).baseDice, successValue: (promoRaw as any).successValue,
      pityThreshold: (promoRaw as any).pityThreshold, maxElites: (promoRaw as any).maxElites,
    } : null,
    victory: victoryRaw ? {
      winner: (victoryRaw as any).winner, loser: (victoryRaw as any).loser, draw: (victoryRaw as any).draw,
    } : null,
    thresholdTable: (thresholdRaw as any[]).map(r => ({
      game: r.game, threshold: r.threshold, fieldStrength: r.fieldStrength,
    })),
    quartermasterActions: (qmRaw as any[]).map(a => ({
      id: decodeBytes(a.id), name: decodeBytes(a.name), description: decodeBytes(a.description),
    })),
  };
}

async function loadExplorationRules(): Promise<ExplorationRulesData> {
  const client = await getChainClient();
  const [diceRaw, tableRaw, lootMul, rerollBase, rerollBonus, eventsRaw, skillsRaw] = await Promise.all([
    client.query.explorationRules.diceProgression(),
    client.query.explorationRules.tableProgression(),
    client.query.explorationRules.lootMultiplier(),
    client.query.explorationRules.rerollsBase(),
    client.query.explorationRules.rerollsBonusIfWon(),
    client.query.explorationRules.events.entries(),
    client.query.explorationRules.skills.entries(),
  ]);
  return {
    diceProgression: (diceRaw as any[]).map(r => ({ gamesMin: r.gamesMin, gamesMax: r.gamesMax, dice: r.dice })),
    tableProgression: (tableRaw as any[]).map(r => ({
      gamesMin: r.gamesMin, gamesMax: r.gamesMax,
      tables: (r.tables as any[]).map((t: any) => (t.type ?? t).toLowerCase()),
    })),
    lootMultiplier: lootMul as number,
    rerollsBase: rerollBase as number,
    rerollsBonusIfWon: rerollBonus as number,
    events: eventsRaw.map(([key, value]: any) => {
      const [table, roll] = key;
      const v = value as any;
      return {
        roll: roll as number, table: (table.type ?? table).toLowerCase(),
        name: decodeBytes(v.name), description: decodeBytes(v.description),
        options: (v.options ?? []).map((o: any) => ({
          id: decodeBytes(o.id), name: decodeBytes(o.name),
          factions: (o.factions ?? []).map((f: any) => decodeCode(f)),
          effect: decodeBytes(o.effect), grantsSkill: o.grantsSkill ? decodeCode(o.grantsSkill) : undefined,
        })),
      };
    }),
    skills: skillsRaw.map(([key, value]: any) => ({
      code: decodeCode(key), name: decodeBytes(value.name), effect: decodeBytes(value.effect),
      timing: (value.timing?.type ?? value.timing ?? 'AfterRoll').toLowerCase(),
    })),
  };
}

async function loadBuildingData(): Promise<BuildingData> {
  const client = await getChainClient();
  const [buildingsRaw, resourcesRaw] = await Promise.all([
    client.query.building.buildingDefs.entries(),
    client.query.building.resources.entries(),
  ]);
  return {
    buildings: buildingsRaw.map(([key, value]: any) => ({
      code: decodeCode(key), name: decodeBytes(value.name),
      terrains: (value.allowedTerrains ?? []).map((t: any) => decodeCode(t)),
      resources: (value.produces ?? []).map((tuple: any) => ({ code: decodeCode(tuple[0]), output: tuple[1] ?? 0 })),
    })),
    resources: resourcesRaw.map(([key, value]: any) => ({
      code: decodeCode(key), name: decodeCode(value.name ?? value),
    })),
  };
}

// ─── Util ───────────────────────────────────────────────────────────────────

function toFixedCode(str: string, len: number): `0x${string}` {
  const buf = new Uint8Array(len);
  const encoded = new TextEncoder().encode(str);
  buf.set(encoded.slice(0, len));
  return `0x${Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
}

// ─── Page-Level Hooks (Lazy) ────────────────────────────────────────────────

/**
 * World map page: loads metadata (config, regions, countries, pois) first,
 * then tiles separately. This way the page can show a loading skeleton
 * while the heavy tile data streams in.
 */
export function useWorldMap() {
  const meta = useData<MapMeta>('map:meta', loadMapMeta);
  const tiles = useData('map:tiles', loadTiles);

  const mapData: MapData | null = (meta.data && tiles.data) ? {
    config: meta.data.config,
    tiles: tiles.data,
    regions: meta.data.regions,
    countries: meta.data.countries,
    pois: meta.data.pois,
  } : null;

  return {
    data: mapData,
    meta: meta.data,
    terrains: meta.data?.terrains ?? [],
    tilesLoaded: !!tiles.data,
    loading: meta.loading || tiles.loading,
    error: meta.error || tiles.error,
  };
}

/**
 * Theatre page: loads a single theatre by code.
 * Fetches nodes/edges/ctx in parallel (not N+1).
 */
export function useTheatre(code: string | undefined) {
  return useData<ChainTheatre | null>(
    `theatre:${code ?? ''}`,
    () => code ? loadTheatre(code) : Promise.resolve(null),
  );
}

/**
 * Post-battle page: campaign + exploration rules.
 */
export function usePostBattleData() {
  const campaign = useData('rules:campaign', loadCampaignRules);
  const exploration = useData('rules:exploration', loadExplorationRules);
  return {
    campaignRules: campaign.data,
    explorationRules: exploration.data,
    loading: campaign.loading || exploration.loading,
    error: campaign.error || exploration.error,
  };
}

/**
 * Theatre detail page: theatre + building data for supply calculations.
 */
export function useTheatreDetail(code: string | undefined) {
  const theatre = useTheatre(code);
  const buildings = useData('data:buildings', loadBuildingData);
  return {
    theatre: theatre.data,
    buildingData: buildings.data,
    loading: theatre.loading || buildings.loading,
    error: theatre.error || buildings.error,
  };
}

/**
 * Building/economy data for supply engine.
 */
export function useBuildingData() {
  return useData('data:buildings', loadBuildingData);
}

/**
 * Campaign rules only.
 */
export function useCampaignRules() {
  return useData('rules:campaign', loadCampaignRules);
}

/**
 * Exploration rules only.
 */
export function useExplorationRules() {
  return useData('rules:exploration', loadExplorationRules);
}

/**
 * Invalidate a specific cache key (useful after mutations).
 */
export function invalidateCache(key?: string) {
  if (key) { CACHE.delete(key); }
  else { CACHE.clear(); }
}
