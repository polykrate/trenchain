import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { territory, theatre as theatreChain, storage } from '../chain'
import type { Theatre } from '../chain/theatre'
import type { CampaignLocation, ResourceType } from '../chain/types'
import hexMapData from '../data/rules/hex_map.json'
import hexCountriesData from '../data/rules/hex_countries.json'
import hexRegionsData from '../data/rules/hex_regions.json'
import hexPoiData from '../data/rules/hex_poi.json'

const RES: Record<ResourceType, { code: string; color: string; label: string }> = {
  ducats: { code: 'DUC', color: '#b45309', label: 'Ducats' },
  iron: { code: 'FER', color: '#6b7280', label: 'Iron / Arms' },
  powder: { code: 'POU', color: '#b91c1c', label: 'Powder' },
  flesh: { code: 'POP', color: '#0891b2', label: 'Population' },
  relics: { code: 'REL', color: '#a16207', label: 'Relics' },
  alchemy: { code: 'ALC', color: '#7c3aed', label: 'Alchemy' },
  occult: { code: 'OCC', color: '#be185d', label: 'Occult' },
}

const TERRAIN_ICON: Record<string, string> = {
  port: '\u2693', coastal: '\u{1F30A}', fortress: '\u{1F3F0}', mountain_pass: '\u26F0',
  mountain: '\u26F0', forest: '\u{1F332}', ruins: '\u{1F3DA}', factory: '\u2699',
  city: '\u{1F3D9}', village: '\u{1F3E0}', plains: '\u{1F33E}', bridge: '\u{1F309}',
  cathedral: '\u271D', marsh: '\u{1F32B}', mine: '\u26CF', quarry: '\u{1FAA8}',
  laboratory: '\u2697', monastery: '\u{1F54D}', hellgate: '\u{1F525}',
  crossroads: '\u{1F6E4}', harbor: '\u{1F6A2}', encampment: '\u26FA',
}

interface DragState {
  nodeId: number
  startX: number
  startY: number
  startPosX: number
  startPosY: number
}

// --- Hex map types and data ---
interface HexTile {
  q: number
  r: number
  t: string
  g: string | null
  w: boolean
}

interface HexRegion {
  name: string
  country: string
  tiles: number[][]
}

interface HexCountry {
  name: string
  faction: string
  control: string
  label_tile: number[]
  regions: string[]
}

interface HexPoi {
  id: string
  name: string
  tile: number[] | null
  type: string
  lore: string
}

const HEX_META = hexMapData.meta as { cols: number; rows: number; hex_size: number; svg_width: number; svg_height: number }
const HEX_TILES = hexMapData.tiles as HexTile[]
const HEX_REGIONS = hexRegionsData as Record<string, HexRegion>
const HEX_COUNTRIES = hexCountriesData as Record<string, HexCountry>
const HEX_POIS = hexPoiData as HexPoi[]

const TERRAIN_COLORS: Record<string, string> = {
  sea: '#1e3a5f',
  temperate_forest: '#4a7a4a',
  taiga: '#3d6b4e',
  tropical_forest: '#2d7a3a',
  plains: '#7a9a5a',
  steppe: '#9a9a5a',
  desert: '#c4a84a',
  semi_arid: '#a89a5a',
  mountain: '#7a7a7a',
  tundra: '#b0c4d4',
  mediterranean: '#6a9a5a',
  marsh: '#5a7a6a',
  volcanic: '#4a3030',
  snow: '#d4dce8',
  iron_wall: '#3d3d3d',
}

const TERRAIN_NAMES: Record<string, string> = {
  sea: 'Sea', temperate_forest: 'Forest', taiga: 'Taiga',
  tropical_forest: 'Tropical Forest', plains: 'Plains', steppe: 'Steppe',
  desert: 'Desert', semi_arid: 'Semi-Arid', mountain: 'Mountain',
  tundra: 'Tundra', mediterranean: 'Mediterranean', marsh: 'Marsh',
  volcanic: 'Volcanic', snow: 'Snow', iron_wall: 'Iron Wall',
}

const POI_ICONS: Record<string, string> = {
  heretic_landmark: '\u{1F525}', faithful_fortress: '\u{1F3F0}',
  heretic_fortress: '\u2620', heretic_outpost: '\u2694',
  neutral_fortress: '\u{1F5E1}', battlefield: '\u2694',
  wall_gate: '\u{1F6AA}', faithful_city: '\u{1F3DB}',
  divine_site: '\u2727',
}

