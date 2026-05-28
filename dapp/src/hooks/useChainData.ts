import { useState, useEffect } from 'react';
import { getChainClient } from './useChainClient';
import { decodeBytes, decodeCode, formatWeaponRange, formatBase } from '../lib/chainCodec';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChainKeyword {
  code: string;
  name: string;
  description: string;
  kind: string;
}

export interface ChainFaction {
  code: string;
  name: string;
  description: string;
  alignment: string;
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

export interface Compendium {
  keywords: ChainKeyword[];
  factions: ChainFaction[];
  battlekit: ChainBattlekitItem[];
  patrons: ChainPatron[];
  skills: ChainSkill[];
  entries: ChainEntry[];
  armoury: ChainArmouryItem[];
}

// ─── Cache ───────────────────────────────────────────────────────────────────

let compendiumCache: { data: Compendium; timestamp: number } | null = null;
const CACHE_TTL = 120_000;

export interface CompendiumProgress {
  keywords: number
  factions: number
  battlekit: number
  patrons: number
  skills: number
  entries: number
  armoury: number
}

type ProgressCallback = (progress: CompendiumProgress) => void;

async function fetchCompendium(onProgress?: ProgressCallback): Promise<Compendium> {
  if (compendiumCache && Date.now() - compendiumCache.timestamp < CACHE_TTL) {
    return compendiumCache.data;
  }

  const client = await getChainClient();

  const progress: CompendiumProgress = { keywords: 0, factions: 0, battlekit: 0, patrons: 0, skills: 0, entries: 0, armoury: 0 };
  const report = () => onProgress?.({ ...progress });

  const fetchers = [
    client.query.keyword.keywords.entries().then(r => { progress.keywords = r.length; report(); return r; }),
    client.query.faction.factions.entries().then(r => { progress.factions = r.length; report(); return r; }),
    client.query.battlekit.items.entries().then(r => { progress.battlekit = r.length; report(); return r; }),
    client.query.patron.patrons.entries().then(r => { progress.patrons = r.length; report(); return r; }),
    client.query.skill.skills.entries().then(r => { progress.skills = r.length; report(); return r; }),
    client.query.entry.entries.entries().then(r => { progress.entries = r.length; report(); return r; }),
    client.query.entry.entryAbilities.entries(),
    client.query.armoury.entries.entries().then(r => { progress.armoury = r.length; report(); return r; }),
  ];

  const [rawKeywords, rawFactions, rawBattlekit, rawPatrons, rawSkills, rawEntries, rawAbilities, rawArmoury] =
    await Promise.all(fetchers);

  const abilitiesMap = new Map<string, { name: string; description: string }[]>();
  for (const [key, value] of rawAbilities) {
    const code = decodeCode(key);
    abilitiesMap.set(code, (value as any[]).map((a: any) => ({
      name: decodeBytes(a.name),
      description: decodeBytes(a.description),
    })));
  }

  const data: Compendium = {
    keywords: rawKeywords
      .map(([key, value]): ChainKeyword => ({
        code: decodeCode(key),
        name: decodeBytes(value.name),
        description: decodeBytes(value.description),
        kind: (value as any).kind?.type ?? (value as any).kind ?? 'Tag',
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),

    factions: rawFactions
      .map(([key, value]): ChainFaction => ({
        code: decodeCode(key),
        name: decodeBytes(value.name),
        description: decodeBytes(value.description),
        alignment: (value as any).alignment?.type ?? (value as any).alignment ?? 'Neutral',
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),

    battlekit: rawBattlekit
      .map(([key, value]): ChainBattlekitItem => ({
        code: decodeCode(key),
        name: decodeBytes(value.name),
        description: decodeBytes(value.description),
        battlekitType: (value as any).battlekitType?.type ?? (value as any).battlekitType ?? 'Equipment',
        range: formatWeaponRange((value as any).range),
        cost: value.cost,
        keywords: (value as any).keywords?.map((k: any) => decodeCode(k)) ?? [],
        specialRules: decodeBytes((value as any).specialRules),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),

    patrons: rawPatrons
      .map(([key, value]): ChainPatron => ({
        code: decodeCode(key),
        name: decodeBytes(value.name),
        description: decodeBytes(value.description),
        factions: (value as any).factions?.map((f: any) => decodeCode(f)) ?? [],
        skills: (value as any).skills?.map((s: any) => decodeCode(s)) ?? [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),

    skills: rawSkills
      .map(([key, value]): ChainSkill => ({
        code: decodeCode(key),
        name: decodeBytes(value.name),
        description: decodeBytes(value.description),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),

    entries: rawEntries
      .map(([key, value]): ChainEntry => {
        const code = decodeCode(key);
        const v = value as any;
        return {
          code,
          name: decodeBytes(v.name),
          faction: decodeCode(v.faction),
          minCount: v.minCount,
          maxCount: v.maxCount ?? undefined,
          cost: v.cost,
          profile: {
            movementInches: v.profile?.movementInches ?? 0,
            movementType: v.profile?.movementType?.type ?? v.profile?.movementType ?? 'Infantry',
            ranged: v.profile?.ranged ?? undefined,
            melee: v.profile?.melee ?? undefined,
            armour: v.profile?.armour ?? 0,
            base: formatBase(v.profile?.base),
          },
          description: decodeBytes(v.description),
          lore: decodeBytes(v.lore),
          battlekitRules: decodeBytes(v.battlekitRules),
          compositionNote: decodeBytes(v.compositionNote),
          keywords: v.keywords?.map((k: any) => decodeCode(k)) ?? [],
          includedBattlekit: v.includedBattlekit?.map((b: any) => decodeCode(b)) ?? [],
          abilities: abilitiesMap.get(code) ?? [],
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),

    armoury: rawArmoury.map(([key, value]): ChainArmouryItem => {
      const v = value as any;
      return {
        faction: decodeCode((key as any)[0] ?? key),
        itemCode: decodeCode((key as any)[1] ?? key),
        cost: v.cost ?? 0,
        costType: v.costType?.type ?? v.costType ?? 'Ducats',
        tags: v.tags?.map((t: any) => decodeCode(t)) ?? [],
      };
    }),
  };

  compendiumCache = { data, timestamp: Date.now() };
  return data;
}

// ─── Unified hook with progress ──────────────────────────────────────────────

export function useCompendium() {
  const [data, setData] = useState<Compendium | null>(compendiumCache?.data ?? null);
  const [loading, setLoading] = useState(data === null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<CompendiumProgress>({ keywords: 0, factions: 0, battlekit: 0, patrons: 0, skills: 0, entries: 0, armoury: 0 });

  useEffect(() => {
    if (data !== null) return;
    let cancelled = false;

    fetchCompendium((p) => { if (!cancelled) setProgress(p); })
      .then(result => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e.message || 'Chain query failed');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [data]);

  return { compendium: data, loading, error, progress };
}

// ─── Convenience hooks (thin wrappers) ──────────────────────────────────────

export function useChainKeywords() {
  const { compendium, loading, error, progress } = useCompendium();
  return { keywords: compendium?.keywords ?? [], loading, error, count: progress.keywords };
}

export function useChainFactions() {
  const { compendium, loading, error, progress } = useCompendium();
  return { factions: compendium?.factions ?? [], loading, error, count: progress.factions };
}

export function useChainBattlekit() {
  const { compendium, loading, error, progress } = useCompendium();
  return { battlekit: compendium?.battlekit ?? [], loading, error, count: progress.battlekit };
}

export function useChainPatrons() {
  const { compendium, loading, error, progress } = useCompendium();
  return { patrons: compendium?.patrons ?? [], loading, error, count: progress.patrons };
}

export function useChainSkills() {
  const { compendium, loading, error, progress } = useCompendium();
  return { skills: compendium?.skills ?? [], loading, error, count: progress.skills };
}

export function useChainEntries() {
  const { compendium, loading, error, progress } = useCompendium();
  return { entries: compendium?.entries ?? [], loading, error, count: progress.entries };
}

export function useChainArmoury() {
  const { compendium, loading, error, progress } = useCompendium();
  return { armoury: compendium?.armoury ?? [], loading, error, count: progress.armoury };
}
