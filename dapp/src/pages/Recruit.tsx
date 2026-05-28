import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { warband as warbandApi } from '../chain'
import { useChainEntries, type ChainEntry } from '../hooks/useChainData'
import { ChainLoader } from '../components/ChainLoader'

export function Recruit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { entries: allEntries, loading: loadingEntries, count: eCount } = useChainEntries()
  const [faction, setFaction] = useState<string | null>(null)
  const [factionLoading, setFactionLoading] = useState(true)
  const [selected, setSelected] = useState<ChainEntry | null>(null)
  const [recruitName, setRecruitName] = useState('')

  useEffect(() => {
    if (!id) return
    warbandApi.getWarband(Number(id)).then(wb => {
      if (wb) setFaction(wb.faction)
      setFactionLoading(false)
    })
  }, [id])

  const factionEntries = faction ? allEntries.filter(e => e.faction === faction) : []

  const handleRecruit = async () => {
    if (!id || !selected || !recruitName.trim()) return
    navigate(`/warband/${id}`)
  }

  if (loadingEntries || factionLoading) {
    return <ChainLoader title="Recruit" skeletonCount={3} steps={[
      { label: 'Warband faction', status: faction ? 'done' : factionLoading ? 'loading' : 'pending' },
      { label: 'Unit entries', status: eCount ? 'done' : loadingEntries ? 'loading' : 'pending', current: eCount || undefined },
    ]} />
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Recruit a Model</h1>

      <div className="space-y-4 mb-6">
        {factionEntries.map(e => (
          <button
            key={e.code}
            onClick={() => { setSelected(e); setRecruitName('') }}
            className={`w-full card-military p-4 text-left cursor-pointer ${
              selected?.code === e.code ? 'border-[var(--accent)] bg-[var(--surface)]' : 'hover:border-[var(--sepia)]'
            }`}
          >
            <div className="flex justify-between">
              <span className="font-semibold">{e.name}</span>
              <span className="text-sm font-mono text-[var(--brass)]">{e.cost} ducats</span>
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">{e.description.slice(0, 100)}{e.description.length > 100 ? '...' : ''}</p>
            <div className="mt-2 flex gap-4 text-xs text-[var(--muted)]">
              <span>Mvt: {e.profile.movementInches}"</span>
              <span>Ranged: {e.profile.ranged ?? '-'}</span>
              <span>Melee: {e.profile.melee ?? '-'}</span>
              <span>Armour: {e.profile.armour}</span>
              {e.maxCount !== undefined && <span className="text-[var(--brass)]">Limit: {e.maxCount}</span>}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="border-t border-[var(--border)] pt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--muted)]">
              Name your {selected.name}
            </label>
            <input
              type="text"
              value={recruitName}
              onChange={e => setRecruitName(e.target.value)}
              placeholder="Give them a name..."
              className="w-full bg-[var(--card)] border border-[var(--border)] rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <button
            onClick={handleRecruit}
            disabled={!recruitName.trim()}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--border)] disabled:text-[var(--muted)] text-[var(--parchment)] px-4 py-3 rounded-sm font-bold uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed"
          >
            Recruit {selected.name} ({selected.cost} ducats)
          </button>
        </div>
      )}
    </div>
  )
}
