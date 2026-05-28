import { useState, useEffect } from 'react';
import { getChainClient } from './useChainClient';
import { decodeBytes, decodeCode } from '../lib/chainCodec';

// ─── Campaign Rules Types ────────────────────────────────────────────────────

export interface ChainTraumaRow {
  roll: string;
  name: string;
  effect: string;
  causesInjury: boolean;
  causesBattleScar: boolean;
}

export interface ChainPhaseStep {
  order: number;
  id: string;
  name: string;
  description: string;
  mandatory: boolean;
  exclusiveWith: string[];
}

export interface ChainPromotionRules {
  baseDice: number;
  successValue: number;
  pityThreshold: number;
  maxElites: number;
}

export interface ChainVictoryConfig {
  winner: number;
  loser: number;
  draw: number;
}

export interface ChainThresholdRow {
  game: number;
  threshold: number;
  fieldStrength: number;
}

export interface ChainQuartermasterAction {
  id: string;
  name: string;
  description: string;
}

export interface CampaignRulesData {
  traumaTable: ChainTraumaRow[];
  phaseSteps: ChainPhaseStep[];
  promotions: ChainPromotionRules | null;
  victory: ChainVictoryConfig | null;
  thresholdTable: ChainThresholdRow[];
  quartermasterActions: ChainQuartermasterAction[];
}

// ─── Exploration Rules Types ─────────────────────────────────────────────────

export interface ChainDiceProgressionRow {
  gamesMin: number;
  gamesMax: number;
  dice: number;
}

export interface ChainTableProgressionRow {
  gamesMin: number;
  gamesMax: number;
  tables: string[];
}

export interface ChainExplorationOption {
  id: string;
  name: string;
  factions: string[];
  effect: string;
  grantsSkill?: string;
}

export interface ChainExplorationEvent {
  roll: number;
  table: string;
  name: string;
  description: string;
  options: ChainExplorationOption[];
}

export interface ChainExplorationSkill {
  code: string;
  name: string;
  effect: string;
  timing: string;
}

export interface ExplorationRulesData {
  diceProgression: ChainDiceProgressionRow[];
  tableProgression: ChainTableProgressionRow[];
  lootMultiplier: number;
  rerollsBase: number;
  rerollsBonusIfWon: number;
  events: ChainExplorationEvent[];
  skills: ChainExplorationSkill[];
}

// ─── Building/Economy Types ──────────────────────────────────────────────────

export interface ChainBuildingDef {
  code: string;
  name: string;
  terrains: string[];
  resources: { code: string; output: number }[];
}

export interface ChainResource {
  code: string;
  name: string;
}

export interface BuildingData {
  buildings: ChainBuildingDef[];
  resources: ChainResource[];
}

// ─── Hex/Map Types ───────────────────────────────────────────────────────────

export interface ChainTile {
  coord: [number, number];
  terrain: number;
  terrainName: string;
  water: boolean;
  region: string;
}

export interface ChainMapConfig {
  cols: number;
  rows: number;
  hexSize: number;
  svgWidth: number;
  svgHeight: number;
}

export interface ChainRegion {
  code: string;
  name: string;
  country: string;
  control: string;
  tiles: [number, number][];
}

export interface ChainTerrainEntry {
  id: number;
  code: string;
  name: string;
}

export interface ChainCountry {
  code: string;
  name: string;
  alignment: string;
  regions: string[];
}

export interface ChainPoi {
  code: string;
  name: string;
  tile: [number, number] | null;
  poiType: string;
  lore: string;
}

export interface MapData {
  config: ChainMapConfig | null;
  tiles: ChainTile[];
  regions: ChainRegion[];
  countries: ChainCountry[];
  pois: ChainPoi[];
}

// ─── Theatre Types ───────────────────────────────────────────────────────────

export interface ChainTheatreNode {
  coord: [number, number];
  terrain: string;
  name: string;
  nodeType: string;
  control: string;
  desc: string;
  supplySource: boolean;
  demand: number;
  buildings: string[];
}

export interface ChainTheatreEdge {
  from: number;
  to: number;
  capacity: number;
}

export interface ChainContextTile {
  coord: [number, number];
  terrain: string;
}

export interface ChainTheatre {
  code: string;
  name: string;
  description: string;
  lore: string;
  nodes: ChainTheatreNode[];
  edges: ChainTheatreEdge[];
  contextTiles: ChainContextTile[];
}

export interface TheatreData {
  theatres: ChainTheatre[];
}

// ─── Cache ───────────────────────────────────────────────────────────────────

const cache = new Map<string, { data: any; ts: number }>();
const TTL = 120_000;

