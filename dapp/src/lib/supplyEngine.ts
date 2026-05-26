import economy from '../data/rules/economy.json'

export interface TileLogistics {
  supply_source: boolean
  demand: number
}

export interface TheatreTile {
  node: { name: string; control: string; type: string }
  logistics: TileLogistics
  buildings: string[]
}

export interface SupplyResult {
  supply_level: number
  incoming_flow: number
  is_connected: boolean
  attackable: boolean
  production: number
}

type Faction = 'faithful' | 'heretic'

const ATTACK_THRESHOLD = 40
const MAX_BUILDINGS_PER_TILE = 4

const NODE_TYPE_TO_TERRAIN: Record<string, string> = {
  coastal: 'coastal',
  port: 'port',
  city: 'city',
  town: 'village',
  battlefield: 'ruins',
  strategic: 'crossroads',
  terrain: 'plains',
  fortification: 'fortress',
}

/**
 * Derive total production score from buildings placed on a tile.
 */
export function getTileProduction(buildings: string[]): number {
  let total = 0
  for (const bid of buildings) {
    const building = economy.buildings.find(b => b.id === bid)
    if (building) {
      total += building.produces.reduce((sum, p) => sum + p.output, 0)
    }
  }
  return total
}

/**
 * Get detailed resource production from buildings.
 */
export function getTileResources(buildings: string[]): { resource: string; output: number }[] {
  const resourceMap: Record<string, number> = {}
  for (const bid of buildings) {
    const building = economy.buildings.find(b => b.id === bid)
    if (building) {
      for (const p of building.produces) {
        resourceMap[p.resource] = (resourceMap[p.resource] || 0) + p.output
      }
    }
  }
  return Object.entries(resourceMap).map(([resource, output]) => ({ resource, output }))
}

/**
 * Get allowed building IDs for a given node type.
 */
export function getAllowedBuildings(nodeType: string): string[] {
  const terrainKey = NODE_TYPE_TO_TERRAIN[nodeType]
  if (!terrainKey) return []
  const mappings = economy.terrain_buildings.mappings as Record<string, string[]>
  return mappings[terrainKey] ?? []
}

/**
 * Check if a building can be added to a tile.
 */
export function canBuild(tile: TheatreTile, buildingId: string): { ok: boolean; reason?: string } {
  if (tile.buildings.length >= MAX_BUILDINGS_PER_TILE) {
    return { ok: false, reason: 'Max buildings reached (4)' }
  }
  const allowed = getAllowedBuildings(tile.node.type)
  if (!allowed.includes(buildingId)) {
    return { ok: false, reason: `Not allowed on ${tile.node.type} tiles` }
  }
  return { ok: true }
}

/**
 * Compute supply levels for all tiles in the theatre.
 * BFS from supply sources along edges filtered by control.
 * Enemy-controlled tiles block flow. Contested tiles pass at 50%.
 */
export function computeSupply(
  tiles: TheatreTile[],
  edges: [number, number][],
  edgeCapacity: number[],
  faction: Faction
): SupplyResult[] {
  const n = tiles.length
  const adj: { to: number; capacity: number }[][] = Array.from({ length: n }, () => [])

  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i]
    const cap = edgeCapacity[i] ?? 3
    adj[a].push({ to: b, capacity: cap })
    adj[b].push({ to: a, capacity: cap })
  }

  const productions = tiles.map(t => getTileProduction(t.buildings))

  const results: SupplyResult[] = tiles.map((_, i) => ({
    supply_level: 0,
    incoming_flow: 0,
    is_connected: false,
    attackable: false,
    production: productions[i],
  }))

  const sources: number[] = []
  for (let i = 0; i < n; i++) {
    const tile = tiles[i]
    if (tile.logistics.supply_source && isFriendly(tile.node.control, faction)) {
      sources.push(i)
    }
  }

  const visited = new Set<number>()
  const queue: { idx: number; flow: number }[] = []

  for (const src of sources) {
    visited.add(src)
    results[src].is_connected = true
    results[src].incoming_flow = productions[src] * 2
    queue.push({ idx: src, flow: productions[src] * 2 })
  }

  while (queue.length > 0) {
    const { idx, flow } = queue.shift()!
    const tile = tiles[idx]

    for (const edge of adj[idx]) {
      if (visited.has(edge.to)) continue
      const target = tiles[edge.to]

      if (isBlocked(target.node.control, faction)) continue

      const efficiency = target.node.control === 'contested' ? 0.5 : 1.0
      const passedFlow = Math.min(flow * 0.7, edge.capacity) * efficiency

      if (passedFlow < 0.5) continue

      visited.add(edge.to)
      results[edge.to].is_connected = true
      results[edge.to].incoming_flow = passedFlow + (tile.logistics.supply_source ? 0 : results[idx].incoming_flow * 0.3)

      queue.push({ idx: edge.to, flow: passedFlow })
    }
  }

  for (let i = 0; i < n; i++) {
    const tile = tiles[i]
    const { demand } = tile.logistics
    const production = productions[i]
    const { incoming_flow, is_connected } = results[i]

    if (!is_connected && !tile.logistics.supply_source) {
      results[i].supply_level = Math.min(100, (production / demand) * 30)
    } else {
      results[i].supply_level = Math.min(100, ((production + incoming_flow) / demand) * 100)
    }

    results[i].attackable =
      results[i].supply_level < ATTACK_THRESHOLD &&
      !isFriendly(tile.node.control, faction)
  }

  return results
}

function isFriendly(control: string, faction: Faction): boolean {
  return control === faction
}

function isBlocked(control: string, faction: Faction): boolean {
  const opposing: Faction = faction === 'faithful' ? 'heretic' : 'faithful'
  return control === opposing
}

/**
 * Get the defender malus based on supply level.
 */
export function getDefenderMalus(supplyLevel: number): { ducatPenalty: number; fieldStrengthPenalty: number; autoSurrender: boolean } {
  if (supplyLevel >= 80) return { ducatPenalty: 0, fieldStrengthPenalty: 0, autoSurrender: false }
  if (supplyLevel >= 40) return { ducatPenalty: 100, fieldStrengthPenalty: 0, autoSurrender: false }
  if (supplyLevel >= 20) return { ducatPenalty: 200, fieldStrengthPenalty: 2, autoSurrender: false }
  return { ducatPenalty: 300, fieldStrengthPenalty: 4, autoSurrender: true }
}
