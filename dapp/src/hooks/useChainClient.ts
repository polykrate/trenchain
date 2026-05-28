import { DedotClient, WsProvider } from 'dedot';
import type { ParachainTemplateRuntimeApi } from '../chain-api/parachain-template-runtime';

const WS_LOCAL = import.meta.env.VITE_WS_ENDPOINT || 'ws://127.0.0.1:9944';
const WS_REMOTE = import.meta.env.VITE_WS_FALLBACK || 'wss://trenchain.ngrok.dev';

let clientPromise: Promise<DedotClient<ParachainTemplateRuntimeApi>> | null = null;
let activeEndpoint: string = WS_LOCAL;

async function tryConnect(endpoint: string): Promise<DedotClient<ParachainTemplateRuntimeApi>> {
  const provider = new WsProvider(endpoint);
  const client = await DedotClient.new<ParachainTemplateRuntimeApi>(provider);
  activeEndpoint = endpoint;
  return client;
}

export function getChainClient(): Promise<DedotClient<ParachainTemplateRuntimeApi>> {
  if (!clientPromise) {
    clientPromise = tryConnect(WS_LOCAL).catch(() => {
      console.warn(`[chain] Local WS unreachable, falling back to ${WS_REMOTE}`);
      return tryConnect(WS_REMOTE);
    });
  }
  return clientPromise;
}

export function getActiveEndpoint(): string {
  return activeEndpoint;
}

export function resetChainClient(): void {
  clientPromise = null;
}

export type { ParachainTemplateRuntimeApi };
