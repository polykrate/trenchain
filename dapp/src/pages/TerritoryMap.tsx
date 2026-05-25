import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { territory, theatre as theatreChain, storage } from '../chain'
import type { Theatre } from '../chain/theatre'
import type { CampaignLocation, ResourceType } from '../chain/types'
import worldMapData from '../data/rules/world_map.json'
import worldStatusData from '../data/rules/world_status.json'

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

interface Province {
  iso: string
  name: string
  country: string
  terrain: string
  path: string
}

interface RegionDef {
  name: string
  biome: string
  faction: string | null
  corrupted: boolean
  countries: string[]
}

interface RegionStatus {
  faction: string
  control: 'faithful' | 'heretic' | 'contested' | 'neutral'
  note: string
  contested_provinces?: string[]
}

interface FactionDef {
  name: string
  color: string
  description: string
}

const TERRAIN_COLORS: Record<string, { name: string; color: string }> = worldMapData.biomes as Record<string, { name: string; color: string }>
const VIEW_BOX = (worldMapData.meta as { viewBox: string }).viewBox
const REGION_MAP = worldMapData.region_mapping as Record<string, RegionDef>
const PROVINCES = worldMapData.provinces as Province[]
const REGION_STATUS = (worldStatusData as { regions: Record<string, RegionStatus> }).regions
const FACTIONS = (worldStatusData as { factions: Record<string, FactionDef> }).factions

const GREAT_IRON_WALL = "M972.6,603.0L896.8,580.1L846.3,591.6L795.8,603.0L776.8,630.9L770.5,657.9L783.2,689.4L808.4,730.0L821.1,759.7"

function getProvinceControl(province: Province, regionId: string): 'faithful' | 'heretic' | 'contested' | 'neutral' {
  const status = REGION_STATUS[regionId]
  if (!status) return 'neutral'
  if (status.contested_provinces?.some(cp => province.name.toLowerCase().includes(cp.toLowerCase()) || cp.toLowerCase().includes(province.name.toLowerCase()))) {
    return 'contested'
  }
  return status.control
}

function getRegionForCountry(iso: string): { id: string; def: RegionDef } | null {
  for (const [id, def] of Object.entries(REGION_MAP)) {
    if (def.countries.includes(iso)) return { id, def }
  }
  return null
}

interface HoverState {
  province: Province
  regionId: string
  regionDef: RegionDef
}

