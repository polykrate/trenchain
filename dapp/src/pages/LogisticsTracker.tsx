import { useState, useEffect, useRef, useCallback } from 'react'
import { getChainClient } from '../hooks/useChainClient'
import hexRegions from '../data/rules/hex_regions.json'

interface RegionStock {
  region: string;
  regionName: string;
  resources: { code: string; qty: number }[];
}

interface RegionDemand {
  region: string;
  regionName: string;
  resources: { code: string; qty: number }[];
}

interface TransitPacket {
  resource: string;
  qty: number;
  origin: string;
  destination: string;
  ttmRemaining: number;
}

function decode(bytes: any): string {
  if (!bytes) return ''
  let arr: Uint8Array
  if (typeof bytes === 'string') {
    const hex = bytes.startsWith('0x') ? bytes.slice(2) : bytes
    arr = new Uint8Array(hex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
  } else if (bytes instanceof Uint8Array) {
    arr = bytes
  } else {
    arr = new Uint8Array(bytes)
  }
  const end = arr.indexOf(0)
  return new TextDecoder().decode(arr.slice(0, end === -1 ? undefined : end))
}


export function LogisticsTracker() {
  const [stocks, setStocks] = useState<RegionStock[]>([])
  const [demands, setDemands] = useState<RegionDemand[]>([])
  const [packets, setPackets] = useState<TransitPacket[]>([])
  const [loading, setLoading] = useState(true)
  const [blockNumber, setBlockNumber] = useState(0)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filter, setFilter] = useState('')
  const unsubRef = useRef<(() => void) | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const client = await getChainClient()
      const q = client.query as any

      // Fetch known regions from chain (returns hex strings like "0x6965...")
      let rawRegions: string[] = []
      try {
        const raw = await q.logistics.knownRegions()
        if (raw && Array.isArray(raw)) {
          rawRegions = raw
        }
      } catch { /* pallet may not exist yet */ }

      if (rawRegions.length === 0) {
        setStocks([])
        setDemands([])
        setPackets([])
        setLoading(false)
        return
      }

      const stockResults: RegionStock[] = []
      const demandResults: RegionDemand[] = []
      const allPackets: TransitPacket[] = []

      // Only query regions that have data (limit to avoid 162 sequential queries)
      const BATCH_LIMIT = 50
      const batch = rawRegions.slice(0, BATCH_LIMIT)

      await Promise.all(batch.map(async (regionHex) => {
        const regionCode = decode(regionHex)
        const regionName = (hexRegions as any)[regionCode]?.name || regionCode

        // Stock
        try {
          const rawStock = await q.logistics.regionStock(regionHex)
          if (rawStock && Array.isArray(rawStock) && rawStock.length > 0) {
            const resources = rawStock.map((entry: any) => ({
              code: decode(entry[0]),
              qty: Number(entry[1]),
            })).filter((e: any) => e.qty > 0)
            if (resources.length > 0) {
              stockResults.push({ region: regionCode, regionName, resources })
            }
          }
        } catch {}

        // Demand
        try {
          const rawDemand = await q.demand.regionDemand(regionHex)
          if (rawDemand && Array.isArray(rawDemand) && rawDemand.length > 0) {
            const resources = rawDemand.map((entry: any) => ({
              code: decode(entry[0]),
              qty: Number(entry[1]),
            })).filter((e: any) => e.qty > 0)
            if (resources.length > 0) {
              demandResults.push({ region: regionCode, regionName, resources })
            }
          }
        } catch {}

        // In-transit
        try {
          const rawTransit = await q.logistics.inTransit(regionHex)
          if (rawTransit && Array.isArray(rawTransit) && rawTransit.length > 0) {
            for (const pkt of rawTransit) {
              allPackets.push({
                resource: decode(pkt.resource),
                qty: Number(pkt.qty),
                origin: decode(pkt.origin),
                destination: decode(pkt.destination),
                ttmRemaining: Number(pkt.ttmRemaining),
              })
            }
          }
        } catch {}
      }))

      setStocks(stockResults)
      setDemands(demandResults)
      setPackets(allPackets)
      setLoading(false)
    } catch (err) {
      console.warn('[LogisticsTracker] fetch error', err)
      setLoading(false)
    }
  }, [])

  // Subscribe to new blocks for auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    let cancelled = false
    let unsub: (() => void) | null = null

    async function subscribe() {
      try {
        const client = await getChainClient()
        unsub = await (client as any).chainHead.follow(false, async (block: any) => {
          if (cancelled) return
          const num = block?.number ?? block?.header?.number
          if (num) setBlockNumber(Number(num))
          fetchData()
        })
        unsubRef.current = unsub
      } catch {
        // Fallback: poll every 6s
        const interval = setInterval(() => {
          if (!cancelled) fetchData()
        }, 6000)
        unsub = () => clearInterval(interval)
        unsubRef.current = unsub
      }
    }

    subscribe()
    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [autoRefresh, fetchData])

  // Initial fetch
  useEffect(() => { fetchData() }, [fetchData])

  const filteredStocks = stocks.filter(s =>
    !filter || s.region.includes(filter) || s.regionName.toLowerCase().includes(filter.toLowerCase())
  )
  const filteredDemands = demands.filter(d =>
    !filter || d.region.includes(filter) || d.regionName.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--accent)]">Logistics Tracker</h1>
          <p className="text-sm text-[var(--muted)]">
            Real-time resource flows across the empire
            {blockNumber > 0 && <span className="ml-2 text-xs opacity-60">Block #{blockNumber}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Filter regions..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="text-xs px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--fg)]"
          />
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs px-3 py-1.5 rounded font-bold transition-colors ${
              autoRefresh
                ? 'bg-[var(--olive)] text-white'
                : 'bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]'
            }`}
          >
            {autoRefresh ? 'LIVE' : 'PAUSED'}
          </button>
          <button
            onClick={fetchData}
            className="text-xs px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--fg)] hover:bg-[var(--card)]"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-[var(--muted)]">
          <div className="animate-pulse text-lg">Loading logistics data...</div>
        </div>
      )}

      {!loading && stocks.length === 0 && demands.length === 0 && packets.length === 0 && (
        <div className="text-center py-12 border border-[var(--border)] rounded bg-[var(--surface)]">
          <p className="text-[var(--muted)]">No logistics data on-chain yet.</p>
          <p className="text-xs text-[var(--muted)] mt-2">Seed the logistics pallets and wait for the on_initialize tick.</p>
        </div>
      )}

      {/* In-Transit Packets */}
      {packets.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)] mb-3">
            In Transit ({packets.length} packets)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {packets.map((pkt, i) => {
              const originName = (hexRegions as any)[pkt.origin]?.name || pkt.origin
              const destName = (hexRegions as any)[pkt.destination]?.name || pkt.destination
              return (
                <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#0891b2] flex items-center justify-center text-white text-xs font-bold">
                    {pkt.qty}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-[var(--fg)] truncate">{pkt.resource}</div>
                    <div className="text-[10px] text-[var(--muted)] truncate">
                      {originName} → {destName}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--accent)] font-mono">
                    {pkt.ttmRemaining}t
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Stock & Demand Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regional Stock */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)] mb-3">
            Regional Stock ({filteredStocks.length} regions)
          </h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredStocks.map(s => (
              <div key={s.region} className="bg-[var(--card)] border border-[var(--border)] rounded p-3">
                <div className="text-xs font-bold text-[var(--fg)] mb-1">{s.regionName}</div>
                <div className="flex flex-wrap gap-2">
                  {s.resources.map(r => (
                    <span key={r.code} className="text-[10px] px-2 py-0.5 rounded bg-[var(--surface)] text-[var(--fg)]">
                      {r.code}: <span className="font-bold text-[var(--olive)]">{r.qty}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {filteredStocks.length === 0 && !loading && (
              <p className="text-xs text-[var(--muted)] py-4 text-center">No stock data</p>
            )}
          </div>
        </section>

        {/* Regional Demand */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)] mb-3">
            Regional Demand ({filteredDemands.length} regions)
          </h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredDemands.map(d => (
              <div key={d.region} className="bg-[var(--card)] border border-[var(--border)] rounded p-3">
                <div className="text-xs font-bold text-[var(--fg)] mb-1">{d.regionName}</div>
                <div className="flex flex-wrap gap-2">
                  {d.resources.map(r => (
                    <span key={r.code} className="text-[10px] px-2 py-0.5 rounded bg-[var(--surface)] text-[var(--fg)]">
                      {r.code}: <span className="font-bold text-[var(--accent)]">{r.qty}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {filteredDemands.length === 0 && !loading && (
              <p className="text-xs text-[var(--muted)] py-4 text-center">No demand data</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
