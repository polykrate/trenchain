import { useState } from 'react'
import { keywords, type Keyword } from '../data'

export function Keywords() {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | 'Tag' | 'Effect'>('all')

  const filtered = keywords.filter(kw => {
    const matchSearch = kw.name.toLowerCase().includes(search.toLowerCase()) ||
      kw.description.toLowerCase().includes(search.toLowerCase())
    const matchKind = kindFilter === 'all' || kw.kind === kindFilter
    return matchSearch && matchKind
  })

  return (
    <div>
      <h1 className="text-lg mb-1">Keywords</h1>
      <p className="text-[var(--muted)] mb-6">
        Rules keywords that define model abilities and weapon effects.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search keywords..."
          className="px-3 py-1.5 border border-[var(--border)] rounded-sm bg-[var(--card)] text-[var(--fg)] placeholder:text-[var(--muted)] w-64"
        />
        <div className="flex gap-2">
          {(['all', 'Tag', 'Effect'] as const).map(kind => (
            <button
              key={kind}
              onClick={() => setKindFilter(kind)}
              className={`uppercase tracking-wider font-bold px-3 py-1.5 border rounded-sm cursor-pointer ${
                kindFilter === kind
                  ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {kind}
            </button>
          ))}
        </div>
        <span className="text-[0.65rem] text-[var(--muted)] ml-auto">
          {filtered.length} / {keywords.length} keywords
        </span>
      </div>

      {/* Keywords list */}
      <div className="space-y-2">
        {filtered.map(kw => (
          <KeywordRow key={kw.id} keyword={kw} />
        ))}
      </div>
    </div>
  )
}

function KeywordRow({ keyword }: { keyword: Keyword }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card-military">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-[var(--surface)]"
      >
        <div className="flex items-center gap-3">
          <span className="font-bold uppercase tracking-wider">{keyword.name}</span>
          <span className={`badge-faction ${keyword.kind === 'Tag' ? 'badge-faithful' : ''}`}>
            {keyword.kind}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-[var(--muted)] transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9L12 15L18 9" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-3 border-t border-[var(--border)]">
          <p className="text-[var(--fg-secondary)] leading-relaxed pt-3">
            {keyword.description}
          </p>
        </div>
      )}
    </div>
  )
}
