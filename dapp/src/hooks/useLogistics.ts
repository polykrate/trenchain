import { useState, useEffect, useRef, useCallback } from 'react';
import { getChainClient } from './useChainClient';

export interface RegionStockEntry {
  resource: string;
  qty: number;
}

export interface RegionDemandEntry {
  resource: string;
  qty: number;
}

export interface TransitPacket {
  resource: string;
  qty: number;
  origin: string;
  destination: string;
  currentRegion: string;
  ttmRemaining: number;
}

export interface LogisticsData {
  stock: RegionStockEntry[];
  demand: RegionDemandEntry[];
  inTransit: TransitPacket[];
  loading: boolean;
}

function decodeBytes(bytes: any): string {
  if (!bytes) return '';
  let arr: Uint8Array;
  if (typeof bytes === 'string') {
    const hex = bytes.startsWith('0x') ? bytes.slice(2) : bytes;
    arr = new Uint8Array(hex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
  } else if (bytes instanceof Uint8Array) {
    arr = bytes;
  } else {
    arr = new Uint8Array(bytes);
  }
  const end = arr.indexOf(0);
  return new TextDecoder().decode(arr.slice(0, end === -1 ? undefined : end));
}

const decodeResourceCode = decodeBytes;
const decodeRegionCode = decodeBytes;

export function useLogistics(regionCode: string | null): LogisticsData {
  const [data, setData] = useState<LogisticsData>({
    stock: [], demand: [], inTransit: [], loading: false,
  });

  useEffect(() => {
    if (!regionCode) {
      setData({ stock: [], demand: [], inTransit: [], loading: false });
      return;
    }

    let cancelled = false;
    setData(prev => ({ ...prev, loading: true }));

    async function fetch() {
      try {
        const client = await getChainClient();
        const q = client.query as any;

        // Encode region code to bytes
        const buf = new Uint8Array(32);
        const encoded = new TextEncoder().encode(regionCode!);
        buf.set(encoded.slice(0, 32));
        const regionBytes = `0x${Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')}`;

        // Query stock
        let stock: RegionStockEntry[] = [];
        try {
          const rawStock = await q.logistics.regionStock(regionBytes);
          if (rawStock && Array.isArray(rawStock)) {
            stock = rawStock.map((entry: any) => ({
              resource: decodeResourceCode(entry[0]),
              qty: Number(entry[1]),
            }));
          }
        } catch { /* pallet may not be deployed yet */ }

        // Query demand
        let demand: RegionDemandEntry[] = [];
        try {
          const rawDemand = await q.demand.regionDemand(regionBytes);
          if (rawDemand && Array.isArray(rawDemand)) {
            demand = rawDemand.map((entry: any) => ({
              resource: decodeResourceCode(entry[0]),
              qty: Number(entry[1]),
            }));
          }
        } catch { /* pallet may not be deployed yet */ }

        // Query in-transit packets for this region
        let inTransit: TransitPacket[] = [];
        try {
          const rawTransit = await q.logistics.inTransit(regionBytes);
          if (rawTransit && Array.isArray(rawTransit)) {
            inTransit = rawTransit.map((pkt: any) => ({
              resource: decodeResourceCode(pkt.resource),
              qty: Number(pkt.qty),
              origin: decodeRegionCode(pkt.origin),
              destination: decodeRegionCode(pkt.destination),
              currentRegion: decodeRegionCode(pkt.currentRegion),
              ttmRemaining: Number(pkt.ttmRemaining),
            }));
          }
        } catch { /* pallet may not be deployed yet */ }

        if (!cancelled) {
          setData({ stock, demand, inTransit, loading: false });
        }
      } catch {
        if (!cancelled) {
          setData({ stock: [], demand: [], inTransit: [], loading: false });
        }
      }
    }

    fetch();
    const interval = setInterval(fetch, 6000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [regionCode]);

  return data;
}

/** Fetches all in-transit packets globally across all regions, polling every interval. */
export function useGlobalTransit(enabled: boolean, intervalMs = 6000): { packets: TransitPacket[]; loading: boolean } {
  const [packets, setPackets] = useState<TransitPacket[]>([]);
  const [loading, setLoading] = useState(false);
  const prevRef = useRef<TransitPacket[]>([]);

  const fetchAll = useCallback(async () => {
    if (!enabled) return;
    try {
      const client = await getChainClient();
      const q = client.query as any;
      const known = await q.logistics.knownRegions();
      if (!known || !Array.isArray(known) || known.length === 0) return;

      const all: TransitPacket[] = [];
      const BATCH = 30;
      for (let i = 0; i < known.length; i += BATCH) {
        const batch = known.slice(i, i + BATCH);
        const results = await Promise.all(batch.map((hex: string) => q.logistics.inTransit(hex).catch(() => [])));
        for (const rawTransit of results) {
          if (!rawTransit || !Array.isArray(rawTransit) || rawTransit.length === 0) continue;
          for (const pkt of rawTransit) {
            all.push({
              resource: decodeBytes(pkt.resource),
              qty: Number(pkt.qty),
              origin: decodeBytes(pkt.origin),
              destination: decodeBytes(pkt.destination),
              currentRegion: decodeBytes(pkt.currentRegion),
              ttmRemaining: Number(pkt.ttmRemaining),
            });
          }
        }
      }
      prevRef.current = all;
      setPackets(all);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setPackets([]); return; }
    setLoading(true);
    fetchAll();
    const id = setInterval(fetchAll, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, fetchAll]);

  return { packets, loading };
}