function WorldMapGrid() {
  const [showControl, setShowControl] = useState(true)
  const [hovered, setHovered] = useState<HoverState | null>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  function handleMouseMove(e: React.MouseEvent) {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  function handleProvinceEnter(province: Province) {
    const region = getRegionForCountry(province.iso)
    if (region) {
      setHovered({ province, regionId: region.id, regionDef: region.def })
    }
  }

  function getControlPattern(province: Province, regionId: string): string | null {
    const provControl = getProvinceControl(province, regionId)
    if (provControl === 'heretic') return 'url(#heretic-pattern)'
    if (provControl === 'contested') return 'url(#contested-pattern)'
    return null
  }

  function isNeutralRegion(regionId: string): boolean {
    const status = REGION_STATUS[regionId]
    return status?.faction === 'NEUTRAL'
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl">The Lands of the Great Powers</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Strategic overview — territories held and lost in the eternal war.</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-sm text-[var(--muted)] uppercase tracking-wider font-bold">War Status</span>
          <div className="relative">
            <input
              type="checkbox"
              checked={showControl}
              onChange={() => setShowControl(!showControl)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 rounded-full bg-[var(--border)] peer-checked:bg-[#7f1d1d] transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[var(--parchment)] peer-checked:translate-x-5 transition-transform shadow" />
          </div>
        </label>
      </div>

      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative w-full border border-[var(--border)] rounded-sm overflow-hidden select-none"
        style={{ aspectRatio: '1200/850' }}
      >
        <svg
          viewBox={VIEW_BOX}
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="contested-pattern" patternUnits="userSpaceOnUse" width="6" height="6">
              <line x1="0" y1="6" x2="6" y2="0" stroke="rgba(200,100,0,0.4)" strokeWidth="1.2" />
            </pattern>
            <pattern id="heretic-pattern" patternUnits="userSpaceOnUse" width="5" height="5">
              <line x1="0" y1="5" x2="5" y2="0" stroke="rgba(160,0,0,0.35)" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Sea background */}
          <rect x="0" y="0" width="1200" height="850" fill={TERRAIN_COLORS.sea?.color ?? '#1e3a5f'} />

          {/* Province paths — colored by terrain, neutral = greyscale */}
          {PROVINCES.map((prov, i) => {
            const region = getRegionForCountry(prov.iso)
            if (!region) return null
            const terrainColor = TERRAIN_COLORS[prov.terrain]?.color ?? '#555'
            const neutral = isNeutralRegion(region.id)
            const isProvinceHovered = hovered?.province === prov
            const isCountryHovered = hovered?.province.iso === prov.iso
            const isRegionHovered = hovered?.regionId === region.id

            return (
              <path
                key={i}
                d={prov.path}
                fill={terrainColor}
                stroke={
                  isProvinceHovered
                    ? '#f4ece1'
                    : isCountryHovered
                      ? 'rgba(244,236,225,0.5)'
                      : isRegionHovered
                        ? 'rgba(244,236,225,0.25)'
                        : 'rgba(50,40,30,0.25)'
                }
                strokeWidth={isProvinceHovered ? 1.5 : isCountryHovered ? 0.7 : 0.2}
                className="cursor-pointer"
                style={{ opacity: isRegionHovered ? 1 : 0.92, filter: neutral ? 'saturate(0.3) brightness(0.85)' : undefined }}
                onMouseEnter={() => handleProvinceEnter(prov)}
                onMouseLeave={() => setHovered(null)}
              />
            )
          })}

          {/* Region borders (red outlines) */}
          {Object.entries(REGION_MAP).map(([regionId, def]) => {
            const regionProvs = PROVINCES.filter(p => def.countries.includes(p.iso))
            if (regionProvs.length === 0) return null
            return (
              <g key={`region-border-${regionId}`} className="pointer-events-none">
                {regionProvs.map((prov, j) => (
                  <path
                    key={j}
                    d={prov.path}
                    fill="none"
                    stroke="rgba(160,30,30,0.7)"
                    strokeWidth="1"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            )
          })}

          {/* Control overlay: stripes only (no background fill) */}
          {showControl && PROVINCES.map((prov, i) => {
            const region = getRegionForCountry(prov.iso)
            if (!region) return null
            const pattern = getControlPattern(prov, region.id)
            if (!pattern) return null
            return <path key={`ctrl-${i}`} d={prov.path} fill={pattern} className="pointer-events-none" />
          })}

          {/* Special landmark: Breach of Córdoba */}
          {showControl && (
            <text
              x={255} y={595}
              textAnchor="middle"
              dominantBaseline="middle"
              className="pointer-events-none select-none"
              style={{ fontSize: '8px', fontWeight: 700, fill: '#fbbf24', stroke: 'rgba(15,0,0,0.85)', strokeWidth: 2.5, paintOrder: 'stroke' }}
            >
              Breach of Córdoba
            </text>
          )}

          {/* Great Iron Wall of Iskandar */}
          <g className="pointer-events-none">
            <path
              d={GREAT_IRON_WALL}
              fill="none"
              stroke="#4a3520"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={GREAT_IRON_WALL}
              fill="none"
              stroke="#8b7355"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="6,3"
            />
            <text x="780" y="645" fontSize="7" fill="#d4a862" fontWeight="700" textAnchor="end" className="select-none" style={{ paintOrder: 'stroke', stroke: 'rgba(20,10,0,0.8)', strokeWidth: 2 }}>
              Iron Wall
            </text>
          </g>

          {/* Region labels — positioned at centroid */}
          {Object.entries(REGION_MAP).map(([regionId, def]) => {
            const regionProvinces = PROVINCES.filter(p => def.countries.includes(p.iso))
            if (regionProvinces.length === 0) return null
            let sumX = 0, sumY = 0, count = 0
            for (const prov of regionProvinces) {
              const nums = prov.path.match(/[\d.]+/g)
              if (!nums || nums.length < 2) continue
              for (let k = 0; k < nums.length - 1; k += 2) {
                sumX += parseFloat(nums[k])
                sumY += parseFloat(nums[k + 1])
                count++
              }
            }
            if (count === 0) return null
            const cx = sumX / count
            const cy = sumY / count
            const status = REGION_STATUS[regionId]
            const isHeretic = status?.control === 'heretic'
            const isContested = status?.control === 'contested'
            const isIslamic = status?.faction === 'FAITHFUL_ISLAMIC'
            const fontSize = def.name.length > 18 ? 9 : def.name.length > 12 ? 11 : 13
            return (
              <text
                key={`label-${regionId}`}
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none select-none"
                style={{
                  fontSize: `${fontSize}px`,
                  fontWeight: 700,
                  fill: isHeretic ? '#fca5a5' : isContested ? '#fbbf24' : isIslamic ? '#e8c860' : '#f4ece1',
                  stroke: isHeretic ? 'rgba(15,0,0,0.85)' : 'rgba(25,20,15,0.75)',
                  strokeWidth: 3,
                  paintOrder: 'stroke',
                  letterSpacing: '0.3px',
                }}
              >
                {def.name}
              </text>
            )
          })}
        </svg>

        {/* Hover tooltip */}
        {hovered && (
          <div
            className="absolute z-50 pointer-events-none w-72 bg-[var(--card)] border border-[var(--sepia)] rounded-sm p-3 shadow-xl"
            style={{
              left: Math.min(mouse.x + 16, (containerRef.current?.clientWidth ?? 400) - 300),
              top: Math.min(mouse.y - 10, (containerRef.current?.clientHeight ?? 300) - 200),
            }}
          >
            <div className="font-bold text-sm text-[var(--fg)]">{hovered.regionDef.name}</div>
            <div className="text-[11px] text-[var(--sepia)] mb-0.5">{hovered.province.country} — {hovered.province.name}</div>
            <div className="flex items-center gap-2 my-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: TERRAIN_COLORS[hovered.province.terrain]?.color }} />
              <span className="text-[10px] text-[var(--muted)]">{TERRAIN_COLORS[hovered.province.terrain]?.name ?? hovered.province.terrain}</span>
            </div>
            {(() => {
              const status = REGION_STATUS[hovered.regionId]
              if (!status) return null
              const provControl = getProvinceControl(hovered.province, hovered.regionId)
              const controlColor = provControl === 'heretic' ? '#f87171' : provControl === 'contested' ? '#fbbf24' : provControl === 'faithful' ? '#86efac' : '#a3a3a3'
              const controlLabel = provControl === 'heretic' ? 'Heretic Dominion' : provControl === 'contested' ? 'Contested' : provControl === 'faithful' ? 'Faithful' : 'Neutral'
              const faction = FACTIONS[status.faction]
              return (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: controlColor }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: controlColor }}>{controlLabel}</span>
                  </div>
                  {faction && <div className="text-[9px] text-[var(--muted)] mb-1">{faction.name}</div>}
                  <p className="text-[9px] text-[var(--muted)] leading-relaxed italic">{status.note}</p>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Legend — belligerent groups */}
      <div className="mt-3 grid grid-cols-3 gap-4 text-xs">
        <div>
          <div className="font-bold text-[var(--fg)] uppercase tracking-wider text-[10px] mb-1 border-b border-blue-800/50 pb-0.5">The Faithful</div>
          {Object.entries(REGION_MAP).filter(([id]) => REGION_STATUS[id]?.faction?.startsWith('FAITHFUL')).map(([id, def]) => (
            <div key={id} className="flex items-center gap-1.5 py-0.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: REGION_STATUS[id]?.faction === 'FAITHFUL_ISLAMIC' ? '#e8c860' : '#86b6dc' }} />
              <span className="text-[var(--muted)]">{def.name}</span>
              {REGION_STATUS[id]?.control === 'contested' && <span className="text-orange-500 text-[9px]">[contested]</span>}
            </div>
          ))}
        </div>
        <div>
          <div className="font-bold text-red-400 uppercase tracking-wider text-[10px] mb-1 border-b border-red-900/50 pb-0.5">Forces of Hell</div>
          {Object.entries(REGION_MAP).filter(([id]) => REGION_STATUS[id]?.faction === 'HERETIC').map(([id, def]) => (
            <div key={id} className="flex items-center gap-1.5 py-0.5">
              <div className="w-2 h-2 rounded-full bg-red-700" />
              <span className="text-[var(--muted)]">{def.name}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="font-bold text-[var(--muted)] uppercase tracking-wider text-[10px] mb-1 border-b border-[var(--border)] pb-0.5">Neutral / Independent</div>
          {Object.entries(REGION_MAP).filter(([id]) => REGION_STATUS[id]?.faction === 'NEUTRAL').map(([id, def]) => (
            <div key={id} className="flex items-center gap-1.5 py-0.5">
              <div className="w-2 h-2 rounded-full bg-stone-500" />
              <span className="text-[var(--muted)]">{def.name}</span>
              {REGION_STATUS[id]?.control === 'contested' && <span className="text-orange-500 text-[9px]">[contested]</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {Object.entries(TERRAIN_COLORS).filter(([c]) => c !== 'sea' && c !== 'volcanic').map(([code, biome]) => (
          <div key={code} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border border-[var(--border)]" style={{ backgroundColor: biome.color }} />
            <span className="text-[var(--muted)]">{biome.name}</span>
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
