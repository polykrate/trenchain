import { DedotClient, WsProvider } from 'dedot';
import type { ParachainTemplateRuntimeApi } from '../chain-api/parachain-template-runtime';

const WS_ENDPOINT = import.meta.env.VITE_WS_ENDPOINT || 'ws://127.0.0.1:9944';

let clientPromise: Promise<DedotClient<ParachainTemplateRuntimeApi>> | null = null;

export function getChainClient(): Promise<DedotClient<ParachainTemplateRuntimeApi>> {
  if (!clientPromise) {
    clientPromise = DedotClient.new<ParachainTemplateRuntimeApi>(
      new WsProvider(WS_ENDPOINT)
    );
  }
  return clientPromise;
}

export type { ParachainTemplateRuntimeApi };
