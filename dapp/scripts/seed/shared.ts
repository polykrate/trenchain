import { DedotClient, WsProvider } from 'dedot';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { Keyring } from '@polkadot/keyring';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { ParachainTemplateRuntimeApi } from '../../src/chain-api/parachain-template-runtime';
import type { ParachainTemplateRuntimeRuntimeCallLike } from '../../src/chain-api/parachain-template-runtime/types';
import type { FixedBytes } from 'dedot/codecs';

export type ChainClient = DedotClient<ParachainTemplateRuntimeApi>;
export type CallLike = ParachainTemplateRuntimeRuntimeCallLike;

const WS_ENDPOINT = process.env.WS_ENDPOINT || 'ws://127.0.0.1:9944';
const DATA_DIR = resolve(import.meta.dirname, '../../src/data/rules');
const FAST = process.env.SEED_FAST === '1';

export function loadJson(relativePath: string) {
  return JSON.parse(readFileSync(resolve(DATA_DIR, relativePath), 'utf-8'));
}

export function toBytes(str: string): `0x${string}` {
  const encoded = new TextEncoder().encode(str);
  return `0x${Array.from(encoded).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
}

export function toCode32(str: string): FixedBytes<32> {
  const buf = new Uint8Array(32);
  const encoded = new TextEncoder().encode(str);
  buf.set(encoded.slice(0, 32));
  return `0x${Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')}` as FixedBytes<32>;
}

export function toCode16(str: string): FixedBytes<16> {
  const buf = new Uint8Array(16);
  const encoded = new TextEncoder().encode(str);
  buf.set(encoded.slice(0, 16));
  return `0x${Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')}` as FixedBytes<16>;
}

export async function sudoSend(
  client: ChainClient,
  signer: any,
  call: CallLike,
): Promise<boolean> {
  try {
    const sub = client.tx.sudo.sudo(call).signAndSend(signer);
    await (FAST ? sub.untilBestChainBlockIncluded() : sub.untilFinalized());
    return true;
  } catch (e: any) {
    console.error(`    ⚠ ${e.message?.slice(0, 120)}`);
    return false;
  }
}

export async function sudoBatch(
  client: ChainClient,
  signer: any,
  label: string,
  calls: CallLike[],
  batchSize = 50,
): Promise<void> {
  if (calls.length === 0) return;
  const t0 = Date.now();
  for (let i = 0; i < calls.length; i += batchSize) {
    const chunk = calls.slice(i, i + batchSize);
    const batchCall: CallLike = {
      pallet: 'Utility',
      palletCall: { name: 'Batch', params: { calls: chunk } },
    };
    await sudoSend(client, signer, batchCall);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  [${label}] ${calls.length} calls (${elapsed}s)`);
}

export async function sudoSendAll(
  client: ChainClient,
  signer: any,
  label: string,
  calls: CallLike[],
): Promise<void> {
  if (calls.length === 0) return;
  const t0 = Date.now();
  let ok = 0;

  for (const call of calls) {
    if (await sudoSend(client, signer, call)) ok++;
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  [${label}] ${ok}/${calls.length} (${elapsed}s)`);
}

export async function createClient(): Promise<{ client: ChainClient; alice: any }> {
  if (FAST) console.log('⚡ SEED_FAST=1 — using inBlock confirmation + parallel sends');
  await cryptoWaitReady();
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  const client = await DedotClient.new<ParachainTemplateRuntimeApi>({
    provider: new WsProvider(WS_ENDPOINT),
    rpcVersion: 'legacy',
  });
  return { client, alice };
}

export type { FixedBytes };