function useCached<T>(key: string, fetcher: () => Promise<T>) {
  const cached = cache.get(key);
  const [data, setData] = useState<T | null>(cached && Date.now() - cached.ts < TTL ? cached.data : null);
  const [loading, setLoading] = useState(data === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data !== null) return;
    let cancelled = false;
    fetcher()
      .then(result => {
        if (cancelled) return;
        cache.set(key, { data: result, ts: Date.now() });
        setData(result);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e.message || 'Query failed');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [key, data]);

  return { data, loading, error };
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useCampaignRules() {
  return useCached<CampaignRulesData>('campaignRules', async () => {
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
        roll: decodeBytes(r.roll),
        name: decodeBytes(r.name),
        effect: decodeBytes(r.effect),
        causesInjury: r.causesInjury ?? false,
        causesBattleScar: r.causesBattleScar ?? false,
      })),
      phaseSteps: (phaseRaw as any[]).map(s => ({
        order: s.order,
        id: decodeBytes(s.id),
        name: decodeBytes(s.name),
        description: decodeBytes(s.description),
        mandatory: s.mandatory ?? false,
        exclusiveWith: (s.exclusiveWith ?? []).map((e: any) => decodeBytes(e)),
      })),
      promotions: promoRaw ? {
        baseDice: (promoRaw as any).baseDice,
        successValue: (promoRaw as any).successValue,
        pityThreshold: (promoRaw as any).pityThreshold,
        maxElites: (promoRaw as any).maxElites,
      } : null,
      victory: victoryRaw ? {
        winner: (victoryRaw as any).winner,
        loser: (victoryRaw as any).loser,
        draw: (victoryRaw as any).draw,
      } : null,
      thresholdTable: (thresholdRaw as any[]).map(r => ({
        game: r.game,
        threshold: r.threshold,
        fieldStrength: r.fieldStrength,
      })),
      quartermasterActions: (qmRaw as any[]).map(a => ({
        id: decodeBytes(a.id),
        name: decodeBytes(a.name),
        description: decodeBytes(a.description),
      })),
    };
  });
}

export function useExplorationRules() {
  return useCached<ExplorationRulesData>('explorationRules', async () => {
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
      diceProgression: (diceRaw as any[]).map(r => ({
        gamesMin: r.gamesMin,
        gamesMax: r.gamesMax,
        dice: r.dice,
      })),
      tableProgression: (tableRaw as any[]).map(r => ({
        gamesMin: r.gamesMin,
        gamesMax: r.gamesMax,
        tables: (r.tables as any[]).map((t: any) => (t.type ?? t).toLowerCase()),
      })),
      lootMultiplier: lootMul as number,
      rerollsBase: rerollBase as number,
      rerollsBonusIfWon: rerollBonus as number,
      events: eventsRaw.map(([key, value]: any) => {
        const [table, roll] = key;
        const v = value as any;
        return {
          roll: roll as number,
          table: (table.type ?? table).toLowerCase(),
          name: decodeBytes(v.name),
          description: decodeBytes(v.description),
          options: (v.options ?? []).map((o: any) => ({
            id: decodeBytes(o.id),
            name: decodeBytes(o.name),
            factions: (o.factions ?? []).map((f: any) => decodeCode(f)),
            effect: decodeBytes(o.effect),
            grantsSkill: o.grantsSkill ? decodeCode(o.grantsSkill) : undefined,
          })),
        };
      }),
      skills: skillsRaw.map(([key, value]: any) => ({
        code: decodeCode(key),
        name: decodeBytes(value.name),
        effect: decodeBytes(value.effect),
        timing: (value.timing?.type ?? value.timing ?? 'AfterRoll').toLowerCase(),
      })),
    };
  });
}

export function useBuildingData() {
  return useCached<BuildingData>('buildings', async () => {
    const client = await getChainClient();
    const [buildingsRaw, resourcesRaw] = await Promise.all([
      client.query.building.buildingDefs.entries(),
      client.query.building.resources.entries(),
    ]);

    return {
      buildings: buildingsRaw.map(([key, value]: any) => ({
        code: decodeCode(key),
        name: decodeBytes(value.name),
        terrains: (value.allowedTerrains ?? []).map((t: any) => decodeCode(t)),
        resources: (value.produces ?? []).map((tuple: any) => ({
          code: decodeCode(tuple[0]),
          output: tuple[1] ?? 0,
        })),
      })),
      resources: resourcesRaw.map(([key, value]: any) => ({
        code: decodeCode(key),
        name: decodeCode(value.name ?? value),
      })),
    };
  });
}

