import { useState, useRef, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { computeSupply, getDefenderMalus, getTileResources, getAllowedBuildings } from '../lib/supplyEngine'
import type { TheatreTile } from '../lib/supplyEngine'
import { useTheatreDetail } from '../hooks/useChainStore'
import { ChainLoader } from '../components/ChainLoader'

const CONTROL_COLORS: Record<string, string> = {
  faithful: '#4a8acc',
  heretic: '#cc4a3a',
  contested: '#ccaa3a',
  neutral: '#e0d080',
}

const NODE_RADIUS = 30
const MAP_WIDTH = 1200
const MAP_HEIGHT = 680

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  'Cape Trafalgar': { x: 382, y: 628 },
  'Huelva Marshes': { x: 71, y: 349 },
  'Cádiz': { x: 270, y: 519 },
  'Sevilla': { x: 349, y: 314 },
  'Jerez': { x: 413, y: 438 },
  'Breach of Córdoba': { x: 576, y: 203 },
  'Guadalquivir Crossing': { x: 590, y: 344 },
  'Jaén Highlands': { x: 755, y: 258 },
  'Málaga': { x: 629, y: 500 },
  'Sierra Morena Pass': { x: 782, y: 140 },
  'Granada': { x: 805, y: 391 },
  'Linares': { x: 959, y: 320 },
  'Sierra Nevada': { x: 1030, y: 468 },
  'Úbeda': { x: 1043, y: 217 },
  'Almería Wastes': { x: 1107, y: 304 },
}


