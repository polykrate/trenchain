import type { CampaignLocation, LeaderboardEntry, MatchResult, Tournament, WarbandId } from './types'

// ── Tier 2: Match & Leaderboard ────────────────────────────────────

export async function reportMatch(_a: WarbandId, _b: WarbandId, _winner: WarbandId | null): Promise<string> {
  return `match_${Date.now()}`
}

export async function getMatchHistory(_warbandId: WarbandId): Promise<MatchResult[]> {
  return [
    { id: 'match_001', warband_a: _warbandId, warband_b: 42, winner: _warbandId, glory_a: 2, glory_b: 1, timestamp: Date.now() - 86400000 },
    { id: 'match_002', warband_a: 15, warband_b: _warbandId, winner: 15, glory_a: 3, glory_b: 1, timestamp: Date.now() - 172800000 },
  ]
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return [
    { warband_id: 1, warband_name: 'The Iron Crusaders', faction: 3, glory: 12, wins: 5, losses: 1 },
    { warband_id: 2, warband_name: 'Beelzebub\'s Chosen', faction: 6, glory: 10, wins: 4, losses: 2 },
    { warband_id: 3, warband_name: 'Mammon\'s Greed', faction: 1, glory: 8, wins: 3, losses: 2 },
    { warband_id: 4, warband_name: 'Pilgrims of Wrath', faction: 2, glory: 7, wins: 3, losses: 3 },
    { warband_id: 5, warband_name: 'Sultan\'s Fist', faction: 4, glory: 6, wins: 2, losses: 1 },
  ]
}

// ── Tier 2: Tournaments ────────────────────────────────────────────

export async function getTournaments(): Promise<Tournament[]> {
  return [{
    id: 'tourney_001',
    name: 'Siege of Jerusalem — Season 1',
    status: 'in_progress',
    participants: [1, 2, 3, 4, 5, 6, 7, 8],
    rounds: [
      { round_number: 1, matches: [
        { warband_a: 1, warband_b: 8, winner: 1 },
        { warband_a: 2, warband_b: 7, winner: 2 },
        { warband_a: 3, warband_b: 6, winner: 3 },
        { warband_a: 4, warband_b: 5, winner: 4 },
      ]},
      { round_number: 2, matches: [
        { warband_a: 1, warband_b: 4, winner: null },
        { warband_a: 2, warband_b: 3, winner: null },
      ]},
    ],
  }]
}

export async function registerForTournament(_t: string, _w: WarbandId): Promise<void> {}

// ── Tier 3: Territory — The Breach of Córdoba ──────────────────────
//
// Southern Spain, 1914. The Battle of Córdoba (1910) left the ancient city
// in ruins — a bloody stalemate. The Heretics hold Gibraltar and push north.
// The Faithful defend from Castille through the Sierra Morena passes.
// All factions converge on this secondary theatre for resources, relics,
// and strategic advantage.
//
// ENTRY POINTS:
// - NORTH: Sierra Morena Pass (Despeñaperros) — Faithful supply from Castille
// - SOUTH: Gibraltar — Heretic Fleet supply from the sea

export async function getCampaignMap(): Promise<CampaignLocation[]> {
  return CORDOBA_MAP
}

export async function attackLocation(_loc: number, _w: WarbandId): Promise<{ success: boolean; message: string }> {
  return { success: true, message: 'Battle initiated. Report match result to resolve.' }
}

// ─────────────────────────────────────────────────────────────────────
// THE BREACH OF CÓRDOBA — 25 locations
// ─────────────────────────────────────────────────────────────────────

