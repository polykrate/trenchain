import { useState, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Stepper } from '../components/Stepper'
import campaignRules from '../data/rules/campaign_rules.json'
import {
  getExplorationDiceCount,
  getMaxRerolls,
  getAvailableTables,
  rollExplorationDice,
  rerollDie,
  applyDuplicate,
  applySetDice,
  applyLucky,
  confirmLucky,
  computeTotal,
  applyModifiers,
  lookupDiscovery,
  computeLoot,
  getExplorationSkills,
  getTableEntries,
} from '../lib/explorationEngine'
import type { TableTier, ExplorationLocation } from '../lib/explorationEngine'

type Phase = 'trauma' | 'promotions' | 'reinforcements' | 'exploration' | 'quartermaster' | 'roster_update'

const PHASE_STEPS = campaignRules.campaign_phase_steps.map(s => ({
  label: s.name,
  description: s.description,
}))

interface TraumaRoll {
  name: string
  type: 'troop' | 'elite'
  roll: number | string
  result: typeof campaignRules.trauma.trauma_table[number] | null
  survived: boolean
}

interface DiceRollState {
  dice: number[]
  rerollsUsed: number
  maxRerolls: number
  rerolledIndices: Set<number>
  duplicateUsed: boolean
  setDiceUsed: boolean
  luckyUsed: boolean
  luckyPending: { targetIndex: number; newDie: number } | null
  finalized: boolean
}