function hexCenter(q: number, r: number): [number, number] {
  const size = HEX_META.hex_size
  const x = size * (3.0 / 2 * q)
  const y = size * (Math.sqrt(3) * (r + 0.5 * (q % 2)))
  const xOff = (HEX_META.svg_width - size * 1.5 * (HEX_META.cols - 1)) / 2
  const yOff = (HEX_META.svg_height - size * Math.sqrt(3) * HEX_META.rows) / 2
  return [x + xOff, y + yOff]
}

function hexPoints(cx: number, cy: number): string {
  const size = HEX_META.hex_size
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i)
    pts.push(`${(cx + size * Math.cos(angle)).toFixed(1)},${(cy + size * Math.sin(angle)).toFixed(1)}`)
  }
  return pts.join(' ')
}


function WorldMapGrid() {
  const [showControl, setShowControl] = useState(true)
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null)
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  const landTiles = useMemo(() => HEX_TILES.filter(h => h.t !== 'sea'), [])

  // Map region -> country for quick lookups
  const regionToCountry = useMemo(() => {
    const map = new Map<string, string>()
    for (const [rid, rdef] of Object.entries(HEX_REGIONS)) {
      map.set(rid, rdef.country)
    }
    return map
  }, [])


  // Country labels from label_tile field
  const countryLabels = useMemo(() => {
    return Object.entries(HEX_COUNTRIES).map(([cid, cdef]) => {
      const [lq, lr] = cdef.label_tile
      const [x, y] = hexCenter(lq, lr)
      return { id: cid, x, y, name: cdef.name, faction: cdef.faction }
    })
  }, [])

  function handleMouseMove(e: React.MouseEvent) {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  function handleHexEnter(tile: HexTile) {
    if (!tile.g) return
    const country = regionToCountry.get(tile.g)
    if (!country) return
    setHoveredCountry(country)
    setHoveredRegion(tile.g)
  }

  function handleHexLeave() {
    setHoveredCountry(null)
    setHoveredRegion(null)
  }

  function handleHexClick(tile: HexTile) {
    if (!tile.g) return
    setSelectedRegions(prev => {
      const next = new Set(prev)
      if (next.has(tile.g!)) next.delete(tile.g!)
      else next.add(tile.g!)
      return next
    })
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl">The Lands of the Great Powers</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Strategic overview — territories held and lost in the eternal war.</p>
        </div>
        <div className="flex items-center gap-4">
          {selectedRegions.size > 0 && (
            <span className="text-xs text-[var(--accent)] font-bold">{selectedRegions.size} regions selected</span>
          )}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm text-[var(--muted)] uppercase tracking-wider font-bold">War Status</span>
            <div className="relative">
              <input type="checkbox" checked={showControl} onChange={() => setShowControl(!showControl)} className="sr-only peer" />
              <div className="w-10 h-5 rounded-full bg-[var(--border)] peer-checked:bg-[#7f1d1d] transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[var(--parchment)] peer-checked:translate-x-5 transition-transform shadow" />
            </div>
          </label>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative w-full border border-[var(--border)] rounded-sm overflow-hidden select-none"
        style={{ aspectRatio: `${HEX_META.svg_width}/${HEX_META.svg_height}` }}
      >
        <svg
          viewBox={`0 0 ${HEX_META.svg_width} ${HEX_META.svg_height}`}
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="heretic-pattern" patternUnits="userSpaceOnUse" width="5" height="5">
              <line x1="0" y1="5" x2="5" y2="0" stroke="rgba(160,0,0,0.4)" strokeWidth="1" />
            </pattern>
            <pattern id="contested-pattern" patternUnits="userSpaceOnUse" width="6" height="6">
              <line x1="0" y1="6" x2="6" y2="0" stroke="rgba(200,100,0,0.4)" strokeWidth="1.2" />
            </pattern>
          </defs>

          <rect x="0" y="0" width={HEX_META.svg_width} height={HEX_META.svg_height} fill={TERRAIN_COLORS.sea} />

          {/* Hex tiles */}
          {HEX_TILES.map((tile, i) => {
            if (tile.t === 'sea') return null
            const [cx, cy] = hexCenter(tile.q, tile.r)
            const pts = hexPoints(cx, cy)
            const color = TERRAIN_COLORS[tile.t] ?? '#555'
            const tileCountry = tile.g ? regionToCountry.get(tile.g) : null
            const isCountryHovered = tileCountry === hoveredCountry
            const isRegionHovered = tile.g === hoveredRegion
            const isSelected = tile.g ? selectedRegions.has(tile.g) : false

            let stroke = 'rgba(30,25,20,0.15)'
            let strokeW = 0.2
            if (isSelected) { stroke = '#fbbf24'; strokeW = 1.5 }
            else if (isRegionHovered) { stroke = 'rgba(255,255,255,0.9)'; strokeW = 1.2 }
            else if (isCountryHovered) { stroke = 'rgba(255,255,255,0.45)'; strokeW = 0.8 }

            return (
              <polygon
                key={i}
                points={pts}
                fill={color}
                stroke={stroke}
                strokeWidth={strokeW}
                className="cursor-pointer"
                onMouseEnter={() => handleHexEnter(tile)}
                onMouseLeave={handleHexLeave}
                onClick={() => handleHexClick(tile)}
              />
            )
          })}

          {/* Control overlay: stripes for heretic/contested countries */}
          {showControl && landTiles.map((tile, i) => {
            if (!tile.g || tile.w) return null
            const country = regionToCountry.get(tile.g)
            if (!country) return null
            const countryDef = HEX_COUNTRIES[country]
            if (!countryDef) return null
            const control = countryDef.control
            if (control !== 'heretic' && control !== 'contested') return null
            const [cx, cy] = hexCenter(tile.q, tile.r)
            const pts = hexPoints(cx, cy)
            const patternId = control === 'heretic' ? 'heretic-pattern' : 'contested-pattern'
            return <polygon key={`ctrl-${i}`} points={pts} fill={`url(#${patternId})`} className="pointer-events-none" />
          })}


          {/* Points of Interest */}
          {HEX_POIS.map(poi => {
            if (!poi.tile) return null
            const [cx, cy] = hexCenter(poi.tile[0], poi.tile[1])
            const icon = POI_ICONS[poi.type] ?? '\u2738'
            const isCity = poi.type.endsWith('_city')
            const labelColor = poi.type.includes('heretic') ? '#ff6b6b' : poi.type === 'neutral_fortress' ? '#c0c0c0' : poi.type === 'divine_site' ? '#a8e6ff' : '#ffd700'
            return (
              <g key={poi.id} className="pointer-events-none">
                <circle cx={cx} cy={cy} r={HEX_META.hex_size * 0.4} fill="rgba(0,0,0,0.7)" stroke={labelColor} strokeWidth={0.8} />
                <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={HEX_META.hex_size * 0.5} className="select-none">
                  {icon}
                </text>
                <text
                  x={cx} y={cy + HEX_META.hex_size * (isCity ? 0.9 : 1.1)}
                  textAnchor="middle" dominantBaseline="middle"
                  className="select-none"
                  style={{
                    fontSize: isCity ? '5px' : '6.5px',
                    fontWeight: isCity ? 400 : 700,
                    fill: labelColor,
                    stroke: 'rgba(0,0,0,0.85)',
                    strokeWidth: isCity ? 1.5 : 2,
                    paintOrder: 'stroke',
                  }}
                >
                  {poi.name}
                </text>
              </g>
            )
          })}

          {/* Country labels */}
          {countryLabels.map(label => {
            const faction = label.faction
            const isHeretic = faction === 'HERETIC'
            const isIslamic = faction === 'FAITHFUL_ISLAMIC'
            const fontSize = label.name.length > 20 ? 9 : label.name.length > 14 ? 11 : 13
            return (
              <text
                key={`lbl-${label.id}`}
                x={label.x} y={label.y}
                textAnchor="middle" dominantBaseline="middle"
                className="pointer-events-none select-none"
                style={{
                  fontSize: `${fontSize}px`, fontWeight: 700,
                  fill: isHeretic ? '#fca5a5' : isIslamic ? '#e8c860' : '#f4ece1',
                  stroke: isHeretic ? 'rgba(15,0,0,0.85)' : 'rgba(25,20,15,0.75)',
                  strokeWidth: 3, paintOrder: 'stroke', letterSpacing: '0.3px',
                }}
              >
                {label.name}
              </text>
            )
          })}
        </svg>

        {/* Hover tooltip */}
        {hoveredCountry && hoveredRegion && (() => {
          const countryDef = HEX_COUNTRIES[hoveredCountry]
          const regionDef = HEX_REGIONS[hoveredRegion]
          if (!countryDef || !regionDef) return null
          const factionColor = countryDef.faction === 'HERETIC' ? '#f87171' : countryDef.faction === 'NEUTRAL' ? '#a3a3a3' : countryDef.faction === 'FAITHFUL_ISLAMIC' ? '#e8c860' : '#86efac'
          return (
            <div
              className="absolute z-50 pointer-events-none w-56 bg-[var(--card)] border border-[var(--sepia)] rounded-sm p-3 shadow-xl"
              style={{
                left: Math.min(mouse.x + 16, (containerRef.current?.clientWidth ?? 400) - 240),
                top: Math.min(mouse.y - 10, (containerRef.current?.clientHeight ?? 300) - 120),
              }}
            >
              <div className="font-bold text-sm text-[var(--fg)]">{countryDef.name}</div>
              <div className="text-[11px] text-[var(--sepia)] mb-1">{regionDef.name}</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: factionColor }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: factionColor }}>
                  {countryDef.faction.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Legend */}
      <div className="mt-3 grid grid-cols-3 gap-4 text-xs">
        <div>
          <div className="font-bold text-[var(--fg)] uppercase tracking-wider text-[10px] mb-1 border-b border-blue-800/50 pb-0.5">The Faithful</div>
          {Object.entries(HEX_COUNTRIES).filter(([, c]) => c.faction.startsWith('FAITHFUL')).map(([id, c]) => (
            <div key={id} className="flex items-center gap-1.5 py-0.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.faction === 'FAITHFUL_ISLAMIC' ? '#e8c860' : '#86b6dc' }} />
              <span className="text-[var(--muted)]">{c.name}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="font-bold text-red-400 uppercase tracking-wider text-[10px] mb-1 border-b border-red-900/50 pb-0.5">Forces of Hell</div>
          {Object.entries(HEX_COUNTRIES).filter(([, c]) => c.faction === 'HERETIC').map(([id, c]) => (
            <div key={id} className="flex items-center gap-1.5 py-0.5">
              <div className="w-2 h-2 rounded-full bg-red-700" />
              <span className="text-[var(--muted)]">{c.name}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="font-bold text-[var(--muted)] uppercase tracking-wider text-[10px] mb-1 border-b border-[var(--border)] pb-0.5">Neutral / Independent</div>
          {Object.entries(HEX_COUNTRIES).filter(([, c]) => c.faction === 'NEUTRAL').map(([id, c]) => (
            <div key={id} className="flex items-center gap-1.5 py-0.5">
              <div className="w-2 h-2 rounded-full bg-stone-500" />
              <span className="text-[var(--muted)]">{c.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {Object.entries(TERRAIN_COLORS).filter(([c]) => c !== 'sea' && c !== 'volcanic').map(([code, color]) => (
          <div key={code} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border border-[var(--border)]" style={{ backgroundColor: color }} />
            <span className="text-[var(--muted)]">{TERRAIN_NAMES[code] ?? code}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TheatreMap() {
  const { id } = useParams<{ id?: string }>()
  const [theatreData, setTheatreData] = useState<Theatre | null>(null)
  const [locations, setLocations] = useState<CampaignLocation[]>([])
  const [hovered, setHovered] = useState<CampaignLocation | null>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState<DragState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (id) {
      theatreChain.getTheatre(id).then(t => {
        if (t) {
          setTheatreData(t)
          const locs: CampaignLocation[] = t.graph.nodes.map(n => ({
            id: n.id,
            name: n.name,
            subtitle: n.subtitle,
            description: n.description,
            terrain: n.terrain,
            resources: n.resources,
            connections: t.graph.edges
              .filter(([a, b]) => a === n.id || b === n.id)
              .map(([a, b]) => a === n.id ? b : a),
            position: n.position,
          }))
          setLocations(locs)
        }
      })
    } else {
      territory.getCampaignMap().then(setLocations)
    }
  }, [id])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setMouse({ x, y })

    if (dragging) {
      const dx = ((e.clientX - dragging.startX) / rect.width) * 100
      const dy = ((e.clientY - dragging.startY) / rect.height) * 100
      setLocations(prev => prev.map(loc =>
        loc.id === dragging.nodeId
          ? { ...loc, position: { x: Math.max(2, Math.min(98, dragging.startPosX + dx)), y: Math.max(2, Math.min(98, dragging.startPosY + dy)) } }
          : loc
      ))
    }
  }, [dragging])

  function handleMouseDown(e: React.MouseEvent, loc: CampaignLocation) {
    e.preventDefault()
    setDragging({ nodeId: loc.id, startX: e.clientX, startY: e.clientY, startPosX: loc.position.x, startPosY: loc.position.y })
  }

  function handleMouseUp() {
    setDragging(null)
  }

  function exportPositions() {
    const data = locations.map(l => ({ id: l.id, name: l.name, x: Math.round(l.position.x * 10) / 10, y: Math.round(l.position.y * 10) / 10 }))
    const json = JSON.stringify(data, null, 2)
    navigator.clipboard.writeText(json)
    alert('Positions copied to clipboard!')
  }

  const title = theatreData?.name ?? 'Theatre Map'
  const subtitle = theatreData?.description ?? 'Drag nodes to reposition.'
  const bgImage = theatreData?.map_cid
    ? storage.getIpfsUrl(theatreData.map_cid)
    : '/map-cordoba.png'

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl">{title}</h1>
          <p className="text-sm text-[var(--muted)] mt-1">{subtitle}</p>
        </div>
        <button
          onClick={exportPositions}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-2 rounded-sm text-sm font-bold uppercase tracking-wider"
        >
          Export Positions
        </button>
      </div>

      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative w-full aspect-[16/9] border border-[var(--border)] rounded-sm overflow-hidden select-none cursor-default"
        style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'var(--surface)' }}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          {locations.flatMap(loc =>
            loc.connections
              .filter(tid => tid > loc.id)
              .map(tid => {
                const t = locations.find(l => l.id === tid)
                if (!t) return null
                return (
                  <line
                    key={`${loc.id}-${tid}`}
                    x1={loc.position.x} y1={loc.position.y}
                    x2={t.position.x} y2={t.position.y}
                    stroke="rgba(139,115,85,0.85)"
                    strokeWidth="0.4"
                  />
                )
              })
          )}
        </svg>

        {locations.map(loc => {
          const isHovered = hovered?.id === loc.id && !dragging
          const isDragged = dragging?.nodeId === loc.id
          return (
            <div
              key={loc.id}
              onMouseEnter={() => !dragging && setHovered(loc)}
              onMouseLeave={() => !dragging && setHovered(null)}
              onMouseDown={(e) => handleMouseDown(e, loc)}
              className={`absolute w-8 h-8 md:w-10 md:h-10 rounded-full border-2 flex items-center justify-center transition-transform ${
                isDragged
                  ? 'scale-125 z-40 border-[var(--accent)] bg-[var(--card)]/95 cursor-grabbing'
                  : isHovered
                    ? 'scale-125 z-30 border-[var(--sepia)] bg-[var(--card)]/95'
                    : 'border-[var(--sepia)]/70 bg-[var(--card)]/90 cursor-grab hover:scale-110 hover:z-20'
              }`}
              style={{ left: `${loc.position.x}%`, top: `${loc.position.y}%`, transform: 'translate(-50%, -50%)' }}
            >
              <span className="text-xs md:text-sm pointer-events-none">{TERRAIN_ICON[loc.terrain] ?? '?'}</span>
            </div>
          )
        })}

        {locations.map(loc => (
          <div
            key={`lbl-${loc.id}`}
            className="absolute text-[7px] md:text-[9px] text-[var(--fg)] whitespace-nowrap pointer-events-none text-center drop-shadow-[0_1px_1px_rgba(244,236,225,0.9)]"
            style={{ left: `${loc.position.x}%`, top: `${loc.position.y + 3.5}%`, transform: 'translateX(-50%)' }}
          >
            {loc.name}
          </div>
        ))}

        {hovered && !dragging && (
          <div
            className="absolute z-50 pointer-events-none w-60 bg-[var(--card)] border border-[var(--sepia)] rounded-sm p-3 shadow-xl"
            style={{
              left: Math.min(mouse.x + 16, (containerRef.current?.clientWidth ?? 400) - 260),
              top: Math.min(mouse.y - 10, (containerRef.current?.clientHeight ?? 300) - 180),
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{TERRAIN_ICON[hovered.terrain]}</span>
              <div>
                <div className="font-bold text-sm text-[var(--fg)]">{hovered.name}</div>
                <div className="text-[10px] text-[var(--sepia)]">{hovered.subtitle}</div>
              </div>
            </div>
            <p className="text-[10px] text-[var(--muted)] mb-2 leading-relaxed">{hovered.description}</p>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {hovered.resources.map((r, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-sm border border-[var(--border)] font-mono" style={{ color: RES[r.type].color }}>
                  {RES[r.type].code} +{r.output}
                </span>
              ))}
            </div>
            <div className="text-[9px] text-[var(--muted)]">
              Links: {hovered.connections.map(cid => locations.find(l => l.id === cid)?.name ?? `#${cid}`).join(' · ')}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {Object.entries(RES).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="font-mono font-bold" style={{ color: val.color }}>{val.code}</span>
            <span className="text-[var(--muted)]">{val.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TerritoryMap() {
  const { id } = useParams<{ id?: string }>()

  if (!id) {
    return <WorldMapGrid />
  }

  return <TheatreMap />
}
