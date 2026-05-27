export type TerrainType =
  | 'port' | 'coastal' | 'fortress' | 'mountain_pass' | 'mountain' | 'forest'
  | 'ruins' | 'factory' | 'city' | 'village' | 'plains' | 'bridge' | 'cathedral'
  | 'marsh' | 'mine' | 'quarry' | 'laboratory' | 'monastery' | 'hellgate'
  | 'crossroads' | 'harbor' | 'encampment';

export type ResourceType = 'ducats' | 'iron' | 'powder' | 'flesh' | 'relics' | 'alchemy' | 'occult';

export interface MapResource {
  type: ResourceType;
  output: number;
}

export interface TheatreNode {
  id: number;
  name: string;
  terrain: TerrainType;
  resources: MapResource[];
  connections: number[];
  position?: { x: number; y: number };
}

export interface TheatreGraph {
  nodes: TheatreNode[];
  edges: { from: number; to: number }[];
}

export interface Theatre {
  id: string;
  name: string;
  description: string;
  region: string;
  status: 'draft' | 'active' | 'concluded';
  graph: TheatreGraph;
  map_cid: string | null;
}

export async function getTheatres(): Promise<Theatre[]> {
  return [];
}

export async function getTheatre(_id: string): Promise<Theatre | null> {
  return null;
}

export async function createTheatre(_data: Partial<Theatre>): Promise<string> {
  return `theatre_${Date.now()}`;
}