const CORDOBA_MAP: CampaignLocation[] = [
  // ═══ SOUTH — Heretic entry ═══
  {
    id: 0,
    name: 'Gibraltar',
    subtitle: 'Heretic Sea Fortress (SOUTH ENTRY)',
    description: 'The Rock. Captured in 1666, it serves as the Heretic Fleet\'s base of operations. Southern entry point — infernal supply flows from here.',
    terrain: 'fortress',
    resources: [{ type: 'iron', output: 3 }, { type: 'powder', output: 2 }, { type: 'occult', output: 2 }],
    connections: [1, 2],
    position: { x: 39.8, y: 92.2 },
  },
  {
    id: 1,
    name: 'Algeciras',
    subtitle: 'Contested port',
    description: 'Industrial port facing Gibraltar. First foothold inland — controls naval resupply and the roads north.',
    terrain: 'port',
    resources: [{ type: 'ducats', output: 3 }, { type: 'iron', output: 2 }, { type: 'flesh', output: 2 }],
    connections: [0, 3, 4],
    position: { x: 30.1, y: 89.6 },
  },
  {
    id: 2,
    name: 'Málaga',
    subtitle: 'Ruined coastal city',
    description: 'Once a prosperous port, shelled to rubble. Refugees crowd the ruins. Gateway to the eastern coast road.',
    terrain: 'ruins',
    resources: [{ type: 'flesh', output: 4 }, { type: 'ducats', output: 2 }, { type: 'iron', output: 1 }],
    connections: [0, 5, 19],
    position: { x: 59.5, y: 74.9 },
  },
  // ═══ TIER 2 — Southern inland ═══
  {
    id: 3,
    name: 'Jerez',
    subtitle: 'Staging ground',
    description: 'Wealthy wine town turned military staging area. Bodegas converted to barracks. Links the coast to the western interior via the Guadalquivir.',
    terrain: 'city',
    resources: [{ type: 'ducats', output: 3 }, { type: 'flesh', output: 2 }, { type: 'powder', output: 1 }],
    connections: [1, 6],
    position: { x: 28.1, y: 71.3 },
  },
  {
    id: 4,
    name: 'Ronda',
    subtitle: 'Clifftop fortress',
    description: 'City split by a 100m gorge. The Puente Nuevo bridge is the only crossing — mountain roads radiate to Seville, Antequera, and the coast.',
    terrain: 'fortress',
    resources: [{ type: 'iron', output: 3 }, { type: 'relics', output: 2 }],
    connections: [1, 5, 6],
    position: { x: 46.9, y: 71.3 },
  },
  {
    id: 5,
    name: 'Antequera',
    subtitle: 'Southern crossroads',
    description: 'Geographic center of Andalusia. The A-92 highway passes through — connecting coast, mountains, and the road to Carmona.',
    terrain: 'city',
    resources: [{ type: 'ducats', output: 2 }, { type: 'flesh', output: 2 }, { type: 'powder', output: 1 }],
    connections: [2, 4, 7],
    position: { x: 53.4, y: 66.2 },
  },
  // ═══ TIER 3 — Mid contested zone ═══
  {
    id: 6,
    name: 'Seville',
    subtitle: 'Western major city',
    description: 'The great city on the Guadalquivir. The Giralda tower serves as a command post. Hub connecting the western flank to the river road north.',
    terrain: 'city',
    resources: [{ type: 'ducats', output: 4 }, { type: 'flesh', output: 3 }, { type: 'relics', output: 2 }],
    connections: [3, 4, 7, 9, 10],
    position: { x: 29.1, y: 50.5 },
  },
  {
    id: 7,
    name: 'Carmona',
    subtitle: 'Central chokepoint',
    description: 'Ancient Alcázar on a ridge. THE contested crossroads — roads from Seville, Antequera, and the south converge here before Córdoba.',
    terrain: 'fortress',
    resources: [{ type: 'iron', output: 2 }, { type: 'flesh', output: 2 }, { type: 'powder', output: 2 }],
    connections: [5, 6, 11],
    position: { x: 44.3, y: 54.1 },
  },
  {
    id: 8,
    name: 'Lucena',
    subtitle: 'Plague-ridden eastern hub',
    description: 'Walled town ravaged by the Black Grail\'s pestilence. Controls the mountain roads between Loja, Granada, and Montilla.',
    terrain: 'village',
    resources: [{ type: 'occult', output: 3 }, { type: 'alchemy', output: 4 }, { type: 'flesh', output: 2 }],
    connections: [12, 13, 18],
    position: { x: 81.7, y: 34.8 },
  },
  {
    id: 9,
    name: 'Doñana Marshes',
    subtitle: 'Treacherous dead-end',
    description: 'Toxic wetlands on the Atlantic coast. Rich in alchemical reagents and occult energy, but only accessible from Jerez. Ambushes are common.',
    terrain: 'marsh',
    resources: [{ type: 'alchemy', output: 4 }, { type: 'occult', output: 3 }],
    connections: [6],
    position: { x: 14.6, y: 57 },
  },
  // ═══ TIER 4 — Approaching objective ═══
  {
    id: 10,
    name: 'Écija',
    subtitle: 'Sun-scorched plains',
    description: 'The "frying pan of Andalusia." Open killing field along the Guadalquivir. The river road from Seville to Medina Azahara.',
    terrain: 'plains',
    resources: [{ type: 'flesh', output: 2 }, { type: 'ducats', output: 2 }],
    connections: [6, 15],
    position: { x: 28.6, y: 36 },
  },
  {
    id: 11,
    name: 'Mezquita-Cathedral',
    subtitle: 'Holy / unholy site',
    description: 'The great mosque-cathedral on the road to Córdoba. Sacred to both sides. Unmatched spiritual power — and a crossroad to Montilla.',
    terrain: 'cathedral',
    resources: [{ type: 'relics', output: 5 }, { type: 'occult', output: 3 }],
    connections: [7, 12, 14],
    position: { x: 55.7, y: 49.2 },
  },
  {
    id: 12,
    name: 'Montilla',
    subtitle: 'Eastern crossroad hub',
    description: 'Hill town at the junction of roads from Lucena, Mezquita, Córdoba, and Jaén. Whoever controls Montilla controls the entire eastern theatre.',
    terrain: 'village',
    resources: [{ type: 'ducats', output: 3 }, { type: 'powder', output: 3 }, { type: 'iron', output: 2 }],
    connections: [8, 11, 14, 16],
    position: { x: 64.2, y: 46.6 },
  },
  {
    id: 13,
    name: 'Granada / Alhambra',
    subtitle: 'Ancient palace-fortress (dead-end)',
    description: 'The red fortress of the Nasrids. A wonder of the world — military strongpoint and trove of arcane knowledge. Extremely rich but isolated.',
    terrain: 'fortress',
    resources: [{ type: 'relics', output: 4 }, { type: 'occult', output: 3 }, { type: 'alchemy', output: 3 }, { type: 'ducats', output: 2 }],
    connections: [8],
    position: { x: 90.9, y: 26.3 },
  },
  // ═══ TIER 5 — Objective ═══
  {
    id: 14,
    name: 'Córdoba',
    subtitle: 'Devastated main objective',
    description: 'The ancient city in ruins after the 1910 bombardment. Strategic heart of the theatre — whoever holds Córdoba controls Andalusia.',
    terrain: 'ruins',
    resources: [{ type: 'ducats', output: 3 }, { type: 'relics', output: 3 }, { type: 'iron', output: 2 }, { type: 'flesh', output: 2 }],
    connections: [11, 12, 15],
    position: { x: 51.8, y: 38.2 },
  },
  // ═══ NORTH — Faithful entry ═══
  {
    id: 15,
    name: 'Medina Azahara',
    subtitle: 'Arcane ruins (north-west gateway)',
    description: 'Ruins of the 10th-century caliphal palace. Occult energies linger. The western road from Sierra Morena descends through here to Córdoba.',
    terrain: 'ruins',
    resources: [{ type: 'occult', output: 4 }, { type: 'alchemy', output: 3 }, { type: 'relics', output: 2 }],
    connections: [10, 14, 17],
    position: { x: 36.6, y: 31.4 },
  },
  {
    id: 16,
    name: 'Jaén',
    subtitle: 'Faithful forward base',
    description: 'Fortress-city controlling the northern approaches. Main Faithful military HQ — the eastern road from Sierra Morena passes through here.',
    terrain: 'fortress',
    resources: [{ type: 'iron', output: 3 }, { type: 'flesh', output: 3 }, { type: 'ducats', output: 2 }],
    connections: [12, 17],
    position: { x: 67.6, y: 23.4 },
  },
  {
    id: 17,
    name: 'Sierra Morena Pass',
    subtitle: 'Faithful supply entry (NORTH ENTRY)',
    description: 'Despeñaperros gorge — the only route through the mountains from Castille. Northern entry point splits to Medina Azahara (west) and Jaén (east).',
    terrain: 'mountain_pass',
    resources: [{ type: 'iron', output: 2 }, { type: 'ducats', output: 2 }, { type: 'flesh', output: 2 }],
    connections: [15, 16],
    position: { x: 51.3, y: 25.9 },
  },
  // ═══ SOUTH-EAST — Eastern coast & mountains ═══
  {
    id: 18,
    name: 'Loja',
    subtitle: 'Mountain gateway',
    description: 'Fortress town controlling the mountain pass between the coast and Lucena. Steep terrain makes it easily defensible.',
    terrain: 'mountain_pass',
    resources: [{ type: 'iron', output: 2 }, { type: 'flesh', output: 2 }, { type: 'alchemy', output: 1 }],
    connections: [8, 19],
    position: { x: 82.2, y: 54.9 },
  },
  {
    id: 19,
    name: 'Vélez-Málaga',
    subtitle: 'Coastal watchtower',
    description: 'Fortified town on the eastern coast road from Málaga. Controls the ascent into the mountains toward Loja.',
    terrain: 'coastal',
    resources: [{ type: 'ducats', output: 2 }, { type: 'flesh', output: 2 }],
    connections: [2, 18],
    position: { x: 78, y: 73.7 },
  },
]
