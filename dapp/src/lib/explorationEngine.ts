import type { ExplorationRulesData, ChainExplorationEvent, ChainExplorationSkill } from '../hooks/useChainRules';

export type TableTier = 'common' | 'rare' | 'legendary'

export interface ExplorationLocation {
  roll: number
  name: string
  description: string
  options: { id: string; name: string; factions: string[]; effect: string; grantsSkill?: string }[]
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

export function getExplorationDiceCount(rules: ExplorationRulesData, gamesPlayed: number, skills: string[]): number {
  const progression = rules.diceProgression.find(
    p => gamesPlayed >= p.gamesMin && gamesPlayed <= p.gamesMax
  )
  let dice = progression?.dice ?? 3
  const extraDiceCount = skills.filter(s => s === 'extra_dice').length
  dice += extraDiceCount
  return dice
}

export function getMaxRerolls(rules: ExplorationRulesData, wonGame: boolean, skills: string[]): number {
  let rerolls = rules.rerollsBase
  if (wonGame) rerolls += rules.rerollsBonusIfWon
  const extraRerolls = skills.filter(s => s === 'reroll').length
  rerolls += extraRerolls
  return rerolls
}

export function getAvailableTables(rules: ExplorationRulesData, gamesPlayed: number): TableTier[] {
  const progression = rules.tableProgression.find(
    p => gamesPlayed >= p.gamesMin && gamesPlayed <= p.gamesMax
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

export function applyLucky(dice: number[], _targetIndex: number): { dice: number[]; newDie: number } {
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

export function lookupDiscovery(rules: ExplorationRulesData, total: number, table: TableTier): ExplorationLocation | null {
  const event = rules.events.find(e => e.table === table && e.roll === total)
  if (!event) return null
  return {
    roll: event.roll,
    name: event.name,
    description: event.description,
    options: event.options,
  }
}

export function computeLoot(rules: ExplorationRulesData, total: number, permanentBonus: number = 0): number {
  return total * rules.lootMultiplier + permanentBonus
}

export function getExplorationSkills(rules: ExplorationRulesData): ChainExplorationSkill[] {
  return rules.skills
}

export function getTableEntries(rules: ExplorationRulesData, table: TableTier): ExplorationLocation[] {
  return rules.events
    .filter(e => e.table === table)
    .map(e => ({
      roll: e.roll,
      name: e.name,
      description: e.description,
      options: e.options,
    }))
    .sort((a, b) => a.roll - b.roll)
}
