import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompendium, type ChainEntry, type ChainPatron, type ChainBattlekitItem, type ChainArmouryItem } from '../hooks/useChainData'
import { Stepper } from '../components/Stepper'

const STEPS = [
  { label: 'Identity' },
  { label: 'Muster' },
  { label: 'Summary' },
]

const STARTING_DUCATS = 700

interface ResolvedEquip {
  item: ChainBattlekitItem;
  cost: number;
}

interface RecruitedModel {
  entry: ChainEntry;
  equipment: ResolvedEquip[];
}

export function WarbandCreate() {
  const navigate = useNavigate()
  const { compendium, loading, error } = useCompendium()
  const [step, setStep] = useState(0)

  const [name, setName] = useState('')
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null)
  const [selectedPatron, setSelectedPatron] = useState<string | null>(null)

  const [roster, setRoster] = useState<RecruitedModel[]>([])
  const [equipOpen, setEquipOpen] = useState<number | null>(null)

  if (loading) return <div className="text-center py-12 text-[var(--muted)]">Loading compendium...</div>
  if (error || !compendium) return <div className="text-center py-12 text-[var(--accent)]">Error: {error}</div>

  const { factions, patrons, entries, armoury, battlekit } = compendium

  const factionPatrons: ChainPatron[] = selectedFaction
    ? patrons.filter(p => p.factions.includes(selectedFaction!))
    : []

  const factionEntries: ChainEntry[] = selectedFaction
    ? entries.filter(e => e.faction === selectedFaction)
    : []

  const factionArmoury: (ChainArmouryItem & { item: ChainBattlekitItem | undefined })[] = selectedFaction
    ? armoury
        .filter(a => a.faction === selectedFaction)
        .map(a => ({ ...a, item: battlekit.find(b => b.code === a.itemCode) }))
    : []

  const totalCost = roster.reduce(
    (sum, m) => sum + m.entry.cost + m.equipment.reduce((s, e) => s + e.cost, 0),
    0
  )
  const remainingBudget = STARTING_DUCATS - totalCost

  function canProceedStep1() {
    return name.trim().length > 0 && selectedFaction !== null && selectedPatron !== null
  }

  function canProceedStep2() {
    if (!selectedFaction) return false
    const required = factionEntries.filter(e => e.minCount > 0)
    for (const req of required) {
      const count = roster.filter(m => m.entry.code === req.code).length
      if (count < req.minCount) return false
    }
    return remainingBudget >= 0
  }

  function getCountForEntry(code: string) {
    return roster.filter(m => m.entry.code === code).length
  }

  function addModel(entry: ChainEntry) {
    if (entry.maxCount !== undefined && getCountForEntry(entry.code) >= entry.maxCount) return
    if (entry.cost > remainingBudget) return
    setRoster([...roster, { entry, equipment: [] }])
  }

  function removeModel(index: number) {
    setRoster(roster.filter((_, i) => i !== index))
  }

  function addEquipment(modelIndex: number, item: ChainBattlekitItem, cost: number) {
    if (cost > remainingBudget) return
    const updated = [...roster]
    updated[modelIndex] = { ...updated[modelIndex], equipment: [...updated[modelIndex].equipment, { item, cost }] }
    setRoster(updated)
  }

  function removeEquipment(modelIndex: number, equipIndex: number) {
    const updated = [...roster]
    updated[modelIndex] = {
      ...updated[modelIndex],
      equipment: updated[modelIndex].equipment.filter((_, i) => i !== equipIndex),
    }
    setRoster(updated)
  }

  function handleConfirm() {
    navigate('/warbands')
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl mb-6">Muster Warband</h1>
      <Stepper steps={STEPS} currentStep={step} />

      {step === 0 && (
        <div className="space-y-6">
          <Field label="Warband Name">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter a name for your warband..."
              className="w-full bg-[var(--card)] border border-[var(--border)] rounded-sm px-4 py-2.5 text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </Field>

          <Field label="Faction">
            <div className="grid grid-cols-2 gap-3">
              {factions.map(f => (
                <button
                  key={f.code}
                  onClick={() => { setSelectedFaction(f.code); setSelectedPatron(null); setRoster([]) }}
                  className={`card-military p-4 text-left cursor-pointer ${
                    selectedFaction === f.code
                      ? 'border-[var(--accent)] bg-[var(--surface)]'
                      : 'hover:border-[var(--sepia)]'
                  }`}
                >
                  <div className="font-bold uppercase tracking-wider">{f.name}</div>
                  <div className="text-[var(--muted)] text-sm">{f.alignment}</div>
                </button>
              ))}
            </div>
          </Field>

          {selectedFaction && (
            <Field label="Patron">
              {factionPatrons.length === 0 ? (
                <p className="text-[var(--muted)] italic">No patrons available for this faction.</p>
              ) : (
                <div className="space-y-3">
                  {factionPatrons.map(p => (
                    <button
                      key={p.code}
                      onClick={() => setSelectedPatron(p.code)}
                      className={`card-military w-full p-4 text-left cursor-pointer ${
                        selectedPatron === p.code
                          ? 'border-[var(--accent)] bg-[var(--surface)]'
                          : 'hover:border-[var(--sepia)]'
                      }`}
                    >
                      <div className="font-bold uppercase tracking-wider text-[var(--sepia)]">{p.name}</div>
                      <div className="text-[var(--fg-secondary)] mt-1">{p.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </Field>
          )}

          <button
            onClick={() => setStep(1)}
            disabled={!canProceedStep1()}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--border)] disabled:text-[var(--muted)] text-[var(--parchment)] px-4 py-3 rounded-sm font-bold uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed"
          >
            Next: Recruit Models
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="card-military p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold uppercase tracking-wider text-[var(--muted)]">Budget</span>
              <span className={`font-bold text-lg ${remainingBudget < 0 ? 'text-[var(--accent)]' : 'text-[var(--brass)]'}`}>
                {remainingBudget} / {STARTING_DUCATS} ducats
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--border)] rounded-sm overflow-hidden">
              <div
                className={`h-full transition-all ${remainingBudget < 0 ? 'bg-[var(--accent)]' : 'bg-[var(--olive)]'}`}
                style={{ width: `${Math.min(100, (totalCost / STARTING_DUCATS) * 100)}%` }}
              />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Available Units</h3>
            <div className="space-y-2">
              {factionEntries.map(entry => {
                const count = getCountForEntry(entry.code)
                const atMax = entry.maxCount !== undefined && count >= entry.maxCount
                const tooExpensive = entry.cost > remainingBudget
                return (
                  <div key={entry.code} className="card-military px-4 py-3 flex items-center gap-4">
                    <div className="flex-1">
                      <span className="font-bold">{entry.name}</span>
                      {entry.minCount > 0 && count < entry.minCount && (
                        <span className="text-[var(--accent)] text-xs font-bold ml-2">REQUIRED</span>
                      )}
                      {entry.maxCount !== undefined && (
                        <span className="text-xs text-[var(--muted)] ml-2">({count}/{entry.maxCount})</span>
                      )}
                    </div>
                    <span className="text-[var(--brass)] font-bold">{entry.cost}</span>
                    <button
                      onClick={() => addModel(entry)}
                      disabled={atMax || tooExpensive}
                      className="px-3 py-1 bg-[var(--olive)] text-[var(--parchment)] font-bold uppercase text-xs rounded-sm cursor-pointer disabled:bg-[var(--border)] disabled:text-[var(--muted)] disabled:cursor-not-allowed"
                    >
                      + Add
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {roster.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
                Roster ({roster.length} models)
              </h3>
              <div className="space-y-3">
                {roster.map((model, idx) => (
                  <div key={idx} className="card-military p-4">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="font-bold flex-1">{model.entry.name}</span>
                      <span className="text-[var(--brass)]">{model.entry.cost}</span>
                      <button
                        onClick={() => removeModel(idx)}
                        className="text-[var(--accent)] text-xs font-bold uppercase cursor-pointer hover:underline"
                      >
                        Remove
                      </button>
                    </div>

                    {model.equipment.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {model.equipment.map((eq, eIdx) => (
                          <span
                            key={eIdx}
                            className="inline-flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-sm px-2 py-0.5 text-xs"
                          >
                            {eq.item.name} ({eq.cost})
                            <button
                              onClick={() => removeEquipment(idx, eIdx)}
                              className="text-[var(--accent)] font-bold cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => setEquipOpen(equipOpen === idx ? null : idx)}
                      className="text-xs text-[var(--sepia)] font-bold uppercase tracking-wider cursor-pointer hover:underline"
                    >
                      {equipOpen === idx ? '— Close Armoury' : '+ Equip'}
                    </button>

                    {equipOpen === idx && (
                      <div className="mt-3 border-t border-[var(--border)] pt-3">
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                          {factionArmoury.filter(a => a.item).map((a, aIdx) => (
                            <button
                              key={aIdx}
                              onClick={() => addEquipment(idx, a.item!, a.cost)}
                              disabled={a.cost > remainingBudget}
                              className="text-left bg-[var(--surface)] border border-[var(--border)] rounded-sm px-3 py-2 cursor-pointer hover:border-[var(--sepia)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold">{a.item!.name}</span>
                                <span className="text-xs text-[var(--brass)]">{a.cost}</span>
                              </div>
                              <div className="text-xs text-[var(--muted)]">{a.item!.battlekitType}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => setStep(0)}
              className="flex-1 border border-[var(--border)] text-[var(--fg)] px-4 py-3 rounded-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-[var(--surface)]"
            >
              Back
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep2()}
              className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--border)] disabled:text-[var(--muted)] text-[var(--parchment)] px-4 py-3 rounded-sm font-bold uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed"
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="card-military p-6">
            <h3 className="text-lg font-bold uppercase tracking-wider mb-1">{name}</h3>
            <p className="text-[var(--muted)] mb-4">
              {factions.find(f => f.code === selectedFaction)?.name} — {factionPatrons.find(p => p.code === selectedPatron)?.name}
            </p>

            <div className="stat-block mb-6">
              <div className="stat-item">
                <div className="stat-label">Models</div>
                <div className="stat-value">{roster.length}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Total Cost</div>
                <div className="stat-value">{totalCost}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Remaining</div>
                <div className="stat-value">{remainingBudget}</div>
              </div>
            </div>

            <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Roster</h4>
            <div className="space-y-2">
              {roster.map((model, idx) => {
                const eqCost = model.equipment.reduce((s, e) => s + e.cost, 0)
                return (
                  <div key={idx} className="flex items-center gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-sm px-4 py-2.5">
                    <span className="font-bold flex-1">{model.entry.name}</span>
                    {model.equipment.length > 0 && (
                      <span className="text-xs text-[var(--muted)]">
                        {model.equipment.map(e => e.item.name).join(', ')}
                      </span>
                    )}
                    <span className="text-[var(--brass)] font-bold">{model.entry.cost + eqCost}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border border-[var(--border)] text-[var(--fg)] px-4 py-3 rounded-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-[var(--surface)]"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-3 rounded-sm font-bold uppercase tracking-wider cursor-pointer"
            >
              Confirm & Deploy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-bold uppercase tracking-wider text-[var(--muted)] mb-2">{label}</label>
      {children}
    </div>
  )
}
