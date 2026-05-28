import { useState } from 'react'
import { useChainBattlekit, useChainFactions, useChainKeywords, useChainArmoury, type ChainBattlekitItem, type ChainKeyword } from '../hooks/useChainData'
import { ChainLoader } from '../components/ChainLoader'

const CATEGORIES = [
  { key: 'OneHanded', label: 'One-Handed' },
  { key: 'TwoHanded', label: 'Two-Handed' },
  { key: 'Grenade', label: 'Grenades' },
  { key: 'Armour', label: 'Armour' },
  { key: 'Shield', label: 'Shields' },
  { key: 'Equipment', label: 'Equipment' },
  { key: 'Special', label: 'Special' },
]

export function Battlekits() {
  const { battlekit, loading: loadingBk, count: bkCount } = useChainBattlekit()
  const { factions, loading: loadingF, count: fCount } = useChainFactions()
  const { keywords, count: kwCount } = useChainKeywords()
  const { armoury, count: armCount } = useChainArmoury()

  const [category, setCategory] = useState('OneHanded')
  const [factionFilter, setFactionFilter] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const loading = loadingBk || loadingF
  const keywordMap = new Map(keywords.map(kw => [kw.code, kw]))
  const bkMap = new Map(battlekit.map(b => [b.code, b]))

  function toggleFaction(code: string) {
    setFactionFilter(prev => prev === code ? null : code)
    setExpanded(null)
  }

  const compendiumItems = battlekit.filter(b => b.battlekitType === category)

  const armouryItems = factionFilter
    ? armoury
        .filter(a => a.faction === factionFilter)
        .map(a => ({ ...a, bk: bkMap.get(a.itemCode) }))
        .filter(a => a.bk?.battlekitType === category)
    : []

  const showingArmoury = factionFilter !== null

  if (loading) {
    return <ChainLoader title="Battlekits" skeletonCount={5} steps={[
      { label: 'Battlekit items', status: bkCount ? 'done' : 'loading', current: bkCount || undefined },
      { label: 'Factions', status: fCount ? 'done' : 'loading', current: fCount || undefined },
      { label: 'Keywords', status: kwCount ? 'done' : 'loading', current: kwCount || undefined },
      { label: 'Armoury', status: armCount ? 'done' : 'loading', current: armCount || undefined },
    ]} />
  }

  return (
    <div>
      <h1 className="text-2xl mb-2">Battlekits</h1>
      <p className="text-[var(--muted)] mb-6 text-justify">
        Weapons, armour and equipment available to warband models. Select a faction to see armoury costs and restrictions, or browse the full compendium.
      </p>

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
                  keywordMap={keywordMap}
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
                keywordMap={keywordMap}
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

function ArmouryRow({ item, keywordMap, isOpen, onToggle }: {
  item: { faction: string; itemCode: string; cost: number; costType: string; tags: string[]; bk?: ChainBattlekitItem };
  keywordMap: Map<string, ChainKeyword>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const bk = item.bk
  const itemKeywords = bk ? bk.keywords.map(k => keywordMap.get(k)).filter(Boolean) as ChainKeyword[] : []

  return (
    <div className="card-military">
      <button onClick={onToggle} className="w-full text-left px-5 py-3 cursor-pointer hover:bg-[var(--surface)]">
        <div className="flex items-center gap-3">
          <div className="shrink-0 text-right" style={{ width: '5.5rem' }}>
            <div className="text-[10px] text-[var(--muted)] uppercase leading-tight">{bk?.battlekitType ?? '—'}</div>
            {bk && <div className="text-xs text-[var(--sepia)]">{bk.range}</div>}
          </div>
          <span className="font-bold text-[var(--fg)] flex-1 min-w-0 truncate">{bk?.name ?? item.itemCode}</span>
          {item.tags.length > 0 && (
            <div className="hidden sm:flex gap-1 shrink-0">
              {item.tags.slice(0, 2).map(tag => (
                <span key={tag} className="keyword-pill">{tag}</span>
              ))}
            </div>
          )}
          <span className="font-bold text-[var(--brass)] shrink-0 w-8 text-right">{item.cost}</span>
          <svg className={`w-4 h-4 text-[var(--muted)] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9L12 15L18 9" />
          </svg>
        </div>
      </button>

      {isOpen && bk && (
        <div className="px-5 pb-4 border-t border-[var(--border)] pt-3">
          <p className="text-[var(--fg-secondary)] leading-relaxed text-justify mb-3">{bk.description}</p>
          <div className="stat-block mb-3">
            <div className="stat-item"><div className="stat-label">Type</div><div className="stat-value">{bk.battlekitType}</div></div>
            <div className="stat-item"><div className="stat-label">Range</div><div className="stat-value">{bk.range}</div></div>
            <div className="stat-item"><div className="stat-label">Cost</div><div className="stat-value">{item.cost} {item.costType.toLowerCase()}</div></div>
          </div>
          {bk.specialRules && (
            <div className="p-3 bg-[var(--surface)] border-l-3 border-[var(--sepia)] mb-3 rounded-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--sepia)] mb-1">Special Rules</h4>
              <p className="text-[var(--fg-secondary)] leading-relaxed text-justify">{bk.specialRules}</p>
            </div>
          )}
          {itemKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {itemKeywords.map(kw => <span key={kw.code} className="keyword-pill">{kw.name}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BattlekitRow({ item, keywordMap, isOpen, onToggle }: {
  item: ChainBattlekitItem;
  keywordMap: Map<string, ChainKeyword>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const itemKeywords = item.keywords.map(k => keywordMap.get(k)).filter(Boolean) as ChainKeyword[]

  return (
    <div className="card-military">
      <button onClick={onToggle} className="w-full text-left px-5 py-3 cursor-pointer hover:bg-[var(--surface)]">
        <div className="flex items-center gap-3">
          <div className="shrink-0 text-right" style={{ width: '5.5rem' }}>
            <div className="text-[10px] text-[var(--muted)] uppercase leading-tight">{item.battlekitType}</div>
            <div className="text-xs text-[var(--sepia)]">{item.range}</div>
          </div>
          <h3 className="font-bold uppercase tracking-wider flex-1 min-w-0 truncate">{item.name}</h3>
          {itemKeywords.length > 0 && (
            <div className="hidden lg:flex gap-1 shrink-0">
              {itemKeywords.slice(0, 2).map(kw => <span key={kw.code} className="keyword-pill">{kw.name}</span>)}
              {itemKeywords.length > 2 && <span className="text-[10px] text-[var(--muted)]">+{itemKeywords.length - 2}</span>}
            </div>
          )}
          <svg className={`w-4 h-4 text-[var(--muted)] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9L12 15L18 9" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-4 border-t border-[var(--border)] pt-3">
          <p className="text-[var(--fg-secondary)] leading-relaxed text-justify mb-3">{item.description}</p>
          <div className="stat-block mb-3">
            <div className="stat-item"><div className="stat-label">Type</div><div className="stat-value">{item.battlekitType}</div></div>
            <div className="stat-item"><div className="stat-label">Range</div><div className="stat-value">{item.range}</div></div>
            <div className="stat-item"><div className="stat-label">Keywords</div><div className="stat-value">{item.keywords.length}</div></div>
          </div>
          {item.specialRules && (
            <div className="p-3 bg-[var(--surface)] border-l-3 border-[var(--sepia)] mb-3 rounded-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--sepia)] mb-1">Special Rules</h4>
              <p className="text-[var(--fg-secondary)] leading-relaxed text-justify">{item.specialRules}</p>
            </div>
          )}
          {itemKeywords.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">Keywords</h4>
              <div className="space-y-2">
                {itemKeywords.map(kw => (
                  <div key={kw.code} className="bg-[var(--surface)] border border-[var(--border)] rounded-sm px-3 py-2">
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
