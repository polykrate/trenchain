import { useState, useEffect } from 'react';
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

function decodeResourceCode(bytes: Uint8Array | number[]): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const end = arr.indexOf(0);
  return new TextDecoder().decode(arr.slice(0, end === -1 ? undefined : end));
}

function decodeRegionCode(bytes: Uint8Array | number[]): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const end = arr.indexOf(0);
  return new TextDecoder().decode(arr.slice(0, end === -1 ? undefined : end));
}

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
    return () => { cancelled = true; };
  }, [regionCode]);

  return data;
}
