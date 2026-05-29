import { getChainClient } from '../hooks/useChainClient';
import { decodeBytes, decodeCode, toCode16, toCode32 } from '../lib/chainCodec';

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}

export type WarbandId = number;

export interface WarbandMeta {
  id: WarbandId;
  owner: string;
  faction: string;
  patron: string;
  name: string;
  ducats: number;
  glory: number;
  elites: number;
  gamesPlayed: number;
  campaignId: number | null;
  locked: boolean;
}

export async function getWarband(id: WarbandId): Promise<WarbandMeta | null> {
  const client = await getChainClient();
  const raw = await client.query.warband.warbands(id);
  if (!raw) return null;
  const r = raw as any;
  return {
    id,
    owner: r.owner?.toString?.() ?? r.owner,
    faction: decodeCode(r.faction),
    patron: decodeCode(r.patron),
    name: decodeBytes(r.name),
    ducats: r.ducats,
    glory: r.glory,
    elites: r.elites,
    gamesPlayed: r.gamesPlayed ?? r.games_played ?? 0,
    campaignId: r.campaignId ?? null,
    locked: r.locked ?? false,
  };
}

export async function getOwnedWarbandIds(owner: string): Promise<WarbandId[]> {
  const client = await getChainClient();
  const raw = await client.query.warband.ownerWarbands(owner);
  return (raw as any) ?? [];
}

export async function getOwnedWarbands(owner: string): Promise<WarbandMeta[]> {
  const ids = await getOwnedWarbandIds(owner);
  const results: WarbandMeta[] = [];
  for (const id of ids) {
    const w = await getWarband(id);
    if (w) results.push(w);
  }
  return results;
}

export async function createWarband(
  signer: any,
  faction: string,
  patron: string,
  name: string,
): Promise<void> {
  const client = await getChainClient();
  const nameHex = bytesToHex(new TextEncoder().encode(name));
  await client.tx.warband.createWarband(
    toCode16(faction) as any,
    toCode32(patron) as any,
    nameHex as any,
  ).signAndSend(signer).untilBestChainBlockIncluded();
}

export async function disbandWarband(signer: any, warbandId: WarbandId): Promise<void> {
  const client = await getChainClient();
  await client.tx.warband.disbandWarband(warbandId).signAndSend(signer);
}

export async function recruitModel(
  signer: any,
  warbandId: WarbandId,
  entryCode: string,
  modelName: string,
  itemCodes: string[],
): Promise<void> {
  const client = await getChainClient();
  const nameHex = bytesToHex(new TextEncoder().encode(modelName));
  await client.tx.roster.recruit(
    warbandId,
    toCode32(entryCode) as any,
    nameHex as any,
    itemCodes.map(c => toCode32(c)) as any,
  ).signAndSend(signer).untilBestChainBlockIncluded();
}

export async function equipItem(
  signer: any,
  warbandId: WarbandId,
  slot: number,
  itemCode: string,
): Promise<void> {
  const client = await getChainClient();
  await client.tx.roster.equipItem(
    warbandId,
    slot,
    toCode32(itemCode) as any,
  ).signAndSend(signer).untilBestChainBlockIncluded();
}

export async function getNextWarbandId(): Promise<WarbandId> {
  const client = await getChainClient();
  return await client.query.warband.nextWarbandId() as number;
}
