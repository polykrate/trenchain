import { useState } from 'react'
import {
  useChainFactions, useChainPatrons, useChainSkills, useChainEntries, useChainArmoury, useChainBattlekit,
  type ChainFaction, type ChainPatron, type ChainSkill,
} from '../hooks/useChainData'

export function Factions() {
  const { factions, loading: loadingF } = useChainFactions()
  const { patrons } = useChainPatrons()
  const { skills } = useChainSkills()
  const { entries } = useChainEntries()
  const { armoury } = useChainArmoury()
  const { battlekit } = useChainBattlekit()

  const [expanded, setExpanded] = useState<string | null>(null)

  const skillMap = new Map(skills.map(s => [s.code, s]))
  const bkMap = new Map(battlekit.map(b => [b.code, b]))

  if (loadingF) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="card-military animate-pulse h-28" />)}
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl mb-2">Factions</h1>
      <p className="text-[var(--muted)] mb-6">
        The warring factions of the Great War — choose your allegiance.
      </p>

      <div className="space-y-3">
        {factions.map(faction => {
          const factionPatrons = patrons.filter(p => p.factions.includes(faction.code))
          const factionEntries = entries.filter(e => e.faction === faction.code)
          const factionArmoury = armoury.filter(a => a.faction === faction.code)

          return (
            <FactionRow
              key={faction.code}
              faction={faction}
              factionPatrons={factionPatrons}
              factionEntries={factionEntries}
              factionArmouryCount={factionArmoury.length}
              skillMap={skillMap}
              bkMap={bkMap}
              factionArmoury={factionArmoury}
              isOpen={expanded === faction.code}
              onToggle={() => setExpanded(prev => prev === faction.code ? null : faction.code)}
            />
          )
        })}
      </div>
    </div>
  )
}

function FactionRow({ faction, factionPatrons, factionEntries, factionArmouryCount, factionArmoury, skillMap, bkMap, isOpen, onToggle }: {
  faction: ChainFaction;
  factionPatrons: ChainPatron[];
  factionEntries: { code: string; name: string; minCount: number; maxCount: number | undefined; cost: number }[];
  factionArmouryCount: number;
  factionArmoury: { itemCode: string }[];
  skillMap: Map<string, ChainSkill>;
  bkMap: Map<string, { name: string; battlekitType: string }>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="card-military">
      <button onClick={onToggle} className="w-full text-left px-5 py-4 cursor-pointer hover:bg-[var(--surface)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold uppercase tracking-wider">{faction.name}</h3>
            <span className={`badge-faction ${faction.alignment === 'Faithful' ? 'badge-faithful' : 'badge-fallen'}`}>
              {faction.alignment}
            </span>
            <span className="text-xs text-[var(--muted)]">
              {factionEntries.length} units | {factionArmouryCount} armoury items
            </span>
          </div>
          <svg className={`w-5 h-5 text-[var(--muted)] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9L12 15L18 9" />
          </svg>
        </div>
        <p className="text-[var(--fg-secondary)] leading-relaxed">{faction.description}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {factionPatrons.map(p => <span key={p.code} className="keyword-pill">{p.name}</span>)}
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 border-t border-[var(--border)]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mt-4 mb-3">Patrons</h4>
          <div className="space-y-3 mb-6">
            {factionPatrons.map(patron => (
              <PatronRow key={patron.code} patron={patron} skillMap={skillMap} />
            ))}
          </div>

          {factionEntries.length > 0 && (
            <>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-3">Warband Entries</h4>
              <div className="space-y-2 mb-6">
                {factionEntries.map(entry => (
                  <div key={entry.code} className="flex items-center gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-sm px-4 py-2.5">
                    <span className="font-bold text-[var(--fg)] flex-1">{entry.name}</span>
                    {entry.minCount > 0 && <span className="text-[var(--accent)] text-xs font-bold uppercase">Required</span>}
                    {entry.maxCount !== undefined && <span className="text-xs text-[var(--muted)]">{entry.minCount}–{entry.maxCount}</span>}
                    <span className="text-[var(--brass)] font-bold">{entry.cost}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {factionArmoury.length > 0 && (
            <>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-3">
                Armoury ({factionArmoury.length} items)
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {['OneHanded', 'TwoHanded', 'Grenade', 'Armour', 'Shield', 'Equipment'].map(cat => {
                  const items = factionArmoury
                    .map(a => bkMap.get(a.itemCode))
                    .filter(b => b && b.battlekitType === cat) as { name: string; battlekitType: string }[]
                  if (items.length === 0) return null
                  return (
                    <div key={cat} className="bg-[var(--surface)] border border-[var(--border)] rounded-sm px-3 py-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--sepia)] mb-1">{cat}</div>
                      <div className="text-[var(--fg-secondary)]">{items.map(i => i.name).join(', ')}</div>
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

function PatronRow({ patron, skillMap }: { patron: ChainPatron; skillMap: Map<string, ChainSkill> }) {
  const [open, setOpen] = useState(false)
  const patronSkills = patron.skills.map(s => skillMap.get(s)).filter(Boolean) as ChainSkill[]

  return (
    <div className="border border-[var(--border)] rounded-sm bg-[var(--surface)]">
      <button onClick={() => setOpen(!open)} className="w-full text-left px-4 py-3 cursor-pointer hover:bg-[var(--parchment-dark)]">
        <div className="flex items-center justify-between mb-1">
          <h5 className="font-bold text-[var(--sepia)]">{patron.name}</h5>
          <svg className={`w-4 h-4 text-[var(--muted)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              <div key={skill.code} className="bg-[var(--card)] border border-[var(--border)] rounded-sm px-3 py-2">
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
