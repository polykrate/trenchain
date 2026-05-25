import { useState } from 'react'
import { factions, getEntriesByFaction, type WarbandEntry } from '../data'

export function Units() {
  const [filter, setFilter] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const entries = filter
    ? getEntriesByFaction(filter)
    : factions.flatMap(f => getEntriesByFaction(f.code))

  function toggle(id: string) {
    setExpanded(prev => prev === id ? null : id)
  }

  return (
    <div>
      <h1 className="text-2xl mb-2">Units</h1>
      <p className="text-[var(--muted)] mb-6">
        Model entries available for warband recruitment.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter(null)}
          className={`uppercase tracking-wider font-bold px-3 py-1.5 border rounded-sm cursor-pointer ${
            filter === null
              ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]'
              : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          All
        </button>
        {factions.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.code)}
            className={`uppercase tracking-wider font-bold px-3 py-1.5 border rounded-sm cursor-pointer ${
              filter === f.code
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]'
                : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {entries.map(entry => (
          <UnitRow
            key={entry.id}
            entry={entry}
            isOpen={expanded === entry.id}
            onToggle={() => toggle(entry.id)}
          />
        ))}
      </div>
    </div>
  )
}

function UnitRow({ entry, isOpen, onToggle }: { entry: WarbandEntry; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="card-military">
      {/* Folded view */}
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-5 cursor-pointer hover:bg-[var(--surface)]"
      >
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h3 className="text-lg font-bold uppercase tracking-wider">{entry.name}</h3>
              {entry.min_count > 0 && (
                <span className="text-[var(--accent)] text-xs font-bold uppercase">Required</span>
              )}
              {entry.max_count !== null && (
                <span className="text-[var(--muted)] text-xs">
                  {entry.min_count}–{entry.max_count}
                </span>
              )}
              <span className="font-bold text-[var(--brass)]">{entry.cost} ducats</span>
            </div>
            <p className="text-[var(--fg-secondary)] leading-relaxed mb-3">
              {entry.description}
            </p>
            {entry.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {entry.keywords.map(kw => (
                  <span key={kw} className="keyword-pill">{kw}</span>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 flex items-start gap-3">
            <div className="stat-block-inline">
              <div className="stat-item">
                <div className="stat-label">Move</div>
                <div className="stat-value">{entry.profile.movement_inches}″</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Rng</div>
                <div className="stat-value">
                  {entry.profile.ranged !== null ? (entry.profile.ranged >= 0 ? `+${entry.profile.ranged}` : `${entry.profile.ranged}`) : '—'}
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Mel</div>
                <div className="stat-value">
                  {entry.profile.melee !== null ? (entry.profile.melee >= 0 ? `+${entry.profile.melee}` : `${entry.profile.melee}`) : '—'}
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Arm</div>
                <div className="stat-value">{entry.profile.armour}</div>
              </div>
            </div>
            <svg
              className={`w-5 h-5 text-[var(--muted)] mt-3 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M6 9L12 15L18 9" />
            </svg>
          </div>
        </div>
      </button>

      {/* Expanded view */}
      {isOpen && (
        <div className="px-5 pb-6 border-t border-[var(--border)]">
          <p className="text-[var(--sepia)] italic pt-4 mb-4">
            {entry.composition_note}
          </p>

          <p className="text-[var(--fg-secondary)] leading-relaxed mb-5">
            {entry.description}
          </p>

          {/* Full stat block */}
          <div className="stat-block mb-5">
            <div className="stat-item">
              <div className="stat-label">Movement</div>
              <div className="stat-value">{entry.profile.movement_inches}″</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Type</div>
              <div className="stat-value">{entry.profile.movement_type}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Ranged</div>
              <div className="stat-value">
                {entry.profile.ranged !== null ? `${entry.profile.ranged >= 0 ? '+' : ''}${entry.profile.ranged} DICE` : '—'}
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Melee</div>
              <div className="stat-value">
                {entry.profile.melee !== null ? `${entry.profile.melee >= 0 ? '+' : ''}${entry.profile.melee} DICE` : '—'}
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Armour</div>
              <div className="stat-value">{entry.profile.armour}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Base</div>
              <div className="stat-value">{entry.profile.base}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Cost</div>
              <div className="stat-value">{entry.cost}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Limit</div>
              <div className="stat-value">{entry.min_count}–{entry.max_count ?? '∞'}</div>
            </div>
          </div>

          {/* Included battlekit */}
          {entry.included_battlekit.length > 0 && (
            <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-sm mb-5">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Included Battlekit</h4>
              <ul className="list-disc list-inside text-[var(--fg-secondary)]">
                {entry.included_battlekit.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Battlekit rules */}
          <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-sm mb-5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Battlekit</h4>
            <p className="text-[var(--fg-secondary)]">{entry.battlekit_rules}</p>
          </div>

          {/* Abilities */}
          {entry.abilities.length > 0 && (
            <div className="mb-5">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Abilities</h4>
              <div className="space-y-3">
                {entry.abilities.map((ability, idx) => (
                  <div key={idx} className="p-4 bg-[var(--surface)] border-l-3 border-[var(--accent)] rounded-sm">
                    <h5 className="font-bold text-[var(--fg)] mb-2">{ability.name}</h5>
                    <p className="text-[var(--fg-secondary)] leading-relaxed">{ability.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keywords */}
          {entry.keywords.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Keywords</h4>
              <div className="flex flex-wrap gap-2">
                {entry.keywords.map(kw => (
                  <span key={kw} className="keyword-pill">{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
