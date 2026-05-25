import { useState } from 'react'
import { factions, battlekit, getKeywordsByCodes, formatRange, getResolvedArmouryByCategory, getTagDefinition, type BattlekitItem, type ResolvedArmouryItem } from '../data'

const CATEGORIES: { key: BattlekitItem['category']; label: string }[] = [
  { key: 'melee', label: 'Melee Weapons' },
  { key: 'ranged', label: 'Ranged Weapons' },
  { key: 'shield', label: 'Shields' },
  { key: 'grenade', label: 'Grenades' },
  { key: 'armour', label: 'Armour' },
  { key: 'equipment', label: 'Equipment' },
]

export function Battlekits() {
  const [category, setCategory] = useState<BattlekitItem['category']>('melee')
  const [factionFilter, setFactionFilter] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  function toggleFaction(code: string) {
    setFactionFilter(prev => prev === code ? null : code)
    setExpanded(null)
  }

  const compendiumItems = battlekit.filter(b => b.category === category)
  const armouryItems = factionFilter ? getResolvedArmouryByCategory(factionFilter, category) : []

  const showingArmoury = factionFilter !== null

  return (
    <div>
      <h1 className="text-2xl mb-2">Battlekits</h1>
      <p className="text-[var(--muted)] mb-6 text-justify">
        Weapons, armour and equipment available to warband models. Select a faction to see armoury costs and restrictions, or browse the full compendium.
      </p>

      {/* Faction filter — always visible */}
      <div className="flex flex-wrap gap-2 mb-4">
        {factions.map(f => (
          <button
            key={f.code}
            onClick={() => toggleFaction(f.code)}
            className={`uppercase tracking-wider font-bold text-xs px-3 py-1.5 border rounded-sm cursor-pointer ${
              factionFilter === f.code
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]'
                : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => { setCategory(cat.key); setExpanded(null) }}
            className={`uppercase tracking-wider font-bold text-xs px-3 py-1.5 border rounded-sm cursor-pointer ${
              category === cat.key
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]'
                : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {showingArmoury ? (
        <div className="space-y-2">
          {armouryItems.length === 0 ? (
            <p className="text-[var(--muted)] italic">No items in this category for this faction.</p>
          ) : (
            armouryItems.map((item, idx) => {
              const key = `${factionFilter}-${category}-${idx}`
              return (
                <ArmouryRow
                  key={key}
                  item={item}
                  isOpen={expanded === key}
                  onToggle={() => setExpanded(prev => prev === key ? null : key)}
                />
              )
            })
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {compendiumItems.map((item, idx) => {
            const key = `compendium-${category}-${idx}`
            return (
              <BattlekitRow
                key={key}
                item={item}
                isOpen={expanded === key}
                onToggle={() => setExpanded(prev => prev === key ? null : key)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function ArmouryRow({ item, isOpen, onToggle }: { item: ResolvedArmouryItem; isOpen: boolean; onToggle: () => void }) {
  const bk = item.battlekit
  const itemKeywords = bk ? getKeywordsByCodes(bk.keywords) : []

  return (
    <div className="card-military">
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-3 cursor-pointer hover:bg-[var(--surface)]"
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0 text-right" style={{ width: '5.5rem' }}>
            <div className="text-[10px] text-[var(--muted)] uppercase leading-tight">{bk?.battlekit_type ?? '—'}</div>
            {bk && <div className="text-xs text-[var(--sepia)]">{formatRange(bk.range)}</div>}
          </div>
          <span className="font-bold text-[var(--fg)] flex-1 min-w-0 truncate">{bk?.name ?? item.item_code}</span>
          {item.tags && item.tags.length > 0 && (
            <div className="hidden sm:flex gap-1 shrink-0">
              {item.tags.map(tag => {
                const def = getTagDefinition(tag)
                return <span key={tag} className="keyword-pill">{def?.name ?? tag}</span>
              })}
            </div>
          )}
          {itemKeywords.length > 0 && (
            <div className="hidden lg:flex gap-1 shrink-0">
              {itemKeywords.slice(0, 2).map(kw => (
                <span key={kw.id} className="keyword-pill">{kw.name}</span>
              ))}
              {itemKeywords.length > 2 && <span className="text-[10px] text-[var(--muted)]">+{itemKeywords.length - 2}</span>}
            </div>
          )}
          <span className="font-bold text-[var(--brass)] shrink-0 w-8 text-right">{item.cost}</span>
          <svg
            className={`w-4 h-4 text-[var(--muted)] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M6 9L12 15L18 9" />
          </svg>
        </div>
      </button>

      {isOpen && bk && (
        <div className="px-5 pb-4 border-t border-[var(--border)] pt-3">
          <p className="text-[var(--fg-secondary)] leading-relaxed text-justify mb-3">
            {bk.description}
          </p>

          <div className="stat-block mb-3">
            <div className="stat-item">
              <div className="stat-label">Category</div>
              <div className="stat-value">{bk.category}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Type</div>
              <div className="stat-value">{bk.battlekit_type}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Range</div>
              <div className="stat-value">{formatRange(bk.range)}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Cost</div>
              <div className="stat-value">{item.cost} ducats</div>
            </div>
          </div>

          {bk.special_rules && (
            <div className="p-3 bg-[var(--surface)] border-l-3 border-[var(--sepia)] mb-3 rounded-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--sepia)] mb-1">Special Rules</h4>
              <p className="text-[var(--fg-secondary)] leading-relaxed text-justify">{bk.special_rules}</p>
            </div>
          )}

          {itemKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {itemKeywords.map(kw => (
                <span key={kw.id} className="keyword-pill">{kw.name}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {isOpen && !bk && (
        <div className="px-5 pb-4 border-t border-[var(--border)] pt-3">
          <p className="text-[var(--muted)] italic">No additional compendium data available for this item.</p>
        </div>
      )}
    </div>
  )
}

function BattlekitRow({ item, isOpen, onToggle }: { item: BattlekitItem; isOpen: boolean; onToggle: () => void }) {
  const itemKeywords = getKeywordsByCodes(item.keywords)

  return (
    <div className="card-military">
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-3 cursor-pointer hover:bg-[var(--surface)]"
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0 text-right" style={{ width: '5.5rem' }}>
            <div className="text-[10px] text-[var(--muted)] uppercase leading-tight">{item.battlekit_type}</div>
            <div className="text-xs text-[var(--sepia)]">{formatRange(item.range)}</div>
          </div>
          <h3 className="font-bold uppercase tracking-wider flex-1 min-w-0 truncate">{item.name}</h3>
          {itemKeywords.length > 0 && (
            <div className="hidden lg:flex gap-1 shrink-0">
              {itemKeywords.slice(0, 2).map(kw => (
                <span key={kw.id} className="keyword-pill">{kw.name}</span>
              ))}
              {itemKeywords.length > 2 && <span className="text-[10px] text-[var(--muted)]">+{itemKeywords.length - 2}</span>}
            </div>
          )}
          <svg
            className={`w-4 h-4 text-[var(--muted)] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M6 9L12 15L18 9" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-4 border-t border-[var(--border)] pt-3">
          <p className="text-[var(--fg-secondary)] leading-relaxed text-justify mb-3">
            {item.description}
          </p>

          <div className="stat-block mb-3">
            <div className="stat-item">
              <div className="stat-label">Category</div>
              <div className="stat-value">{item.category}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Type</div>
              <div className="stat-value">{item.battlekit_type}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Range</div>
              <div className="stat-value">{formatRange(item.range)}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Keywords</div>
              <div className="stat-value">{item.keywords.length}</div>
            </div>
          </div>

          {item.special_rules && (
            <div className="p-3 bg-[var(--surface)] border-l-3 border-[var(--sepia)] mb-3 rounded-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--sepia)] mb-1">Special Rules</h4>
              <p className="text-[var(--fg-secondary)] leading-relaxed text-justify">{item.special_rules}</p>
            </div>
          )}

          {itemKeywords.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">Keywords</h4>
              <div className="space-y-2">
                {itemKeywords.map(kw => (
                  <div key={kw.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-sm px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-[var(--fg)]">{kw.name}</span>
                      <span className={`badge-faction ${kw.kind === 'Tag' ? 'badge-faithful' : ''}`}>{kw.kind}</span>
                    </div>
                    <p className="text-[var(--fg-secondary)] leading-relaxed text-justify">{kw.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
