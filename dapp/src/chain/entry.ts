import type { EntryId, FactionId, WarbandEntry } from './types'

export async function getEntry(_id: EntryId): Promise<WarbandEntry | null> {
  return MOCK_ENTRIES.find(e => e.id === _id) ?? null
}

export async function getEntriesByFaction(_faction: FactionId): Promise<WarbandEntry[]> {
  return MOCK_ENTRIES.filter(e => e.faction === _faction)
}

export const MOCK_ENTRIES: WarbandEntry[] = [
  {
    id: 1,
    name: 'Heretic Priest',
    faction: 1,
    min_count: 1,
    max_count: 1,
    cost: 80,
    profile: { movement_inches: 6, movement_type: 'Infantry', ranged: 2, melee: 2, armour: 0, base: { type: 'round', diameter_mm: 32 } },
    keywords: [38, 28, 47, 75],
    description: 'Fallen Priests wielding unholy magics, summoning demons through Goetic spells.',
    lore: 'These fallen Priests wield unholy magics, summoning petrifying demons and creatures through their Goetic spells. Often pledged to a demon lord in Hell, such as Pazuzu or Guison, the profane gospels they recite strike fear into Church forces, causing ears to bleed and eyeballs to burst in their sockets.',
    composition_note: 'A Heretic Legions Warband must include 1 Heretic Priest.',
    battlekit_rules: 'A Heretic Priest can have any Battlekit from the Heretic Legions Armoury Tables.',
    abilities: [
      {
        name: 'Puppet Master ACTION',
        description: 'A Heretic Priest can take a Puppet Master ACTION. If they do so, take a Risky Success Roll for the model. If the roll is a Failure, the Heretic Priest\'s Activation ends immediately. If the roll is a Success or Critical Success, pick 1 model (friend or foe) that is within 12" of the Heretic Priest and in their Line of Sight, apart from the Heretic Priest themselves. You can move the model D6". The move must be in a straight line, but can be in any direction, and can be used to make the model move within 1" of an enemy, make a retreat move, Climb, Jump, or Jump Down. The model cannot make a Diving Charge and does not count as charging if it finishes the move within 1" of an enemy model.',
      },
    ],
  },
  {
    id: 2,
    name: 'Heretic Trooper',
    faction: 1,
    min_count: 0,
    max_count: null,
    cost: 30,
    profile: { movement_inches: 6, movement_type: 'Infantry', ranged: 0, melee: 0, armour: 0, base: { type: 'round', diameter_mm: 25 } },
    keywords: [38],
    description: 'Battle-hardened soldiers who passed through the Gate of Hell.',
    lore: 'Countless humans have pledged themselves to the Heretic cause: desperate, greedy or power-hungry mortals who have sold their souls for earthly gain. Although often poorly equipped, their sheer numbers make them a threat, and many have been transformed by their exposure to Hell into savage warriors beyond mortal limits.',
    composition_note: 'A Heretic Legions Warband can include any number of Heretic Troopers.',
    battlekit_rules: 'A Heretic Trooper can have any Battlekit from the Heretic Legions Armoury Tables.',
    abilities: [],
  },
  {
    id: 3,
    name: 'Chorister',
    faction: 1,
    min_count: 0,
    max_count: 1,
    cost: 65,
    profile: { movement_inches: 6, movement_type: 'Infantry', ranged: -2, melee: 2, armour: 0, base: { type: 'round', diameter_mm: 32 } },
    keywords: [38, 28, 29],
    description: 'Their unholy hymns sap the strength and resolve of all who hear.',
    lore: 'Choristers are infernal bards who sing the praises of the Lords of Hell in a language that predates human civilization. Their unholy hymns sap the strength and resolve of all who hear, causing crippling despair and hallucinations. Many soldiers report hearing the sound of children crying or their dead mothers calling to them when a Chorister begins its cacophony.',
    composition_note: 'A Heretic Legions Warband can include up to 1 Chorister.',
    battlekit_rules: 'A Chorister can have any Battlekit from the Heretic Legions Armoury Tables.',
    abilities: [
      {
        name: 'Cacophony ACTION',
        description: 'A Chorister can take a Cacophony ACTION. If they do so, take a Risky Success Roll for the model. If the roll is a Failure, the Chorister\'s Activation ends immediately. If the roll is a Success or Critical Success, pick 1 enemy model that is within 12" of the Chorister and in their Line of Sight. That enemy model loses 1 ACTION from its next Activation.',
      },
    ],
  },
  {
    id: 4,
    name: 'Trench Pilgrim',
    faction: 2,
    min_count: 0,
    max_count: null,
    cost: 25,
    profile: { movement_inches: 6, movement_type: 'Infantry', ranged: 0, melee: 0, armour: 0, base: { type: 'round', diameter_mm: 25 } },
    keywords: [60],
    description: 'Faithful souls who march to war with nothing but devotion.',
    lore: 'Trench Pilgrims are the great masses of faithful who have taken up arms against the forces of Hell. They are peasants, workers, farmers and clergy who have abandoned their former lives in answer to the call of the Church. Armed with little more than improvised weapons and burning faith, they march in enormous numbers towards the enemy trenches.',
    composition_note: 'A Trench Pilgrims Warband can include any number of Trench Pilgrims.',
    battlekit_rules: 'A Trench Pilgrim can have any Battlekit from the Trench Pilgrims Armoury Tables.',
    abilities: [
      {
        name: 'Martyr',
        description: 'When a friendly Trench Pilgrim model is taken Out of Action within 4" of another friendly model, you can place 1 BLESSING MARKER next to the closest friendly model.',
      },
    ],
  },
  {
    id: 5,
    name: 'Communicant',
    faction: 2,
    min_count: 1,
    max_count: 1,
    cost: 70,
    profile: { movement_inches: 6, movement_type: 'Infantry', ranged: 1, melee: 1, armour: 1, base: { type: 'round', diameter_mm: 32 } },
    keywords: [60, 28, 47],
    description: 'A warrior-priest who leads the faithful into battle.',
    lore: 'Communicants are the warrior-priests who lead the Trench Pilgrims. Having received communion directly from a Cardinal or Bishop, they are imbued with a measure of divine grace that manifests as supernatural resilience and combat prowess. They carry holy relics and blessed weapons, inspiring the faithful to ever greater acts of sacrifice.',
    composition_note: 'A Trench Pilgrims Warband must include 1 Communicant.',
    battlekit_rules: 'A Communicant can have any Battlekit from the Trench Pilgrims Armoury Tables.',
    abilities: [
      {
        name: 'Divine Communion ACTION',
        description: 'A Communicant can take a Divine Communion ACTION. If they do so, take a Risky Success Roll for the model. If the roll is a Failure, the Communicant\'s Activation ends immediately. If the roll is a Success or Critical Success, place 1 BLESSING MARKER next to each friendly model within 4" of the Communicant (including the Communicant).',
      },
      {
        name: 'Inspiring Presence',
        description: 'Friendly models within 6" of a Communicant can use the Communicant\'s Morale Characteristic instead of their own when taking Morale Checks.',
      },
    ],
  },
  {
    id: 6,
    name: 'Anointed',
    faction: 2,
    min_count: 0,
    max_count: 2,
    cost: 100,
    profile: { movement_inches: 6, movement_type: 'Infantry', ranged: 1, melee: 2, armour: 1, base: { type: 'round', diameter_mm: 32 } },
    keywords: [60, 28, 72, 75],
    description: 'Elite warriors blessed with supernatural strength and endurance.',
    lore: 'The Anointed are the elite warriors of the Trench Pilgrims, blessed by the Church with sacred oils and holy water that grant them supernatural strength. They are often former soldiers or knights who have taken a vow of poverty and service. In battle, they wield massive two-handed weapons with ease and can withstand wounds that would fell lesser men.',
    composition_note: 'A Trench Pilgrims Warband can include up to 2 Anointed.',
    battlekit_rules: 'An Anointed can have any Battlekit from the Trench Pilgrims Armoury Tables.',
    abilities: [
      {
        name: 'Zealous Charge',
        description: 'When an Anointed makes a Charge, add +1 INJURY DICE to the Injury Roll for the first Melee Attack it makes during that Activation.',
      },
    ],
  },
  {
    id: 7,
    name: 'Man-at-Arms',
    faction: 3,
    min_count: 0,
    max_count: null,
    cost: 45,
    profile: { movement_inches: 6, movement_type: 'Infantry', ranged: 1, melee: 1, armour: 1, base: { type: 'round', diameter_mm: 25 } },
    keywords: [59],
    description: 'Professional soldiers of New Antioch, well-trained and well-equipped.',
    lore: 'The Men-at-Arms form the backbone of New Antioch\'s professional military. Unlike the zealous but poorly trained Pilgrims, these are career soldiers who have trained in the art of war since childhood. They are equipped with the finest arms and armour that the Principality can produce, and their discipline in battle is legendary.',
    composition_note: 'A New Antioch Warband can include any number of Men-at-Arms.',
    battlekit_rules: 'A Man-at-Arms can have any Battlekit from the New Antioch Armoury Tables.',
    abilities: [
      {
        name: 'Fireteam',
        description: 'Men-at-Arms can form Fireteams. You can Activate friendly models that are part of the same Fireteam simultaneously.',
      },
    ],
  },
  {
    id: 8,
    name: 'Knight-Commander',
    faction: 3,
    min_count: 1,
    max_count: 1,
    cost: 120,
    profile: { movement_inches: 6, movement_type: 'Infantry', ranged: 2, melee: 3, armour: 2, base: { type: 'round', diameter_mm: 32 } },
    keywords: [59, 28, 47, 75],
    description: 'The supreme military commander, a living legend on the battlefield.',
    lore: 'Knight-Commanders are the greatest warriors of New Antioch, veterans of countless battles against the forces of Hell. Their martial skill is unmatched among mortal men, and their mere presence on the battlefield inspires their troops to feats of extraordinary valor. They wear master-crafted suits of reinforced armour and wield the finest weapons in Christendom.',
    composition_note: 'A New Antioch Warband must include 1 Knight-Commander.',
    battlekit_rules: 'A Knight-Commander can have any Battlekit from the New Antioch Armoury Tables.',
    abilities: [
      {
        name: 'Tactical Genius',
        description: 'Once per game, after both players have deployed, you can pick up to 2 friendly models and redeploy them anywhere in your deployment zone.',
      },
      {
        name: 'Inspiring Command',
        description: 'Add +1 DICE to Morale Checks while this model is on the battlefield and not Down.',
      },
    ],
  },
]
