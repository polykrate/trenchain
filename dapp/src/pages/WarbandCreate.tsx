import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { factions, getPatronsByFaction, getEntriesByFaction, getResolvedArmoury, getBattlekitByCode, canModelEquip, type WarbandEntry, type ResolvedArmouryItem } from '../data'
import { Stepper } from '../components/Stepper'
import type { Patron } from '../data'

const STEPS = [
  { label: 'Identity' },
  { label: 'Muster' },
  { label: 'Summary' },
]

const STARTING_DUCATS = 700

interface RecruitedModel {
  entry: WarbandEntry
  equipment: ResolvedArmouryItem[]
}

export function WarbandCreate() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  // Step 1 state
  const [name, setName] = useState('')
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null)
  const [selectedPatron, setSelectedPatron] = useState<number | null>(null)

  // Step 2 state
  const [roster, setRoster] = useState<RecruitedModel[]>([])
  const [equipOpen, setEquipOpen] = useState<number | null>(null)

  const factionPatrons: Patron[] = selectedFaction ? getPatronsByFaction(selectedFaction) : []
  const factionEntries = selectedFaction ? getEntriesByFaction(selectedFaction) : []
  const factionArmoury = selectedFaction ? getResolvedArmoury(selectedFaction) : []

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
    const required = getEntriesByFaction(selectedFaction).filter(e => e.min_count > 0)
    for (const req of required) {
      const count = roster.filter(m => m.entry.id === req.id).length
      if (count < req.min_count) return false
    }
    return remainingBudget >= 0
  }

  function getCountForEntry(entryId: string) {
    return roster.filter(m => m.entry.id === entryId).length
  }

  function addModel(entry: WarbandEntry) {
    if (entry.max_count !== null && getCountForEntry(entry.id) >= entry.max_count) return
    if (entry.cost > remainingBudget) return
    setRoster([...roster, { entry, equipment: [] }])
  }

  function removeModel(index: number) {
    setRoster(roster.filter((_, i) => i !== index))
  }

  function addEquipment(modelIndex: number, item: ResolvedArmouryItem) {
    if (item.cost > remainingBudget) return
    const updated = [...roster]
    updated[modelIndex] = { ...updated[modelIndex], equipment: [...updated[modelIndex].equipment, item] }
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

      {/* Step 1: Identity */}
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
                      key={p.id}
                      onClick={() => setSelectedPatron(p.id)}
                      className={`card-military w-full p-4 text-left cursor-pointer ${
                        selectedPatron === p.id
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

      {/* Step 2: Muster */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Budget bar */}
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

          {/* Available entries */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Available Units</h3>
            <div className="space-y-2">
              {factionEntries.map(entry => {
                const count = getCountForEntry(entry.id)
                const atMax = entry.max_count !== null && count >= entry.max_count
                const tooExpensive = entry.cost > remainingBudget
                return (
                  <div key={entry.id} className="card-military px-4 py-3 flex items-center gap-4">
                    <div className="flex-1">
                      <span className="font-bold">{entry.name}</span>
                      {entry.min_count > 0 && count < entry.min_count && (
                        <span className="text-[var(--accent)] text-xs font-bold ml-2">REQUIRED</span>
                      )}
                      {entry.max_count !== null && (
                        <span className="text-xs text-[var(--muted)] ml-2">({count}/{entry.max_count})</span>
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

          {/* Roster */}
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

                    {/* Equipment list */}
                    {model.equipment.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {model.equipment.map((eq, eIdx) => (
                          <span
                            key={eIdx}
                            className="inline-flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-sm px-2 py-0.5 text-xs"
                          >
                            {eq.battlekit?.name ?? eq.item_code} ({eq.cost})
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

                    {/* Equip toggle */}
                    <button
                      onClick={() => setEquipOpen(equipOpen === idx ? null : idx)}
                      className="text-xs text-[var(--sepia)] font-bold uppercase tracking-wider cursor-pointer hover:underline"
                    >
                      {equipOpen === idx ? '— Close Armoury' : '+ Equip'}
                    </button>

                    {equipOpen === idx && (
                      <div className="mt-3 border-t border-[var(--border)] pt-3">
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                          {factionArmoury
                            .filter(item => canModelEquip(item, model.entry.keywords, model.entry.id))
                            .map((item, aIdx) => (
                            <button
                              key={aIdx}
                              onClick={() => addEquipment(idx, item)}
                              disabled={item.cost > remainingBudget}
                              className="text-left bg-[var(--surface)] border border-[var(--border)] rounded-sm px-3 py-2 cursor-pointer hover:border-[var(--sepia)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold">{item.battlekit?.name ?? item.item_code}</span>
                                <span className="text-xs text-[var(--brass)]">{item.cost}</span>
                              </div>
                              <div className="text-xs text-[var(--muted)]">{item.battlekit?.battlekit_type ?? '—'}</div>
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

          {/* Navigation */}
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

      {/* Step 3: Summary */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="card-military p-6">
            <h3 className="text-lg font-bold uppercase tracking-wider mb-1">{name}</h3>
            <p className="text-[var(--muted)] mb-4">
              {factions.find(f => f.code === selectedFaction)?.name} — {factionPatrons.find(p => p.id === selectedPatron)?.name}
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
                        {model.equipment.map(e => e.battlekit?.name ?? e.item_code).join(', ')}
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