export function useMapData() {
  return useCached<MapData>('mapData', async () => {
    const client = await getChainClient();
    const [configRaw, tilesRaw, terrainsRaw, regionsRaw, regionTilesRaw, countriesRaw, poisRaw] = await Promise.all([
      client.query.tile.config(),
      client.query.tile.tiles.entries(),
      client.query.tile.terrainRegistry.entries(),
      client.query.region.regions.entries(),
      client.query.region.regionTiles.entries(),
      client.query.country.countries.entries(),
      client.query.poi.pois.entries(),
    ]);

    const config = configRaw ? {
      cols: (configRaw as any).cols,
      rows: (configRaw as any).rows,
      hexSize: (configRaw as any).hexSizeX100 / 100,
      svgWidth: (configRaw as any).svgWidth,
      svgHeight: (configRaw as any).svgHeight,
    } : null;

    const terrainMap = new Map<number, string>();
    for (const [key, value] of terrainsRaw as any[]) {
      terrainMap.set(key as number, decodeCode(value.code));
    }

    const regionTilesMap = new Map<string, [number, number][]>();
    for (const [key, value] of regionTilesRaw as any[]) {
      regionTilesMap.set(decodeCode(key), (value as any[]).map((c: any) => [c[0], c[1]]));
    }

    const regionByTile = new Map<string, string>();
    for (const [code, coords] of regionTilesMap) {
      for (const [q, r] of coords) regionByTile.set(`${q},${r}`, code);
    }

    return {
      config,
      tiles: tilesRaw.map(([key, value]: any) => {
        const coord = key as [number, number];
        const terrainId = (value as any).terrain as number;
        return {
          coord,
          terrain: terrainId,
          terrainName: terrainMap.get(terrainId) ?? `terrain_${terrainId}`,
          water: (value as any).water ?? false,
          region: regionByTile.get(`${coord[0]},${coord[1]}`) ?? '',
        };
      }),
      regions: regionsRaw.map(([key, value]: any) => {
        const code = decodeCode(key);
        return {
          code,
          name: decodeBytes(value.name),
          country: decodeCode(value.country ?? ''),
          control: value.control?.type ?? 'Sovereign',
          tiles: regionTilesMap.get(code) ?? [],
        };
      }),
      countries: countriesRaw.map(([key, value]: any) => ({
        code: decodeCode(key),
        name: decodeBytes(value.name),
        alignment: value.alignment ?? 'Neutral',
        regions: (value.regions ?? []).map((r: any) => decodeCode(r)),
      })),
      pois: poisRaw.map(([key, value]: any) => ({
        code: decodeCode(key),
        name: decodeBytes(value.name),
        tile: value.tile ?? null,
        poiType: value.poiType ?? 'Battlefield',
        lore: decodeBytes(value.lore),
      })),
    };
  });
}

export function useTheatreData() {
  return useCached<TheatreData>('theatreData', async () => {
    const client = await getChainClient();
    const theatresRaw = await client.query.theatre.theatres.entries();

    const theatres: ChainTheatre[] = [];
    for (const [key, value] of theatresRaw as any[]) {
      const code = decodeCode(key);
      const def = value as any;
      const nodeCount = def.nodeCount ?? 0;

      const nodes: ChainTheatreNode[] = [];
      for (let i = 0; i < nodeCount; i++) {
        const node = await client.query.theatre.nodes(key, i);
        if (node) {
          const n = node as any;
          nodes.push({
            coord: n.coord as [number, number],
            terrain: decodeCode(n.terrain ?? ''),
            name: decodeBytes(n.name),
            nodeType: decodeBytes(n.nodeType),
            control: n.control?.type ?? n.control ?? 'Neutral',
            desc: decodeBytes(n.desc),
            supplySource: n.supplySource ?? false,
            demand: n.demand ?? 2,
            buildings: (n.buildings ?? []).map((b: any) => decodeCode(b)),
          });
        }
      }

      const edgesRaw = await client.query.theatre.edges(key) as any[];
      const edges: ChainTheatreEdge[] = (edgesRaw ?? []).map((e: any) => ({
        from: e.from, to: e.to, capacity: e.capacity,
      }));

      const ctxRaw = await client.query.theatre.contextTiles(key) as any[];
      const contextTiles: ChainContextTile[] = (ctxRaw ?? []).map((ct: any) => ({
        coord: ct.coord as [number, number],
        terrain: decodeCode(ct.terrain ?? ''),
      }));

      theatres.push({
        code,
        name: decodeBytes(def.name),
        description: decodeBytes(def.description),
        lore: decodeBytes(def.lore),
        nodes,
        edges,
        contextTiles,
      });
    }

    return { theatres };
  });
}