export function TheatreDetail() {
  const { id } = useParams<{ id: string }>()
  const { theatre: chainTheatreResult, buildingData, loading: theatreLoading } = useTheatreDetail(id)
  const [selectedNode, setSelectedNode] = useState<number | null>(null)
  const [hoveredNode, setHoveredNode] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const dragDistRef = useRef(0)

  // Editor mode: drag nodes to reposition
  const [editMode, setEditMode] = useState(false)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(NODE_POSITIONS)
  const [draggingNode, setDraggingNode] = useState<string | null>(null)

  const chainTheatre = chainTheatreResult ?? null

  const theatre = useMemo(() => {
    if (!chainTheatre) return null
    return {
      id: chainTheatre.code,
      name: chainTheatre.name,
      description: chainTheatre.description,
      lore: chainTheatre.lore,
      tiles: chainTheatre.nodes.map(n => ({
        q: n.coord[0], r: n.coord[1], terrain: n.terrain,
        node: { name: n.name, type: n.nodeType, control: n.control.toLowerCase(), desc: n.desc },
        logistics: { supply_source: n.supplySource, demand: n.demand },
        buildings: n.buildings,
      })),
      edges: chainTheatre.edges.map(e => [e.from, e.to] as [number, number]),
      edge_capacity: chainTheatre.edges.map(e => e.capacity),
      context_tiles: chainTheatre.contextTiles.map(ct => ({ q: ct.coord[0], r: ct.coord[1], terrain: ct.terrain })),
    }
  }, [chainTheatre])

  const [viewFaction, setViewFaction] = useState<'faithful' | 'heretic'>('faithful')

  const supplyData = useMemo(() => {
    if (!theatre || !buildingData) return null
    return computeSupply(
      buildingData,
      theatre.tiles as TheatreTile[],
      theatre.edges as [number, number][],
      theatre.edge_capacity,
      viewFaction
    )
  }, [theatre, viewFaction, buildingData])

  function svgPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = svgRef.current
    if (!svg) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const svgPt = pt.matrixTransform(ctm.inverse())
    return { x: Math.round(svgPt.x), y: Math.round(svgPt.y) }
  }

  function exportPositions() {
    const json = JSON.stringify(positions, null, 2)
    navigator.clipboard.writeText(json)
    alert('Positions copied to clipboard!')
  }


  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !draggingNode) {
      e.preventDefault()
      setIsPanning(true)
      dragDistRef.current = 0
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    }
  }, [pan, draggingNode])

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (draggingNode) {
      const pt = svgPoint(e.clientX, e.clientY)
      if (pt) {
        setPositions(prev => ({ ...prev, [draggingNode]: pt }))
      }
      return
    }
    if (!isPanning) return
    const dx = e.clientX - panStartRef.current.x
    const dy = e.clientY - panStartRef.current.y
    dragDistRef.current = Math.abs(dx) + Math.abs(dy)
    setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy })
  }, [isPanning, draggingNode])

  const handlePanEnd = useCallback(() => {
    setIsPanning(false)
    setDraggingNode(null)
  }, [])

  if (theatreLoading || !theatre) {
    return <ChainLoader title="Theatre of War" skeletonCount={3} steps={[
      { label: 'Theatre graph', status: chainTheatre ? 'done' : theatreLoading ? 'loading' : 'pending', current: chainTheatre?.nodes?.length || undefined },
      { label: 'Building definitions', status: buildingData ? 'done' : 'loading', current: buildingData?.buildings?.length || undefined },
      { label: 'Supply calculations', status: theatre && buildingData ? 'done' : 'pending' },
    ]} />
  }

  if (!theatre) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <p className="text-[var(--muted)]">Theatre not found.</p>
        <Link to="/longwar/theatres" className="text-[var(--accent)] mt-4 inline-block">Back to Theatres</Link>
      </div>
    )
  }

  return (
    <div className="-mx-6 -my-8 h-[calc(100vh-44px)] flex bg-[var(--bg)]">
      {/* Map area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex flex-col"
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        <svg ref={svgRef} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="w-full flex-shrink-0" preserveAspectRatio="xMinYMin meet">
          <defs>
            <style>{`
              @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.9; } }
            `}</style>
          </defs>
          {/* Background map image */}
          <image
            href="/map-cordoba.png"
            x={0} y={0}
            width={MAP_WIDTH} height={MAP_HEIGHT}
            preserveAspectRatio="xMidYMid slice"
          />

          {/* Darken overlay for contrast */}
          <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="rgba(0,0,0,0.15)" />

          {/* Edges (connections between nodes) */}
          {theatre.edges.map(([a, b], i) => {
            const nodeA = theatre.tiles[a]
            const nodeB = theatre.tiles[b]
            const posA = positions[nodeA.node.name]
            const posB = positions[nodeB.node.name]
            if (!posA || !posB) return null
            return (
              <line
                key={`edge-${i}`}
                x1={posA.x} y1={posA.y}
                x2={posB.x} y2={posB.y}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={2}
                strokeDasharray="8,5"
              />
            )
          })}


          {/* Nodes */}
          {theatre.tiles.map((tile, idx) => {
            const pos = positions[tile.node.name]
            if (!pos) return null
            const isSelected = selectedNode === idx
            const isHovered = hoveredNode === idx
            const control = tile.node.control
            const color = CONTROL_COLORS[control] ?? '#888'
            const supply = supplyData?.[idx]
            const supplyLevel = supply?.supply_level ?? 100
            const attackable = supply?.attackable ?? false

            const r = NODE_RADIUS + (isSelected ? 4 : isHovered ? 2 : 0)

            return (
              <g key={idx}>
                {/* Main node circle */}
                <circle
                  cx={pos.x} cy={pos.y}
                  r={r}
                  fill="transparent"
                  stroke={color}
                  strokeWidth={isSelected ? 4 : 2.5}
                  opacity={1}
                  style={{ filter: isSelected ? `drop-shadow(0 0 5px ${color})` : undefined }}
                />
                {/* Supply % label */}
                <text
                  x={pos.x + r + 3} y={pos.y - r + 2}
                  fontSize={8}
                  fontWeight="bold"
                  fill={supplyLevel >= 80 ? '#4ade80' : supplyLevel >= 40 ? '#facc15' : '#ef4444'}
                  style={{ pointerEvents: 'none' }}
                >
                  {Math.round(supplyLevel)}%
                </text>
                {/* Attackable pulse */}
                {attackable && (
                  <circle
                    cx={pos.x} cy={pos.y}
                    r={r + 6}
                    fill="transparent"
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    opacity={0.8}
                    style={{ pointerEvents: 'none', animation: 'pulse 1.5s infinite' }}
                  />
                )}
                {/* Interaction area */}
                <circle
                  cx={pos.x} cy={pos.y}
                  r={r + 6}
                  fill="transparent"
                  stroke="transparent"
                  className={editMode ? 'cursor-move' : 'cursor-pointer'}
                  onMouseDown={(e) => {
                    if (editMode) {
                      e.stopPropagation()
                      setDraggingNode(tile.node.name)
                    }
                  }}
                  onClick={() => {
                    if (editMode) return
                    if (dragDistRef.current > 5) return
                    setSelectedNode(idx === selectedNode ? null : idx)
                  }}
                  onMouseEnter={() => setHoveredNode(idx)}
                  onMouseLeave={() => setHoveredNode(null)}
                />
              </g>
            )
          })}
        </svg>

        {/* Controls overlay */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {/* Faction supply view toggle */}
          <div className="bg-black/70 backdrop-blur-sm rounded-sm flex overflow-hidden">
            <button
              onClick={() => setViewFaction('faithful')}
              className={`text-[9px] font-bold px-2 py-1 transition-colors ${
                viewFaction === 'faithful' ? 'bg-blue-600/80 text-white' : 'text-[var(--muted)] hover:text-white'
              }`}
            >
              Faithful
            </button>
            <button
              onClick={() => setViewFaction('heretic')}
              className={`text-[9px] font-bold px-2 py-1 transition-colors ${
                viewFaction === 'heretic' ? 'bg-red-600/80 text-white' : 'text-[var(--muted)] hover:text-white'
              }`}
            >
              Heretic
            </button>
          </div>
          <button
            onClick={() => setEditMode(!editMode)}
            className={`text-[9px] font-bold px-2 py-1 rounded-sm backdrop-blur-sm transition-colors ${
              editMode ? 'bg-green-600/80 text-white' : 'bg-black/70 text-[var(--muted)] hover:text-white'
            }`}
          >
            {editMode ? '✎ EDIT ON' : '✎ Edit'}
          </button>
          {editMode && (
            <button
              onClick={exportPositions}
              className="text-[9px] font-bold px-2 py-1 rounded-sm bg-black/70 backdrop-blur-sm text-[var(--accent)] hover:text-white"
            >
              Export JSON
            </button>
          )}
        </div>

        {/* Legend */}
        <div className="px-3 py-1.5 flex items-center gap-3">
          {Object.entries(CONTROL_COLORS).map(([key, color]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[9px] text-[var(--muted)] capitalize">{key}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Side panel */}
      <div className="w-72 bg-[var(--card)] border-l border-[var(--border)] overflow-y-auto flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <Link to="/longwar/theatres" className="text-[10px] text-[var(--muted)] hover:text-[var(--fg)] mb-3 inline-block">
            ← Back to Theatres
          </Link>
          <h1 className="text-base font-bold uppercase tracking-wider mb-1">{theatre.name}</h1>
          <p className="text-[var(--muted)] text-[11px] leading-relaxed">{theatre.description}</p>
        </div>

        {selectedNode !== null ? (() => {
          const selTile = theatre.tiles[selectedNode]
          const selSupply = supplyData?.[selectedNode]
          const supplyLevel = selSupply?.supply_level ?? 100
          const malus = getDefenderMalus(supplyLevel)
          return (
          <div className="p-4">
            <button
              onClick={() => setSelectedNode(null)}
              className="text-[9px] text-[var(--muted)] hover:text-[var(--fg)] mb-3 inline-block"
            >
              ← All nodes
            </button>
            <div className="border border-[var(--border)] rounded-sm p-3">
              <h3 className="font-bold text-sm mb-2">{selTile.node.name}</h3>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm border"
                  style={{
                    borderColor: CONTROL_COLORS[selTile.node.control],
                    color: CONTROL_COLORS[selTile.node.control],
                  }}
                >
                  {selTile.node.control}
                </span>
                <span className="text-[9px] text-[var(--muted)] capitalize">
                  {selTile.node.type}
                </span>
              </div>
              <p className="text-[11px] text-[var(--fg-secondary)] leading-relaxed">
                {selTile.node.desc}
              </p>

              {/* Buildings */}
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <h4 className="text-[9px] font-bold uppercase text-[var(--muted)] mb-1.5 tracking-wider">Buildings ({selTile.buildings.length}/4)</h4>
                <div className="space-y-1">
                  {selTile.buildings.map((bid, i) => {
                    const bData = buildingData?.buildings.find(b => b.code === bid)
                    if (!bData) return null
                    return (
                      <div key={i} className="flex items-center justify-between text-[10px] px-1.5 py-1 bg-[var(--bg)]/50 rounded-sm border border-[var(--border)]">
                        <span className="font-medium">{bData.name}</span>
                        <span className="text-[8px] text-[var(--muted)]">
                          {bData.resources.map(p => `${p.code} ×${p.output}`).join(', ')}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {/* Resources total */}
                {selTile.buildings.length > 0 && buildingData && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {getTileResources(buildingData, selTile.buildings).map(r => (
                      <span key={r.resource} className="text-[8px] px-1.5 py-0.5 rounded-sm bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)]">
                        {r.resource} ×{r.output}
                      </span>
                    ))}
                  </div>
                )}
                {/* Allowed buildings for construction */}
                {selTile.buildings.length < 4 && buildingData && (
                  <div className="mt-2">
                    <span className="text-[8px] text-[var(--muted)]">Can build:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {getAllowedBuildings(buildingData, selTile.node.type)
                        .filter(bid => !selTile.buildings.includes(bid))
                        .map(bid => {
                          const bData = buildingData.buildings.find(b => b.code === bid)
                          return bData ? (
                            <span key={bid} className="text-[8px] px-1.5 py-0.5 rounded-sm border border-dashed border-[var(--border)] text-[var(--muted)]">
                              {bData.name}
                            </span>
                          ) : null
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Supply info */}
              <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-[var(--muted)]">Supply ({viewFaction})</span>
                  <span className={`text-[10px] font-bold ${supplyLevel >= 80 ? 'text-green-400' : supplyLevel >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {Math.round(supplyLevel)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${supplyLevel >= 80 ? 'bg-green-500' : supplyLevel >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${supplyLevel}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[8px] text-[var(--muted)]">
                  <span>Production: {selSupply?.production ?? 0}</span>
                  <span>Demand: {selTile.logistics.demand}</span>
                </div>
                {selSupply?.attackable && (
                  <div className="bg-red-900/30 border border-red-500/50 rounded-sm px-2 py-1.5 mt-2">
                    <span className="text-[9px] font-bold text-red-400 uppercase">Attackable</span>
                    <p className="text-[8px] text-red-300/80 mt-0.5">Supply critically low. Battle can be initiated.</p>
                  </div>
                )}
                {malus.ducatPenalty > 0 && (
                  <div className="text-[8px] text-[var(--muted)] space-y-0.5 mt-1">
                    <p>Defender malus: -{malus.ducatPenalty} ducats</p>
                    {malus.fieldStrengthPenalty > 0 && <p>Field strength: -{malus.fieldStrengthPenalty}</p>}
                    {malus.autoSurrender && <p className="text-red-400">Auto-surrender in 2 turns</p>}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <span className="text-[9px] text-[var(--muted)]">
                  Terrain: {selTile.terrain}
                </span>
              </div>
            </div>
          </div>
          )
        })() : (
          <div className="p-4 flex-1 overflow-y-auto">
            <h3 className="text-[10px] font-bold uppercase text-[var(--muted)] mb-2 tracking-wider">Campaign Nodes</h3>
            <div className="space-y-1">
              {theatre.tiles.map((tile, idx) => {
                const nodeSupply = supplyData?.[idx]
                const sl = nodeSupply?.supply_level ?? 100
                return (
                <button
                  key={idx}
                  onClick={() => setSelectedNode(idx)}
                  onMouseEnter={() => setHoveredNode(idx)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className={`w-full text-left text-[11px] px-2 py-1.5 rounded-sm border transition-colors flex items-center gap-2 ${
                    nodeSupply?.attackable ? 'border-red-500/50 bg-red-900/10' :
                    hoveredNode === idx ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--border)] hover:border-[var(--fg)]/30'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CONTROL_COLORS[tile.node.control] }}
                  />
                  <span className="truncate">{tile.node.name}</span>
                  <span className={`text-[8px] ml-auto font-mono ${sl >= 80 ? 'text-green-400' : sl >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {Math.round(sl)}%
                  </span>
                </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Lore */}
        <div className="p-4 border-t border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted)] italic leading-relaxed">{theatre.lore}</p>
        </div>
      </div>
    </div>
  )
}
