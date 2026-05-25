import type { Faction, FactionId, Patron } from './types'

/**
 * Stub blockchain calls for pallet-faction and pallet-patron.
 */

export async function getFactions(): Promise<Faction[]> {
  console.log('[stub] getFactions')
  return MOCK_FACTIONS
}

export async function getFaction(_id: FactionId): Promise<Faction | null> {
  return MOCK_FACTIONS.find(f => f.id === _id) ?? null
}

export async function getPatrons(): Promise<Patron[]> {
  console.log('[stub] getPatrons')
  return MOCK_PATRONS
}

export async function getPatronsForFaction(_factionId: FactionId): Promise<Patron[]> {
  return MOCK_PATRONS.filter(p => p.factions.includes(_factionId))
}

const MOCK_FACTIONS: Faction[] = [
  { id: 1, name: 'Heretic Legions', alignment: 'Fallen' },
  { id: 2, name: 'Trench Pilgrims', alignment: 'Faithful' },
  { id: 3, name: 'New Antioch', alignment: 'Faithful' },
  { id: 4, name: 'Iron Sultanate', alignment: 'Faithful' },
  { id: 5, name: 'Court of the Seven-Headed Serpent', alignment: 'Fallen' },
  { id: 6, name: 'Cult of the Black Grail', alignment: 'Fallen' },
]

const MOCK_PATRONS: Patron[] = [
  { id: 1, code: 'TEMPORAL_LORD', name: 'Temporal Lord', description: 'A powerful noble or military officer.', factions: [3], skills: [1, 2, 3, 4, 5, 6] },
  { id: 2, code: 'WARRIOR_SAINT', name: 'Warrior Saint', description: 'A canonized warrior like Joan of Arc.', factions: [2, 3], skills: [7, 8, 9, 10, 11, 12] },
  { id: 3, code: 'LEARNED_SAINT', name: 'Learned Saint', description: 'A great teacher and strategist.', factions: [2, 3], skills: [13, 14, 15, 16, 17, 18] },
  { id: 4, code: 'INFERNAL_NOBLE', name: 'Infernal Noble', description: 'A mighty devil noble.', factions: [1, 5], skills: [19, 20, 21, 22, 23, 24] },
  { id: 5, code: 'SUBLIME_GATE', name: 'Sublime Gate', description: 'A high-ranking noble of the Sultanate.', factions: [4], skills: [25, 26, 27, 28, 29, 30] },
  { id: 6, code: 'ORDER_OF_THE_FLY', name: 'Order of the Fly', description: 'Servants of Beelzebub.', factions: [6], skills: [31, 32, 33, 34, 35, 36] },
  { id: 7, code: 'MAMMON', name: 'Mammon', description: 'The Prince of Greed.', factions: [1, 5], skills: [37, 38, 39, 40, 41, 42] },
  { id: 8, code: 'ANTIPOPE', name: 'The Antipope of Avignon', description: 'High priest of the Cult.', factions: [6], skills: [43, 44, 45, 46, 47, 48] },
]
