import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { territory, theatre as theatreChain, storage } from '../chain'
import type { Theatre } from '../chain/theatre'
import type { CampaignLocation, ResourceType } from '../chain/types'
import { useMapData } from '../hooks/useChainRules'
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
  control: string
  tiles: number[][]
}

interface HexCountry {
  name: string
  faction: string
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


type ColorMode = 'geography' | 'country'

interface MapFilters {
  colorMode: ColorMode
  labels: boolean
  pois: boolean
  hoverHighlight: boolean
}

const DEFAULT_FILTERS: MapFilters = {
  colorMode: 'country',
  labels: true,
  pois: true,
  hoverHighlight: true,
}

const FILTER_LABELS: Record<Exclude<keyof MapFilters, 'colorMode'>, string> = {
  labels: 'Country Labels',
  pois: 'Points of Interest',
  hoverHighlight: 'Hover Highlight',
}

// Faithful = cold (blues, greens, teals) | Heretic = warm (reds, oranges, crimsons) | Neutral = earthy grays
const COUNTRY_COLORS: Record<string, string> = {
  // Faithful (cold tones)
  kalmar_union: '#3a6a9a',
  crown_england: '#2a7a6a',
  france: '#4a6aaa',
  holy_roman_empire: '#3a7a8a',
  iberia: '#4a8a7a',
  papal_states: '#5a5aaa',
  hungary: '#3a8a6a',
  plc: '#4a6a8a',
  kyiv: '#5a7a9a',
  novgorod: '#2a6a8a',
  new_antioch: '#2a9a7a',
  iron_sultanate: '#3a7a5a',
  numidia: '#4a8a6a',
  // Heretic (warm tones)
  anatolia: '#9a3a2a',
  balkans: '#8a4a3a',
  levant: '#aa3a2a',
  libya: '#9a4a2a',
  domain_mammon: '#7a3a3a',
  arabia: '#aa5a2a',
  caucasus: '#8a3a4a',
  heretic_avignon: '#9a3a5a',
  heretic_cordoba: '#8a3a2a',
  heretic_finland: '#7a2a3a',
  heretic_scotland: '#6a3a3a',
  heretic_tanger: '#9a5a3a',
  // Neutral (muted earth)
  golden_khanate: '#7a7a5a',
  morocco: '#8a7a5a',
}

function hashRegionId(regionId: string): number {
  let h = 0
  for (let i = 0; i < regionId.length; i++) {
    h = ((h << 5) - h + regionId.charCodeAt(i)) | 0
  }
  return h
}

function variantColor(baseHex: string, regionId: string): string {
  const seed = hashRegionId(regionId)
  const shift = ((seed % 30) - 15)
  const r = Math.min(255, Math.max(0, parseInt(baseHex.slice(1, 3), 16) + shift))
  const g = Math.min(255, Math.max(0, parseInt(baseHex.slice(3, 5), 16) + shift * 0.7))
  const b = Math.min(255, Math.max(0, parseInt(baseHex.slice(5, 7), 16) - shift * 0.3))
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
}

function WorldMapGrid() {
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS)
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null)
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const landTiles = useMemo(() => HEX_TILES.filter(h => h.t !== 'sea'), [])

  // Compute base tight viewBox around land tiles

  const [containerSize, setContainerSize] = useState({ width: 1600, height: 900 })
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width > 0 && height > 0) setContainerSize({ width, height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const baseViewBox = useMemo(() => {
    const ROW_MIN = 5
    const ROW_MAX = 51
    const COL_MAX = 86
    const padW = HEX_META.hex_size * 3
    const padH = HEX_META.hex_size * 0.5

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const tile of landTiles) {
      if (tile.r < ROW_MIN || tile.r > ROW_MAX) continue
      if (tile.q > COL_MAX) continue
      const [cx, cy] = hexCenter(tile.q, tile.r)
      if (cx < minX) minX = cx
      if (cx > maxX) maxX = cx
      if (cy < minY) minY = cy
      if (cy > maxY) maxY = cy
    }
    const contentW = maxX - minX + padW * 2
    const contentH = maxY - minY + padH * 2
    const contentCx = minX - padW + contentW / 2
    const contentCy = minY - padH + contentH / 2

    const containerAR = containerSize.width / containerSize.height
    const contentAR = contentW / contentH
    let w: number, h: number
    if (containerAR > contentAR) {
      h = contentH
      w = h * containerAR
    } else {
      w = contentW
      h = w / containerAR
    }
    return { x: contentCx - w / 2, y: contentCy - h / 2, w, h }
  }, [landTiles, containerSize])

  const currentViewBox = useMemo(() => {
    const w = baseViewBox.w / zoom
    const h = baseViewBox.h / zoom
    // Clamp pan so view stays within map bounds
    const maxPanX = (baseViewBox.w - w) / 2
    const maxPanY = (baseViewBox.h - h) / 2
    const cx = baseViewBox.x + baseViewBox.w / 2 + Math.max(-maxPanX, Math.min(maxPanX, pan.x))
    const cy = baseViewBox.y + baseViewBox.h / 2 + Math.max(-maxPanY, Math.min(maxPanY, pan.y))
    return `${(cx - w / 2).toFixed(1)} ${(cy - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`
  }, [baseViewBox, zoom, pan])

  const zoomRef = useRef(zoom)
  const panRef = useRef(pan)
  zoomRef.current = zoom
  panRef.current = pan

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      e.stopPropagation()
      const rect = el!.getBoundingClientRect()
      const cursorFracX = (e.clientX - rect.left) / rect.width
      const cursorFracY = (e.clientY - rect.top) / rect.height

      const oldZoom = zoomRef.current
      const oldPan = panRef.current
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const newZoom = Math.max(1, Math.min(8, oldZoom * factor))

      const oldW = baseViewBox.w / oldZoom
      const oldH = baseViewBox.h / oldZoom
      const newW = baseViewBox.w / newZoom
      const newH = baseViewBox.h / newZoom

      const oldCx = baseViewBox.x + baseViewBox.w / 2 + oldPan.x
      const oldCy = baseViewBox.y + baseViewBox.h / 2 + oldPan.y
      const svgX = oldCx - oldW / 2 + cursorFracX * oldW
      const svgY = oldCy - oldH / 2 + cursorFracY * oldH

      const newCx = svgX - (cursorFracX - 0.5) * newW
      const newCy = svgY - (cursorFracY - 0.5) * newH
      const newPanX = newCx - (baseViewBox.x + baseViewBox.w / 2)
      const newPanY = newCy - (baseViewBox.y + baseViewBox.h / 2)

      setZoom(newZoom)
      setPan({ x: newPanX, y: newPanY })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [baseViewBox])

  const dragDistRef = useRef(0)

  function handlePanStart(e: React.MouseEvent) {
    if (e.button === 0 || e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      dragDistRef.current = 0
      setPanStart({ x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y })
    }
  }

  function handlePanMove(e: React.MouseEvent) {
    if (!isPanning || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const scaleX = baseViewBox.w / zoom / rect.width
    const scaleY = baseViewBox.h / zoom / rect.height
    const dx = (e.clientX - panStart.x) * scaleX
    const dy = (e.clientY - panStart.y) * scaleY
    dragDistRef.current = Math.abs(e.clientX - panStart.x) + Math.abs(e.clientY - panStart.y)
    setPan({ x: panStart.panX - dx, y: panStart.panY - dy })
  }

  function handlePanEnd() {
    setIsPanning(false)
  }

  // Map region -> country for quick lookups
  const regionToCountry = useMemo(() => {
    const map = new Map<string, string>()
    for (const [rid, rdef] of Object.entries(HEX_REGIONS)) {
      map.set(rid, rdef.country)
    }
    return map
  }, [])


  // Country labels positioned at centroid of visible tiles
  const countryLabels = useMemo(() => {
    const ROW_MIN = 5, ROW_MAX = 51, COL_MAX = 86
    return Object.entries(HEX_COUNTRIES).map(([cid, cdef]) => {
      const visibleTiles = landTiles.filter(t =>
        t.g && regionToCountry.get(t.g) === cid &&
        t.r >= ROW_MIN && t.r <= ROW_MAX && t.q <= COL_MAX
      )
      if (visibleTiles.length === 0) return null
      const avgQ = visibleTiles.reduce((s, t) => s + t.q, 0) / visibleTiles.length
      const avgR = visibleTiles.reduce((s, t) => s + t.r, 0) / visibleTiles.length
      const [x, y] = hexCenter(Math.round(avgQ), Math.round(avgR))
      return { id: cid, x, y, name: cdef.name, faction: cdef.faction }
    }).filter(Boolean) as { id: string; x: number; y: number; name: string; faction: string }[]
  }, [landTiles, regionToCountry])

  function handleMouseMove(e: React.MouseEvent) {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    handlePanMove(e)
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
    if (dragDistRef.current > 5) return
    setSelectedRegions(prev => {
      const next = new Set(prev)
      if (next.has(tile.g!)) next.delete(tile.g!)
      else next.add(tile.g!)
      return next
    })
  }

  function toggleFilter(key: Exclude<keyof MapFilters, 'colorMode'>) {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="-mx-10 -my-8 h-[calc(100vh-44px)] flex flex-col">
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handlePanStart}
        onMouseUp={handlePanEnd}
        onMouseLeave={() => { handlePanEnd(); handleHexLeave() }}
        className="relative flex-1 w-full overflow-hidden select-none"
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        {/* Controls overlay */}
        <div className="absolute top-2 right-2 z-40 flex flex-col items-end gap-1.5">
          {/* Geo/Country slider */}
          <div className="flex items-center gap-0 bg-[var(--card)]/90 backdrop-blur-sm border border-[var(--border)] rounded-sm overflow-hidden">
            <button
              onClick={() => setFilters(p => ({ ...p, colorMode: 'geography' }))}
              className={`text-[10px] font-bold px-2.5 py-1 transition-colors ${
                filters.colorMode === 'geography' ? 'bg-[var(--accent)] text-[var(--parchment)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >Geo</button>
            <button
              onClick={() => setFilters(p => ({ ...p, colorMode: 'country' }))}
              className={`text-[10px] font-bold px-2.5 py-1 transition-colors ${
                filters.colorMode === 'country' ? 'bg-[var(--accent)] text-[var(--parchment)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >Countries</button>
          </div>
          {/* Filter tags */}
          <div className="flex items-center gap-1">
            {(Object.keys(FILTER_LABELS) as (Exclude<keyof MapFilters, 'colorMode'>)[]).map(key => (
              <button
                key={key}
                onClick={() => toggleFilter(key)}
                className={`text-[9px] px-1.5 py-0.5 rounded-sm border backdrop-blur-sm transition-colors ${
                  filters[key]
                    ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--fg)]'
                    : 'border-[var(--border)] bg-[var(--card)]/70 text-[var(--muted)] hover:border-[var(--fg)]'
                }`}
              >
                {FILTER_LABELS[key]}
              </button>
            ))}
          </div>
          {/* Zoom info */}
          {zoom > 1 && (
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-[var(--muted)] bg-[var(--card)]/90 backdrop-blur-sm border border-[var(--border)] rounded-sm px-1.5 py-0.5">{zoom.toFixed(1)}x</span>
              <button
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
                className="text-[9px] px-1.5 py-0.5 rounded-sm border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
              >Reset</button>
            </div>
          )}
        </div>

        <svg
          viewBox={currentViewBox}
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="heretic-pattern" patternUnits="userSpaceOnUse" width="5" height="5">
              <line x1="0" y1="5" x2="5" y2="0" stroke="rgba(160,0,0,0.4)" strokeWidth="1" />
            </pattern>
          </defs>

          <rect x="-9999" y="-9999" width="99999" height="99999" fill={TERRAIN_COLORS.sea} />

          {/* Hex tiles */}
          {HEX_TILES.map((tile, i) => {
            if (tile.t === 'sea') return null
            const [cx, cy] = hexCenter(tile.q, tile.r)
            const pts = hexPoints(cx, cy)
            const isWallTile = tile.t === 'iron_wall'
            const tileCountry = tile.g ? regionToCountry.get(tile.g) : null

            let displayColor: string
            if (isWallTile) {
              displayColor = TERRAIN_COLORS['iron_wall']
            } else if (filters.colorMode === 'country' && tileCountry) {
              const base = COUNTRY_COLORS[tileCountry] ?? '#666'
              displayColor = tile.g ? variantColor(base, tile.g) : base
            } else {
              displayColor = TERRAIN_COLORS[tile.t] ?? '#555'
            }

            const isCountryHovered = filters.hoverHighlight && tileCountry === hoveredCountry
            const isRegionHovered = filters.hoverHighlight && tile.g === hoveredRegion
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
                fill={displayColor}
                stroke={stroke}
                strokeWidth={strokeW}
                className="cursor-pointer"
                onMouseEnter={() => handleHexEnter(tile)}
                onMouseLeave={handleHexLeave}
                onClick={() => handleHexClick(tile)}
              />
            )
          })}

          {/* Control overlay: stripes for heretic regions */}
          {landTiles.map((tile, i) => {
            if (!tile.g || tile.w) return null
            const regionDef = HEX_REGIONS[tile.g]
            if (!regionDef) return null
            if (regionDef.control !== 'heretic') return null
            const [cx, cy] = hexCenter(tile.q, tile.r)
            const pts = hexPoints(cx, cy)
            return <polygon key={`ctrl-${i}`} points={pts} fill="url(#heretic-pattern)" className="pointer-events-none" />
          })}


          {/* Points of Interest */}
          {filters.pois && HEX_POIS.map(poi => {
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
          {filters.labels && countryLabels.map(label => {
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
        {/* Legend overlay: always visible in geography mode */}
        {filters.colorMode === 'geography' && (
          <div className="absolute bottom-2 left-2 z-40 bg-[var(--card)]/90 backdrop-blur-sm border border-[var(--border)] rounded-sm p-2 max-w-[400px]">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px]">
              {Object.entries(TERRAIN_COLORS).filter(([c]) => c !== 'sea' && c !== 'volcanic').map(([code, color]) => (
                <div key={code} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-[var(--muted)]">{TERRAIN_NAMES[code] ?? code}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
