import type { AccountId, FactionId, PatronId, Warband, WarbandId } from './types'

/**
 * Stub blockchain calls for pallet-warband.
 * Replace with actual dedot/polkadot-api calls when chain is live.
 */

export async function createWarband(
  _faction: FactionId,
  _patron: PatronId,
  _name: string,
): Promise<WarbandId> {
  console.log('[stub] createWarband', { _faction, _patron, _name })
  return Math.floor(Math.random() * 10000)
}

export async function disbandWarband(_warbandId: WarbandId): Promise<void> {
  console.log('[stub] disbandWarband', _warbandId)
}

export async function getWarband(_id: WarbandId): Promise<Warband | null> {
  console.log('[stub] getWarband', _id)
  return {
    id: _id,
    owner: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    faction: 1,
    patron: 1,
    name: 'The Iron Crusaders',
    ducats: 700,
    glory: 0,
    elites: 0,
    roster: [],
  }
}

export async function getOwnedWarbands(_owner: AccountId): Promise<Warband[]> {
  console.log('[stub] getOwnedWarbands', _owner)
  return [
    {
      id: 1,
      owner: _owner,
      faction: 1,
      patron: 1,
      name: 'The Iron Crusaders',
      ducats: 520,
      glory: 3,
      elites: 2,
      roster: [
        { entry_id: 1, name: 'Brother Marcus', items: [1, 3], skills: [], xp: 4, battle_scars: 0 },
        { entry_id: 2, name: 'Pilgrim Ezra', items: [2], skills: [1], xp: 7, battle_scars: 1 },
      ],
    },
  ]
}