export function PostBattle() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const gamesPlayed = parseInt(searchParams.get('games') ?? '3', 10)
  const wonGame = searchParams.get('won') === 'true'
  const warbandName = searchParams.get('warband') ?? 'My Warband'

  const [currentPhase, setCurrentPhase] = useState<Phase>('trauma')
  const [completedPhases, setCompletedPhases] = useState<Set<Phase>>(new Set())
  const [tookReinforcements, setTookReinforcements] = useState(false)

  // --- Trauma State ---
  const [casualtyNames, setCasualtyNames] = useState<{ name: string; type: 'troop' | 'elite' }[]>([
    { name: 'Trooper Gaius', type: 'troop' },
    { name: 'Brother Marcus', type: 'elite' },
  ])
  const [traumaRolls, setTraumaRolls] = useState<TraumaRoll[]>([])
  const [traumaRolled, setTraumaRolled] = useState(false)

  // --- Exploration State ---
  const [explorationSkills] = useState<string[]>([])
  const [permanentLootBonus] = useState(0)
  const [diceState, setDiceState] = useState<DiceRollState | null>(null)
  const [chosenTable, setChosenTable] = useState<TableTier | null>(null)
  const [explorationResult, setExplorationResult] = useState<{
    total: number
    discovery: ExplorationLocation | null
    loot: number
  } | null>(null)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  const availableTables = useMemo(() => getAvailableTables(gamesPlayed), [gamesPlayed])
  const allSkills = useMemo(() => getExplorationSkills(), [])
  const hasSkill = useCallback((id: string) => explorationSkills.includes(id), [explorationSkills])

  const phaseIndex = campaignRules.campaign_phase_steps.findIndex(s => s.id === currentPhase)

  // ─── Trauma Logic ─────────────────────────────────────────────────

  function rollTrauma() {
    const results: TraumaRoll[] = casualtyNames.map(c => {
      if (c.type === 'troop') {
        const roll = Math.floor(Math.random() * 6) + 1
        const survived = roll >= 3
        return { name: c.name, type: c.type, roll, result: null, survived }
      } else {
        const d1 = Math.floor(Math.random() * 6) + 1
        const d2 = Math.floor(Math.random() * 6) + 1
        const rollStr = `${d1}${d2}`
        const rollNum = d1 * 10 + d2
        let tableResult = campaignRules.trauma.trauma_table.find(t => t.roll === rollStr)
        if (!tableResult) {
          if (rollNum >= 41 && rollNum <= 63) {
            tableResult = campaignRules.trauma.trauma_table.find(t => t.roll === '41-63')!
          }
        }
        const survived = tableResult?.name !== 'Dead'
        return { name: c.name, type: c.type, roll: rollStr, result: tableResult ?? null, survived }
      }
    })
    setTraumaRolls(results)
    setTraumaRolled(true)
  }

  // ─── Exploration Logic ────────────────────────────────────────────

  function startExploration() {
    if (!chosenTable) return
    const diceCount = getExplorationDiceCount(gamesPlayed, explorationSkills)
    const maxRerolls = getMaxRerolls(wonGame, explorationSkills)
    const dice = rollExplorationDice(diceCount)
    setDiceState({
      dice,
      rerollsUsed: 0,
      maxRerolls,
      rerolledIndices: new Set(),
      duplicateUsed: false,
      setDiceUsed: false,
      luckyUsed: false,
      luckyPending: null,
      finalized: false,
    })
  }

  function handleReroll(index: number) {
    if (!diceState || diceState.finalized) return
    if (diceState.rerolledIndices.has(index)) return
    if (diceState.rerollsUsed >= diceState.maxRerolls) return
    const newDice = rerollDie(diceState.dice, index)
    const newRerolled = new Set(diceState.rerolledIndices)
    newRerolled.add(index)
    setDiceState({
      ...diceState,
      dice: newDice,
      rerollsUsed: diceState.rerollsUsed + 1,
      rerolledIndices: newRerolled,
    })
  }

  function handleDuplicate(index: number) {
    if (!diceState || diceState.finalized || diceState.duplicateUsed) return
    const newDice = applyDuplicate(diceState.dice, index)
    setDiceState({ ...diceState, dice: newDice, duplicateUsed: true })
  }

  function handleSetDice(index: number, value: number) {
    if (!diceState || diceState.finalized || diceState.setDiceUsed) return
    const newDice = applySetDice(diceState.dice, index, value)
    setDiceState({ ...diceState, dice: newDice, setDiceUsed: true })
  }

  function handleLucky(index: number) {
    if (!diceState || diceState.finalized || diceState.luckyUsed) return
    const { newDie } = applyLucky(diceState.dice, index)
    setDiceState({ ...diceState, luckyPending: { targetIndex: index, newDie } })
  }

  function resolveLucky(keepOriginal: boolean) {
    if (!diceState || !diceState.luckyPending) return
    const { targetIndex, newDie } = diceState.luckyPending
    const newDice = confirmLucky(diceState.dice, targetIndex, keepOriginal, newDie)
    setDiceState({ ...diceState, dice: newDice, luckyUsed: true, luckyPending: null })
  }

  function finalizeRoll() {
    if (!diceState || !chosenTable) return
    const total = computeTotal(diceState.dice)
    const finalTotal = applyModifiers(total, explorationSkills)
    const discovery = lookupDiscovery(finalTotal, chosenTable)
    const loot = computeLoot(finalTotal, permanentLootBonus)
    setDiceState({ ...diceState, finalized: true })
    setExplorationResult({ total: finalTotal, discovery, loot })
  }

  // ─── Phase Navigation ─────────────────────────────────────────────

  function completePhase() {
    const newCompleted = new Set(completedPhases)
    newCompleted.add(currentPhase)
    setCompletedPhases(newCompleted)

    const phases: Phase[] = ['trauma', 'promotions', 'reinforcements', 'exploration', 'quartermaster', 'roster_update']
    const currentIdx = phases.indexOf(currentPhase)

    for (let i = currentIdx + 1; i < phases.length; i++) {
      const next = phases[i]
      if (tookReinforcements && (next === 'exploration' || next === 'quartermaster')) {
        newCompleted.add(next)
        continue
      }
      setCurrentPhase(next)
      return
    }
    setCurrentPhase('roster_update')
  }

  function handleReinforcements(take: boolean) {
    setTookReinforcements(take)
    if (take) {
      const newCompleted = new Set(completedPhases)
      newCompleted.add('reinforcements')
      newCompleted.add('exploration')
      newCompleted.add('quartermaster')
      setCompletedPhases(newCompleted)
      setCurrentPhase('roster_update')
    } else {
      completePhase()
    }
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/campaign')}
          className="text-[var(--sepia)] font-bold uppercase text-xs cursor-pointer hover:underline"
        >
          ← Campaign
        </button>
        <h1 className="text-xl uppercase tracking-wider">Post-Battle — {warbandName}</h1>
        {wonGame && <span className="text-xs font-bold uppercase text-[var(--olive)] border border-[var(--olive)] px-2 py-0.5 rounded-sm">Victory</span>}
      </div>

      <Stepper steps={PHASE_STEPS} currentStep={phaseIndex} />

      {/* ─── TRAUMA STEP ───────────────────────────────────────── */}
      {currentPhase === 'trauma' && (
        <section className="space-y-6">
          <div className="card-military p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-1">Trauma Step</h2>
            <p className="text-[var(--muted)] text-sm mb-4">
              Roll for each model taken Out of Action. Troops: D6 (1-2 = dead). ELITE: D66 on Trauma Table.
            </p>

            {!traumaRolled ? (
              <>
                <div className="space-y-2 mb-4">
                  {casualtyNames.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-sm">
                      <span className="font-bold flex-1">{c.name}</span>
                      <span className="text-xs uppercase text-[var(--muted)]">{c.type}</span>
                    </div>
                  ))}
                  {casualtyNames.length === 0 && (
                    <p className="text-[var(--olive)] text-sm">No casualties this battle!</p>
                  )}
                </div>
                <button
                  onClick={rollTrauma}
                  disabled={casualtyNames.length === 0}
                  className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--border)] text-[var(--parchment)] px-4 py-2.5 rounded-sm font-bold uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed"
                >
                  {casualtyNames.length > 0 ? 'Roll Trauma' : 'No Casualties — Continue'}
                </button>
              </>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {traumaRolls.map((t, i) => (
                    <div key={i} className={`px-4 py-3 border rounded-sm ${t.survived ? 'border-[var(--olive)] bg-[var(--olive)]/5' : 'border-[var(--accent)] bg-[var(--accent)]/5'}`}>
                      <div className="flex items-center gap-3">
                        <span className="font-bold">{t.name}</span>
                        <span className="text-xs bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 rounded-sm font-mono">
                          {t.type === 'troop' ? `D6: ${t.roll}` : `D66: ${t.roll}`}
                        </span>
                        <span className={`text-xs font-bold uppercase ${t.survived ? 'text-[var(--olive)]' : 'text-[var(--accent)]'}`}>
                          {t.survived ? (t.result?.name ?? 'Survived') : 'DEAD'}
                        </span>
                      </div>
                      {t.result && t.result.name !== 'Dead' && t.result.name !== 'Full Recovery' && (
                        <p className="text-xs text-[var(--fg-secondary)] mt-1">{t.result.effect}</p>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={completePhase} className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-2.5 rounded-sm font-bold uppercase tracking-wider cursor-pointer">
                  Continue to Promotions
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {/* ─── PROMOTIONS & EXPERIENCE STEP ──────────────────────── */}
      {currentPhase === 'promotions' && (
        <section className="space-y-6">
          <div className="card-military p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-1">Promotions & Experience</h2>
            <p className="text-[var(--muted)] text-sm mb-4">
              Assign Promotion Dice to Troops. ELITE models earn XP for surviving and Glorious Deeds.
            </p>

            <div className="space-y-3 mb-4">
              <div className="px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">Promotion Pool</div>
                <p className="text-sm">{campaignRules.promotions.dice_pool}</p>
                <p className="text-xs text-[var(--muted)] mt-1">{campaignRules.promotions.success}</p>
              </div>

              <div className="px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">Experience Sources</div>
                {campaignRules.experience.sources.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm mb-1">
                    <span className="text-[var(--brass)] font-bold">+{s.xp} XP</span>
                    <span className="text-[var(--fg-secondary)]">{s.condition}</span>
                  </div>
                ))}
              </div>

              <div className="px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">Advancement Roll</div>
                <ol className="list-decimal list-inside text-sm text-[var(--fg-secondary)] space-y-0.5">
                  {campaignRules.experience.advancement_roll.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            </div>

            <button onClick={completePhase} className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-2.5 rounded-sm font-bold uppercase tracking-wider cursor-pointer">
              Continue to Reinforcements
            </button>
          </div>
        </section>
      )}

      {/* ─── REINFORCEMENTS STEP ───────────────────────────────── */}
      {currentPhase === 'reinforcements' && (
        <section className="space-y-6">
          <div className="card-military p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-1">Reinforcements</h2>
            <p className="text-[var(--muted)] text-sm mb-4">
              {campaignRules.reinforcements.description}
            </p>

            <div className="card-military p-4 bg-[var(--surface)] mb-4 border-[var(--accent)]/30">
              <p className="text-sm text-[var(--accent)] font-bold mb-1">Warning</p>
              <p className="text-sm text-[var(--fg-secondary)]">
                Taking Reinforcements will <strong>skip Exploration and Quartermaster</strong> this phase.
                You will receive up to 3 basic Troop models with no Battlekit.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => handleReinforcements(false)}
                className="flex-1 border border-[var(--border)] text-[var(--fg)] px-4 py-2.5 rounded-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-[var(--surface)]"
              >
                Skip — Continue to Exploration
              </button>
              <button
                onClick={() => handleReinforcements(true)}
                className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-2.5 rounded-sm font-bold uppercase tracking-wider cursor-pointer"
              >
                Take Reinforcements
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ─── EXPLORATION STEP ──────────────────────────────────── */}
      {currentPhase === 'exploration' && (
        <section className="space-y-6">
          <div className="card-military p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-1">Exploration</h2>
            <p className="text-[var(--muted)] text-sm mb-4">
              Roll Exploration Dice to discover locations and collect loot.
              Games played: <strong>{gamesPlayed}</strong> — 
              Dice: <strong>{getExplorationDiceCount(gamesPlayed, explorationSkills)}d6</strong> — 
              Rerolls: <strong>{getMaxRerolls(wonGame, explorationSkills)}</strong>
              {wonGame && <span className="text-[var(--olive)]"> (bonus for winning)</span>}
            </p>

            {/* Skills display */}
            {explorationSkills.length > 0 && (
              <div className="mb-4 px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-sm">
                <span className="text-xs font-bold uppercase text-[var(--muted)]">Active Skills: </span>
                {explorationSkills.map((s, i) => {
                  const skill = allSkills.find(sk => sk.id === s)
                  return (
                    <span key={i} className="text-xs text-[var(--brass)] mr-2">{skill?.name ?? s}</span>
                  )
                })}
              </div>
            )}

            {/* Table selection */}
            {!diceState && !explorationResult && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">
                    Choose Exploration Table
                  </label>
                  <div className="flex gap-3">
                    {availableTables.map(table => (
                      <button
                        key={table}
                        onClick={() => setChosenTable(table)}
                        className={`flex-1 card-military py-3 text-center cursor-pointer font-bold uppercase tracking-wider ${
                          chosenTable === table
                            ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]'
                            : 'text-[var(--muted)] hover:text-[var(--fg)]'
                        }`}
                      >
                        {table}
                      </button>
                    ))}
                  </div>
                </div>

                {chosenTable && (
                  <div className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-sm">
                    <span className="text-xs font-bold uppercase text-[var(--muted)] mb-1 block">
                      {chosenTable} table — possible discoveries:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {getTableEntries(chosenTable).map(entry => (
                        <span key={entry.roll} className="text-xs px-1.5 py-0.5 bg-[var(--bg)] border border-[var(--border)] rounded-sm">
                          {entry.roll}: {entry.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={startExploration}
                  disabled={!chosenTable}
                  className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--border)] text-[var(--parchment)] px-4 py-2.5 rounded-sm font-bold uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed"
                >
                  Roll Exploration Dice
                </button>
              </div>
            )}

            {/* Dice rolling phase */}
            {diceState && !explorationResult && (
              <div className="space-y-4">
                {/* Dice display */}
                <div className="flex items-center justify-center gap-3 py-4">
                  {diceState.dice.map((d, i) => (
                    <div key={i} className="relative group">
                      <div className={`w-14 h-14 flex items-center justify-center text-xl font-bold border-2 rounded-md ${
                        diceState.rerolledIndices.has(i)
                          ? 'border-[var(--brass)] bg-[var(--brass)]/10 text-[var(--brass)]'
                          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--fg)]'
                      }`}>
                        {d}
                      </div>
                      {!diceState.finalized && (
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 hidden group-hover:flex gap-0.5">
                          {!diceState.rerolledIndices.has(i) && diceState.rerollsUsed < diceState.maxRerolls && (
                            <button
                              onClick={() => handleReroll(i)}
                              className="text-[8px] uppercase font-bold text-[var(--accent)] bg-[var(--surface)] border border-[var(--border)] px-1 py-0.5 rounded-sm cursor-pointer whitespace-nowrap"
                            >
                              Reroll
                            </button>
                          )}
                          {hasSkill('duplicate') && !diceState.duplicateUsed && (
                            <button
                              onClick={() => handleDuplicate(i)}
                              className="text-[8px] uppercase font-bold text-[var(--brass)] bg-[var(--surface)] border border-[var(--border)] px-1 py-0.5 rounded-sm cursor-pointer whitespace-nowrap"
                            >
                              Dup
                            </button>
                          )}
                          {hasSkill('set_dice') && !diceState.setDiceUsed && (
                            <button
                              onClick={() => handleSetDice(i, 6)}
                              className="text-[8px] uppercase font-bold text-[var(--olive)] bg-[var(--surface)] border border-[var(--border)] px-1 py-0.5 rounded-sm cursor-pointer whitespace-nowrap"
                            >
                              Set 6
                            </button>
                          )}
                          {hasSkill('lucky') && !diceState.luckyUsed && (
                            <button
                              onClick={() => handleLucky(i)}
                              className="text-[8px] uppercase font-bold text-[var(--sepia)] bg-[var(--surface)] border border-[var(--border)] px-1 py-0.5 rounded-sm cursor-pointer whitespace-nowrap"
                            >
                              Lucky
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Lucky resolution */}
                {diceState.luckyPending && (
                  <div className="card-military p-4 border-[var(--brass)]">
                    <p className="text-sm mb-2">
                      <strong>Lucky:</strong> New die rolled: <span className="font-mono text-lg text-[var(--brass)]">{diceState.luckyPending.newDie}</span>.
                      Original: <span className="font-mono text-lg">{diceState.dice[diceState.luckyPending.targetIndex]}</span>.
                    </p>
                    <div className="flex gap-3">
                      <button onClick={() => resolveLucky(true)} className="flex-1 border border-[var(--border)] text-[var(--fg)] px-3 py-2 rounded-sm font-bold uppercase text-xs cursor-pointer hover:bg-[var(--surface)]">
                        Keep Original ({diceState.dice[diceState.luckyPending.targetIndex]})
                      </button>
                      <button onClick={() => resolveLucky(false)} className="flex-1 bg-[var(--brass)] text-[var(--parchment)] px-3 py-2 rounded-sm font-bold uppercase text-xs cursor-pointer">
                        Take New ({diceState.luckyPending.newDie})
                      </button>
                    </div>
                  </div>
                )}

                {/* Roll info */}
                <div className="flex items-center justify-between text-sm px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-sm">
                  <span>
                    Total: <strong className="text-lg">{computeTotal(diceState.dice)}</strong>
                    {explorationSkills.filter(s => s === 'seek' || s === 'circle_back').length > 0 && (
                      <span className="text-[var(--brass)] ml-2">
                        (modified: {applyModifiers(computeTotal(diceState.dice), explorationSkills)})
                      </span>
                    )}
                  </span>
                  <span className="text-[var(--muted)]">
                    Rerolls: {diceState.rerollsUsed}/{diceState.maxRerolls}
                  </span>
                </div>

                {/* Finalize button */}
                {!diceState.luckyPending && (
                  <button
                    onClick={finalizeRoll}
                    className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-2.5 rounded-sm font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Confirm Roll — Consult Table
                  </button>
                )}
              </div>
            )}

            {/* Exploration Result */}
            {explorationResult && (
              <div className="space-y-4">
                <div className="text-center py-4 border-b border-[var(--border)]">
                  <div className="text-3xl font-bold text-[var(--brass)]">{explorationResult.total}</div>
                  <div className="text-xs text-[var(--muted)] uppercase">Final Exploration Roll</div>
                </div>

                {/* Loot */}
                <div className="flex items-center justify-between px-4 py-3 bg-[var(--brass)]/10 border border-[var(--brass)]/30 rounded-sm">
                  <span className="font-bold uppercase text-sm">Loot Collected</span>
                  <span className="text-xl font-bold text-[var(--brass)]">{explorationResult.loot} ducats</span>
                </div>

                {/* Discovery */}
                {explorationResult.discovery ? (
                  <div className="card-military p-5 border-[var(--olive)]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold uppercase text-[var(--olive)] bg-[var(--olive)]/10 px-2 py-0.5 rounded-sm">Discovery!</span>
                      <span className="font-bold text-lg">{explorationResult.discovery.name}</span>
                    </div>
                    <p className="text-sm text-[var(--fg-secondary)] mb-3">{explorationResult.discovery.description}</p>

                    {explorationResult.discovery.options.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold uppercase text-[var(--muted)]">Choose an option:</span>
                        {explorationResult.discovery.options.map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setSelectedOption(opt.id)}
                            className={`w-full text-left px-4 py-3 border rounded-sm cursor-pointer ${
                              selectedOption === opt.id
                                ? 'border-[var(--accent)] bg-[var(--surface)]'
                                : 'border-[var(--border)] hover:border-[var(--sepia)]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">{opt.name}</span>
                              {opt.factions[0] !== 'any' && (
                                <span className="text-[8px] uppercase text-[var(--muted)] bg-[var(--surface)] px-1 py-0.5 rounded-sm border border-[var(--border)]">
                                  {opt.factions.join(', ')}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--fg-secondary)] mt-0.5">{opt.effect}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="card-military p-4 text-center">
                    <p className="text-[var(--muted)] text-sm">No discovery at this roll value. The territory yields nothing but loot.</p>
                  </div>
                )}

                <button onClick={completePhase} className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-2.5 rounded-sm font-bold uppercase tracking-wider cursor-pointer">
                  Continue to Quartermaster
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── QUARTERMASTER STEP ────────────────────────────────── */}
      {currentPhase === 'quartermaster' && (
        <section className="space-y-6">
          <div className="card-military p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-1">Quartermaster</h2>
            <p className="text-[var(--muted)] text-sm mb-4">
              {campaignRules.quartermaster.description}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {campaignRules.quartermaster.actions.map(action => (
                <div key={action.id} className="px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-sm">
                  <div className="font-bold text-sm mb-0.5">{action.name}</div>
                  <p className="text-xs text-[var(--muted)]">{action.description}</p>
                </div>
              ))}
            </div>

            <button onClick={completePhase} className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-2.5 rounded-sm font-bold uppercase tracking-wider cursor-pointer">
              Continue to Roster Update
            </button>
          </div>
        </section>
      )}

      {/* ─── ROSTER UPDATE STEP ────────────────────────────────── */}
      {currentPhase === 'roster_update' && (
        <section className="space-y-6">
          <div className="card-military p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-1">Roster Update</h2>
            <p className="text-[var(--muted)] text-sm mb-4">
              Final update to your Warband Roster. Review all changes from this post-battle phase.
            </p>

            {/* Summary of what happened */}
            <div className="space-y-3 mb-6">
              {traumaRolls.length > 0 && (
                <div className="px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-sm">
                  <div className="text-xs font-bold uppercase text-[var(--muted)] mb-1">Trauma Results</div>
                  {traumaRolls.map((t, i) => (
                    <div key={i} className="text-sm flex items-center gap-2">
                      <span className="font-bold">{t.name}</span>
                      <span className={t.survived ? 'text-[var(--olive)]' : 'text-[var(--accent)]'}>
                        {t.survived ? (t.result?.name ?? 'Survived') : 'Dead'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {explorationResult && (
                <div className="px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-sm">
                  <div className="text-xs font-bold uppercase text-[var(--muted)] mb-1">Exploration</div>
                  <div className="text-sm">
                    <span className="text-[var(--brass)] font-bold">{explorationResult.loot} ducats</span> collected
                    {explorationResult.discovery && (
                      <span className="ml-2">— discovered <strong>{explorationResult.discovery.name}</strong></span>
                    )}
                  </div>
                </div>
              )}

              {tookReinforcements && (
                <div className="px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-sm">
                  <div className="text-xs font-bold uppercase text-[var(--muted)] mb-1">Reinforcements</div>
                  <p className="text-sm">Received up to 3 basic Troop models.</p>
                </div>
              )}
            </div>

            <button
              onClick={() => navigate('/campaign')}
              className="w-full bg-[var(--olive)] hover:bg-[var(--olive)]/90 text-[var(--parchment)] px-4 py-3 rounded-sm font-bold uppercase tracking-wider cursor-pointer"
            >
              Complete — Unlock Warband
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
