import { getChainClient } from '../hooks/useChainClient';
import { decodeBytes, decodeCode } from '../lib/chainCodec';
import type { WarbandId } from './warband';

export interface TerritoryState {
  code: string;
  name: string;
  control: 'Neutral' | { Controlled: { warband: WarbandId } } | { Contested: { attacker: WarbandId; defender: WarbandId } };
  buildings: string[];
  supply: number;
}

export interface TileData {
  coord: [number, number];
  terrain: string;
  name: string;
  region: string;
}

export interface RegionData {
  code: string;
  name: string;
}

export interface CountryData {
  code: string;
  name: string;
  regions: string[];
}

export async function getTiles(): Promise<TileData[]> {
  const client = await getChainClient();
  const entries = await client.query.tile.tiles.entries();
  return entries.map(([key, value]) => {
    const v = value as any;
    return {
      coord: key as any,
      terrain: decodeCode(v.terrain ?? v.terrainCode),
      name: decodeBytes(v.name),
      region: decodeCode(v.region ?? v.regionCode ?? ''),
    };
  });
}

export async function getRegions(): Promise<RegionData[]> {
  const client = await getChainClient();
  const entries = await client.query.region.regions.entries();
  return entries.map(([key, value]) => ({
    code: decodeCode(key),
    name: decodeBytes((value as any).name),
  }));
}

export async function getCountries(): Promise<CountryData[]> {
  const client = await getChainClient();
  const entries = await client.query.country.countries.entries();
  return entries.map(([key, value]) => {
    const v = value as any;
    return {
      code: decodeCode(key),
      name: decodeBytes(v.name),
      regions: v.regions?.map((r: any) => decodeCode(r)) ?? [],
    };
  });
}

export async function getLeaderboard(): Promise<{ warbandId: WarbandId; glory: number }[]> {
  const client = await getChainClient();
  const entries = await client.query.warband.warbands.entries();
  return entries
    .map(([key, value]) => {
      const v = value as any;
      return { warbandId: key as any as number, glory: v.glory ?? 0 };
    })
    .sort((a, b) => b.glory - a.glory)
    .slice(0, 20);
}
