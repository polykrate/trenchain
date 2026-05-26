import { useState, useEffect } from 'react';
import { getChainClient } from './useChainClient';
import type { FixedBytes } from 'dedot/codecs';

// ─── Decoders ────────────────────────────────────────────────────────────────

function hexToString(hex: string): string {
  if (!hex || hex === '0x') return '';
  const clean = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  if (clean.length === 0) return '';
  const arr = new Uint8Array(clean.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  return new TextDecoder().decode(arr);
}

function decodeBytes(bytes: Uint8Array | string): string {
  if (typeof bytes === 'string') return hexToString(bytes);
  return new TextDecoder().decode(bytes);
}

function decodeCode(hex: FixedBytes<32> | FixedBytes<16> | Uint8Array): string {
  let bytes: Uint8Array;
  if (typeof hex === 'string') {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    bytes = new Uint8Array(clean.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  } else {
    bytes = hex;
  }
  const end = bytes.indexOf(0);
  return new TextDecoder().decode(bytes.slice(0, end === -1 ? undefined : end));
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChainKeyword {
  code: string;
  name: string;
  description: string;
  kind: 'Tag' | 'Effect';
}

export interface ChainFaction {
  code: string;
  name: string;
  description: string;
  alignment: 'Faithful' | 'Fallen' | 'Neutral';
}

export interface ChainBattlekitItem {
  code: string;
  name: string;
  description: string;
  battlekitType: string;
  range: string;
  cost: number;
  keywords: string[];
  specialRules: string;
}

export interface ChainPatron {
  code: string;
  name: string;
  description: string;
  factions: string[];
  skills: string[];
}

export interface ChainSkill {
  code: string;
  name: string;
  description: string;
}

export interface ChainEntry {
  code: string;
  name: string;
  faction: string;
  minCount: number;
  maxCount: number | undefined;
  cost: number;
  profile: {
    movementInches: number;
    movementType: string;
    ranged: number | undefined;
    melee: number | undefined;
    armour: number;
    base: string;
  };
  description: string;
  lore: string;
  battlekitRules: string;
  compositionNote: string;
  keywords: string[];
  includedBattlekit: string[];
  abilities: { name: string; description: string }[];
}

export interface ChainArmouryItem {
  faction: string;
  itemCode: string;
  cost: number;
  costType: string;
  tags: string[];
}

// ─── Range formatting ────────────────────────────────────────────────────────

function formatWeaponRange(range: any): string {
  if (!range) return '—';
  if (typeof range === 'string') {
    if (range === 'Melee') return 'Melee';
    if (range === 'None') return '—';
    return range;
  }
  if (range.type === 'Melee') return 'Melee';
  if (range.type === 'None') return '—';
  if (range.type === 'Ranged') return `${range.value?.inches ?? 0}″`;
  if (range.type === 'DualPurpose') return `${range.value?.inches ?? 0}″ / Melee`;
  return '—';
}

function formatBase(base: any): string {
  if (!base) return '32mm';
  if (base.type === 'Round') return `${base.value?.diameterMm ?? 32}mm`;
  if (base.type === 'Oval') return `${base.value?.widthMm ?? 25}x${base.value?.lengthMm ?? 50}mm`;
  return '32mm';
}

// ─── Generic hook factory ────────────────────────────────────────────────────

type CacheEntry<T> = { data: T; timestamp: number };
const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 60_000;

function useCachedQuery<T>(key: string, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(() => {
    const c = cache.get(key);
    return c && (Date.now() - c.timestamp < CACHE_TTL) ? c.data : null;
  });
  const [loading, setLoading] = useState(data === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data !== null) return;
    let cancelled = false;

    fetcher()
      .then(result => {
        if (cancelled) return;
        cache.set(key, { data: result, timestamp: Date.now() });
        setData(result);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e.message || 'Chain query failed');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [key, data]);

  return { data, loading, error };
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useChainKeywords() {
  const { data, loading, error } = useCachedQuery('keywords', async () => {
    const client = await getChainClient();
    const entries = await client.query.keyword.keywords.entries();
    return entries
      .map(([key, value]): ChainKeyword => ({
        code: decodeCode(key),
        name: decodeBytes(value.name),
        description: decodeBytes(value.description),
        kind: value.kind,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  return { keywords: data ?? [], loading, error };
}

export function useChainFactions() {
  const { data, loading, error } = useCachedQuery('factions', async () => {
    const client = await getChainClient();
    const entries = await client.query.faction.factions.entries();
    return entries
      .map(([key, value]): ChainFaction => ({
        code: decodeCode(key),
        name: decodeBytes(value.name),
        description: decodeBytes(value.description),
        alignment: value.alignment,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  return { factions: data ?? [], loading, error };
}

export function useChainBattlekit() {
  const { data, loading, error } = useCachedQuery('battlekit', async () => {
    const client = await getChainClient();
    const entries = await client.query.battlekit.items.entries();
    return entries
      .map(([key, value]): ChainBattlekitItem => ({
        code: decodeCode(key),
        name: decodeBytes(value.name),
        description: decodeBytes(value.description),
        battlekitType: value.battlekitType,
        range: formatWeaponRange(value.range),
        cost: value.cost,
        keywords: value.keywords.map(k => decodeCode(k)),
        specialRules: decodeBytes(value.specialRules),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  return { battlekit: data ?? [], loading, error };
}

export function useChainPatrons() {
  const { data, loading, error } = useCachedQuery('patrons', async () => {
    const client = await getChainClient();
    const entries = await client.query.patron.patrons.entries();
    return entries
      .map(([key, value]): ChainPatron => ({
        code: decodeCode(key),
        name: decodeBytes(value.name),
        description: decodeBytes(value.description),
        factions: value.factions.map(f => decodeCode(f)),
        skills: value.skills.map(s => decodeCode(s)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  return { patrons: data ?? [], loading, error };
}

export function useChainSkills() {
  const { data, loading, error } = useCachedQuery('skills', async () => {
    const client = await getChainClient();
    const entries = await client.query.skill.skills.entries();
    return entries
      .map(([key, value]): ChainSkill => ({
        code: decodeCode(key),
        name: decodeBytes(value.name),
        description: decodeBytes(value.description),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  return { skills: data ?? [], loading, error };
}

export function useChainEntries() {
  const { data, loading, error } = useCachedQuery('entries', async () => {
    const client = await getChainClient();
    const rawEntries = await client.query.entry.entries.entries();
    const rawAbilities = await client.query.entry.entryAbilities.entries();

    const abilitiesMap = new Map<string, { name: string; description: string }[]>();
    for (const [key, value] of rawAbilities) {
      const code = decodeCode(key);
      abilitiesMap.set(code, value.map((a: any) => ({
        name: decodeBytes(a.name),
        description: decodeBytes(a.description),
      })));
    }

    return rawEntries
      .map(([key, value]): ChainEntry => {
        const code = decodeCode(key);
        return {
          code,
          name: decodeBytes(value.name),
          faction: decodeCode(value.faction),
          minCount: value.minCount,
          maxCount: value.maxCount,
          cost: value.cost,
          profile: {
            movementInches: value.profile.movementInches,
            movementType: value.profile.movementType,
            ranged: value.profile.ranged,
            melee: value.profile.melee,
            armour: value.profile.armour,
            base: formatBase(value.profile.base),
          },
          description: decodeBytes(value.description),
          lore: decodeBytes(value.lore),
          battlekitRules: decodeBytes(value.battlekitRules),
          compositionNote: decodeBytes(value.compositionNote),
          keywords: value.keywords.map((k: any) => decodeCode(k)),
          includedBattlekit: value.includedBattlekit.map((b: any) => decodeCode(b)),
          abilities: abilitiesMap.get(code) ?? [],
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  return { entries: data ?? [], loading, error };
}

export function useChainArmoury() {
  const { data, loading, error } = useCachedQuery('armoury', async () => {
    const client = await getChainClient();
    const entries = await client.query.armoury.entries.entries();
    return entries.map(([key, value]): ChainArmouryItem => ({
      faction: decodeCode(key[0]),
      itemCode: decodeCode(key[1]),
      cost: value.cost,
      costType: value.costType,
      tags: value.tags.map((t: any) => decodeCode(t)),
    }));
  });
  return { armoury: data ?? [], loading, error };
}
