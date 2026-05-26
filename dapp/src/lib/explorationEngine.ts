import explorationData from '../data/rules/exploration.json'

export type TableTier = 'common' | 'rare' | 'legendary'

export interface ExplorationSkill {
  id: string
  name: string
  effect: string
  timing: 'before_roll' | 'after_roll' | 'after_modify'
}

export interface ExplorationOption {
  id: string
  name: string
  factions: string[]
  effect: string
}

export interface ExplorationLocation {
  roll: number
  name: string
  description: string
  options: ExplorationOption[]
  grants_skill?: string
  permanent_bonus?: Record<string, number>
}

export interface DiceState {
  values: number[]
  locked: boolean[]
  rerolls_used: number
  max_rerolls: number
}

export interface ExplorationResult {
  dice: number[]
  total: number
  modifiers: number
  final_total: number
  table_used: TableTier
  discovery: ExplorationLocation | null
  loot: number
}

function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1
}

export function getExplorationDiceCount(gamesPlayed: number, skills: string[]): number {
  const progression = explorationData.dice_progression.find(
    p => gamesPlayed >= p.games_min && gamesPlayed <= p.games_max
  )
  let dice = progression?.dice ?? 3
  const extraDiceCount = skills.filter(s => s === 'extra_dice').length
  dice += extraDiceCount
  return dice
}

export function getMaxRerolls(wonGame: boolean, skills: string[]): number {
  let rerolls = explorationData.rerolls.base
  if (wonGame) rerolls += explorationData.rerolls.bonus_if_won
  const extraRerolls = skills.filter(s => s === 'reroll').length
  rerolls += extraRerolls
  return rerolls
}

export function getAvailableTables(gamesPlayed: number): TableTier[] {
  const progression = explorationData.table_progression.find(
    p => gamesPlayed >= p.games_min && gamesPlayed <= p.games_max
  )
  return (progression?.tables ?? ['common']) as TableTier[]
}

export function rollExplorationDice(count: number): number[] {
  return Array.from({ length: count }, () => rollD6())
}

export function rerollDie(dice: number[], index: number): number[] {
  const result = [...dice]
  result[index] = rollD6()
  return result
}

export function applyDuplicate(dice: number[], sourceIndex: number): number[] {
  return [...dice, dice[sourceIndex]]
}

export function applySetDice(dice: number[], index: number, value: number): number[] {
  const result = [...dice]
  result[index] = Math.max(1, Math.min(6, value))
  return result
}

export function applyLucky(dice: number[], targetIndex: number): { dice: number[]; newDie: number } {
  const newDie = rollD6()
  const result = [...dice]
  return { dice: result, newDie }
}

export function confirmLucky(dice: number[], targetIndex: number, keepOriginal: boolean, newDie: number): number[] {
  if (keepOriginal) return dice
  const result = [...dice]
  result[targetIndex] = newDie
  return result
}

export function computeTotal(dice: number[]): number {
  return dice.reduce((sum, d) => sum + d, 0)
}

export function applyModifiers(total: number, skills: string[]): number {
  let mod = total
  const seekCount = skills.filter(s => s === 'seek').length
  const circleBackCount = skills.filter(s => s === 'circle_back').length
  mod += seekCount
  mod -= circleBackCount
  return mod
}

export function lookupDiscovery(total: number, table: TableTier): ExplorationLocation | null {
  const tableEntries = explorationData.tables[table] as ExplorationLocation[]
  if (!tableEntries) return null
  const found = tableEntries.find(entry => entry.roll === total)
  return found ?? null
}

export function computeLoot(total: number, permanentBonus: number = 0): number {
  return total * explorationData.loot_formula.multiplier + permanentBonus
}

export function performFullExploration(
  gamesPlayed: number,
  wonGame: boolean,
  skills: string[],
  chosenTable: TableTier,
  permanentLootBonus: number = 0
): ExplorationResult {
  const diceCount = getExplorationDiceCount(gamesPlayed, skills)
  const dice = rollExplorationDice(diceCount)
  const total = computeTotal(dice)
  const modifiedTotal = applyModifiers(total, skills)
  const discovery = lookupDiscovery(modifiedTotal, chosenTable)
  const loot = computeLoot(modifiedTotal, permanentLootBonus)

  return {
    dice,
    total,
    modifiers: modifiedTotal - total,
    final_total: modifiedTotal,
    table_used: chosenTable,
    discovery,
    loot,
  }
}

export function getExplorationSkills(): ExplorationSkill[] {
  return explorationData.exploration_skills as ExplorationSkill[]
}

export function getTableEntries(table: TableTier): ExplorationLocation[] {
  return (explorationData.tables[table] ?? []) as ExplorationLocation[]
}
