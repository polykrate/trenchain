import type { EntryId, ItemId, Recruit, WarbandId } from './types'

/**
 * Stub blockchain calls for pallet-roster.
 */

export async function recruit(
  _warbandId: WarbandId,
  _entryId: EntryId,
  _name: string,
  _items: ItemId[],
): Promise<number> {
  console.log('[stub] recruit', { _warbandId, _entryId, _name, _items })
  return Math.floor(Math.random() * 30)
}

export async function dismiss(
  _warbandId: WarbandId,
  _slot: number,
): Promise<void> {
  console.log('[stub] dismiss', { _warbandId, _slot })
}

export async function getRoster(_warbandId: WarbandId): Promise<Recruit[]> {
  console.log('[stub] getRoster', _warbandId)
  return [
    { entry_id: 'HERETIC_PRIEST', name: 'Brother Marcus', items: ['SWORD_AXE', 'STANDARD_ARMOUR'], skills: [], xp: 4, battle_scars: 0 },
    { entry_id: 'DEATH_COMMANDO', name: 'Pilgrim Ezra', items: ['TRENCH_KNIFE'], skills: [1], xp: 7, battle_scars: 1 },
    { entry_id: 'HERETIC_TROOPER', name: 'Heretic Trooper Kael', items: ['BOLT_ACTION_RIFLE', 'GAS_MASK'], skills: [2, 3], xp: 12, battle_scars: 2 },
  ]
}
