import { useState } from 'react'
import { factions, getPatronsByFaction, getSkillsByIds, getEntriesByFaction, getResolvedArmoury, type Faction, type Patron } from '../data'

export function Factions() {
  const [expanded, setExpanded] = useState<number | null>(null)

  function toggle(id: number) {
    setExpanded(prev => prev === id ? null : id)
  }

  return (
    <div>
      <h1 className="text-2xl mb-2">Factions</h1>
      <p className="text-[var(--muted)] mb-6">
        The warring factions of the Great War — choose your allegiance.
      </p>

      <div className="space-y-3">
        {factions.map(faction => (
          <FactionRow
            key={faction.id}
            faction={faction}
            isOpen={expanded === faction.id}
            onToggle={() => toggle(faction.id)}
          />
        ))}
      </div>
    </div>
  )
}

function FactionRow({ faction, isOpen, onToggle }: { faction: Faction; isOpen: boolean; onToggle: () => void }) {
  const factionPatrons = getPatronsByFaction(faction.code)
  const factionEntries = getEntriesByFaction(faction.code)
  const factionArmoury = getResolvedArmoury(faction.code)

  return (
    <div className="card-military">
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 cursor-pointer hover:bg-[var(--surface)]"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold uppercase tracking-wider">{faction.name}</h3>
            <span className={`badge-faction ${faction.alignment === 'Faithful' ? 'badge-faithful' : 'badge-fallen'}`}>
              {faction.alignment}
            </span>
            <span className="text-xs text-[var(--muted)]">
              {factionEntries.length} units | {factionArmoury.length} armoury items
            </span>
          </div>
          <svg
            className={`w-5 h-5 text-[var(--muted)] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M6 9L12 15L18 9" />
          </svg>
        </div>
        <p className="text-[var(--fg-secondary)] leading-relaxed">
          {faction.description}
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {factionPatrons.map(p => (
            <span key={p.id} className="keyword-pill">{p.name}</span>
          ))}
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 border-t border-[var(--border)]">
          {/* Patrons */}
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mt-4 mb-3">
            Patrons
          </h4>
          <div className="space-y-3 mb-6">
            {factionPatrons.map(patron => (
              <PatronRow key={patron.id} patron={patron} />
            ))}
          </div>

          {/* Available entries */}
          {factionEntries.length > 0 && (
            <>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-3">
                Warband Entries
              </h4>
              <div className="space-y-2 mb-6">
                {factionEntries.map(entry => (
                  <div key={entry.id} className="flex items-center gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-sm px-4 py-2.5">
                    <span className="font-bold text-[var(--fg)] flex-1">{entry.name}</span>
                    {entry.min_count > 0 && (
                      <span className="text-[var(--accent)] text-xs font-bold uppercase">Required</span>
                    )}
                    {entry.max_count !== null && (
                      <span className="text-xs text-[var(--muted)]">{entry.min_count}–{entry.max_count}</span>
                    )}
                    <span className="text-[var(--brass)] font-bold">{entry.cost}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Armoury summary */}
          {factionArmoury.length > 0 && (
            <>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-3">
                Armoury ({factionArmoury.length} items)
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {['melee', 'ranged', 'shield', 'armour', 'grenade', 'equipment'].map(cat => {
                  const items = factionArmoury.filter(i => i.battlekit?.category === cat)
                  if (items.length === 0) return null
                  return (
                    <div key={cat} className="bg-[var(--surface)] border border-[var(--border)] rounded-sm px-3 py-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--sepia)] mb-1">{cat}</div>
                      <div className="text-[var(--fg-secondary)]">
                        {items.map(i => i.battlekit?.name ?? i.item_code).join(', ')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function PatronRow({ patron }: { patron: Patron }) {
  const [open, setOpen] = useState(false)
  const patronSkills = getSkillsByIds(patron.skills)

  return (
    <div className="border border-[var(--border)] rounded-sm bg-[var(--surface)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-3 cursor-pointer hover:bg-[var(--parchment-dark)]"
      >
        <div className="flex items-center justify-between mb-1">
          <h5 className="font-bold text-[var(--sepia)]">{patron.name}</h5>
          <svg
            className={`w-4 h-4 text-[var(--muted)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M6 9L12 15L18 9" />
          </svg>
        </div>
        <p className="text-[var(--fg-secondary)] leading-relaxed">{patron.description}</p>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[var(--border)]">
          <h6 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mt-3 mb-2">Skills</h6>
          <div className="space-y-2">
            {patronSkills.map(skill => (
              <div key={skill.id} className="bg-[var(--card)] border border-[var(--border)] rounded-sm px-3 py-2">
                <span className="font-bold text-[var(--fg)]">{skill.name}</span>
                <p className="text-[var(--fg-secondary)] leading-relaxed mt-1">{skill.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
