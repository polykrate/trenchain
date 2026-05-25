import type { TerrainType, MapResource } from './types'

export interface TheatreNode {
  id: number
  name: string
  subtitle: string
  description: string
  terrain: TerrainType
  resources: MapResource[]
  position: { x: number; y: number }
}

export interface TheatreGraph {
  nodes: TheatreNode[]
  edges: [number, number][]
}

export interface Theatre {
  id: string
  name: string
  region: string
  description: string
  lore: string
  map_cid: string | null
  graph: TheatreGraph
  status: 'draft' | 'active' | 'concluded'
  created_by: string
}

const MOCK_THEATRES: Theatre[] = [
  {
    id: 'theatre_cordoba',
    name: 'The Breach of Córdoba',
    region: 'Southern Spain',
    description: 'Southern Spain, 1914. The Battle of Córdoba (1910) left the ancient city in ruins — a bloody stalemate.',
    lore: 'The Heretics hold Gibraltar and push north. The Faithful defend from Castille through the Sierra Morena passes. All factions converge on this secondary theatre for resources, relics, and strategic advantage.',
    map_cid: null,
    graph: { nodes: [], edges: [] },
    status: 'active',
    created_by: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  },
  {
    id: 'theatre_jerusalem',
    name: 'Siege of Jerusalem',
    region: 'The Holy Land',
    description: 'The eternal siege of the Holy City. Eight centuries of unending war between Heaven and Hell.',
    lore: 'The Hellgate pulsates beneath the Temple Mount, corrupting all who draw near. The Faithful press inward from their encampments beyond the walls, while the Heretics draw ever more power from the Infernal rift.',
    map_cid: null,
    graph: { nodes: [], edges: [] },
    status: 'active',
    created_by: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  },
]

export async function getTheatres(): Promise<Theatre[]> {
  return MOCK_THEATRES
}

export async function getTheatre(id: string): Promise<Theatre | null> {
  return MOCK_THEATRES.find(t => t.id === id) ?? null
}

export async function createTheatre(theatre: Omit<Theatre, 'id' | 'status' | 'created_by'>): Promise<string> {
  console.log('[stub] createTheatre', theatre)
  return `theatre_${Date.now()}`
}

export async function updateTheatreGraph(id: string, graph: TheatreGraph): Promise<void> {
  console.log('[stub] updateTheatreGraph', id, graph)
}

export async function updateTheatreMapCid(id: string, cid: string): Promise<void> {
  console.log('[stub] updateTheatreMapCid', id, cid)
}

export async function publishTheatre(id: string): Promise<void> {
  console.log('[stub] publishTheatre — status -> active', id)
}
