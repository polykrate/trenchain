import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTheatreDetail } from '../hooks/useChainStore'
import { ChainLoader } from '../components/ChainLoader'
import hexMapData from '../data/rules/hex_map.json'
import hexRegions from '../data/rules/hex_regions.json'

const HEX_SIZE = 12
const SQRT3 = Math.sqrt(3)

interface HexTile {
  q: number
  r: number
  t: string
  g: string | null
}

const TERRAIN_COLORS: Record<string, string> = {
  plains: '#c8b76a',
  temperate_forest: '#5a8a4f',
  desert: '#d4a843',
  taiga: '#3d6b4f',
  mountain: '#7a7a7a',
  steppe: '#b0a060',
  semi_arid: '#c49a50',
  mediterranean: '#7aba6a',
  marsh: '#4a7a5a',
  iron_wall: '#333',
  sea: '#2a4a6b',
}

function hexToPixel(q: number, r: number): { x: number; y: number } {
  const x = HEX_SIZE * (SQRT3 * q + (SQRT3 / 2) * r)
  const y = HEX_SIZE * (1.5 * r)
  return { x, y }
}

function hexCorners(cx: number, cy: number): string {
  const corners: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    corners.push(`${cx + HEX_SIZE * Math.cos(angle)},${cy + HEX_SIZE * Math.sin(angle)}`)
  }
  return corners.join(' ')
}

export function TheatreDetail() {
  const { id } = useParams<{ id: string }>()
  const { theatre, loading } = useTheatreDetail(id)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  const theatreRegions = useMemo(() => {
    if (!theatre) return new Set<string>()
    return new Set(theatre.regions)
  }, [theatre])

  const { tiles, bounds } = useMemo(() => {
    const allTiles = (hexMapData as any).tiles as HexTile[]
    const filtered = allTiles.filter(t => t.g && theatreRegions.has(t.g))

    if (filtered.length === 0) return { tiles: [], bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 } }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const t of filtered) {
      const { x, y } = hexToPixel(t.q, t.r)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }

    const pad = HEX_SIZE * 3
    return {
      tiles: filtered,
      bounds: { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad },
    }
  }, [theatreRegions])

  const regionNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const [code, data] of Object.entries(hexRegions as Record<string, { name: string }>)) {
      map.set(code, data.name)
    }
    return map
  }, [])

  if (loading) return <ChainLoader title="Theatre" skeletonCount={1} steps={[
    { label: 'Loading theatre...', status: 'loading' },
  ]} />

  if (!theatre) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-[var(--accent)]">Theatre not found</h2>
        <Link to="/theatres" className="text-sm underline mt-4 block">Back to theatres</Link>
      </div>
    )
  }

  const viewWidth = bounds.maxX - bounds.minX
  const viewHeight = bounds.maxY - bounds.minY

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <Link to="/theatres" className="text-xs text-[var(--muted)] hover:underline">&larr; All Theatres</Link>
        <h1 className="text-2xl font-bold text-[var(--accent)] mt-1">{theatre.name}</h1>
        <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">{theatre.description}</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative bg-[#1a2a3a]">
          <svg
            viewBox={`${bounds.minX} ${bounds.minY} ${viewWidth} ${viewHeight}`}
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {tiles.map((tile, i) => {
              const { x, y } = hexToPixel(tile.q, tile.r)
              const isSelected = selectedRegion === tile.g
              const baseColor = TERRAIN_COLORS[tile.t] || '#555'
              return (
                <polygon
                  key={i}
                  points={hexCorners(x, y)}
                  fill={isSelected ? '#d4a017' : baseColor}
                  stroke={isSelected ? '#fff' : '#00000040'}
                  strokeWidth={isSelected ? 1.5 : 0.5}
                  opacity={isSelected ? 1 : 0.85}
                  className="cursor-pointer"
                  onClick={() => setSelectedRegion(tile.g === selectedRegion ? null : tile.g)}
                />
              )
            })}

            {/* Objectives markers */}
            {theatre.objectives?.secondaries.map((obj, i) => {
              if (!obj.targetTile) return null
              const { x, y } = hexToPixel(obj.targetTile[0], obj.targetTile[1])
              return (
                <g key={`obj-${i}`}>
                  <circle cx={x} cy={y} r={HEX_SIZE * 0.6} fill="none" stroke="#ff4444" strokeWidth={2} />
                  <text x={x} y={y + 3} textAnchor="middle" fontSize={7} fill="#ff4444" fontWeight="bold">
                    {obj.kind === 'KillLeader' ? '!' : '$'}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-[var(--border)] overflow-y-auto p-4 space-y-4">
          {/* Lore */}
          <div className="bg-[var(--surface)] p-3 rounded border border-[var(--border)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">Lore</h3>
            <p className="text-xs text-[var(--fg)] italic leading-relaxed">{theatre.lore}</p>
          </div>

          {/* Regions */}
          <div className="bg-[var(--surface)] p-3 rounded border border-[var(--border)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">
              Regions ({theatre.regions.length})
            </h3>
            <div className="space-y-1">
              {theatre.regions.map(r => (
                <button
                  key={r}
                  onClick={() => setSelectedRegion(r === selectedRegion ? null : r)}
                  className={`block w-full text-left text-xs px-2 py-1 rounded transition-colors ${
                    r === selectedRegion
                      ? 'bg-[#d4a017] text-black font-bold'
                      : 'text-[var(--fg)] hover:bg-[var(--card)]'
                  }`}
                >
                  {regionNames.get(r) || r}
                </button>
              ))}
            </div>
          </div>

          {/* Objectives */}
          {theatre.objectives && (
            <div className="bg-[var(--surface)] p-3 rounded border border-[var(--border)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">Objectives</h3>
              <div className="text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="font-bold text-[var(--fg)]">Primary:</span>
                  <span className="text-[var(--accent)]">{theatre.objectives.primary}</span>
                </div>
                {theatre.objectives.secondaries.map((obj, i) => (
                  <div key={i} className="flex items-center gap-2 pl-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                    <span className="text-[var(--fg)]">
                      {obj.kind === 'KillLeader' ? 'Kill Leader' : `Loot ${obj.targetResource || 'resource'}`}
                    </span>
                    <span className="text-[var(--muted)]">+{obj.vpReward} VP</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected region info */}
          {selectedRegion && (
            <div className="bg-[var(--card)] p-3 rounded border border-[#d4a017]">
              <h3 className="text-sm font-bold text-[#d4a017]">
                {regionNames.get(selectedRegion) || selectedRegion}
              </h3>
              <p className="text-xs text-[var(--muted)] mt-1">
                {tiles.filter(t => t.g === selectedRegion).length} hexes in this region
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
