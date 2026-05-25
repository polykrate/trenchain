import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { WarbandEntry } from '../chain/types'
import { entry as entryApi, roster as rosterApi, warband as warbandApi } from '../chain'

export function Recruit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<WarbandEntry[]>([])
  const [selected, setSelected] = useState<WarbandEntry | null>(null)
  const [recruitName, setRecruitName] = useState('')

  useEffect(() => {
    if (!id) return
    warbandApi.getWarband(Number(id)).then(wb => {
      if (wb) entryApi.getEntriesByFaction(wb.faction).then(setEntries)
    })
  }, [id])

  const handleRecruit = async () => {
    if (!id || !selected || !recruitName.trim()) return
    await rosterApi.recruit(Number(id), selected.id, recruitName, [])
    navigate(`/warband/${id}`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Recruit a Model</h1>

      <div className="space-y-4 mb-6">
        {entries.map(e => (
          <button
            key={e.id}
            onClick={() => { setSelected(e); setRecruitName('') }}
            className={`w-full border rounded-lg p-4 text-left transition-colors ${
              selected?.id === e.id ? 'border-red-500 bg-red-500/10' : 'border-white/10 hover:border-white/30'
            }`}
          >
            <div className="flex justify-between">
              <span className="font-semibold">{e.name}</span>
              <span className="text-sm font-mono">{e.cost} ducats</span>
            </div>
            <p className="text-xs text-[var(--color-muted)] mt-1">{e.description}</p>
            <div className="mt-2 flex gap-4 text-xs text-[var(--color-muted)]">
              <span>Mvt: {e.profile.movement_inches}"</span>
              <span>Ranged: {e.profile.ranged ?? '-'}</span>
              <span>Melee: {e.profile.melee ?? '-'}</span>
              <span>Armour: {e.profile.armour}</span>
              {e.max_count && <span className="text-yellow-400">Limit: {e.max_count}</span>}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="border-t border-white/10 pt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--color-muted)]">
              Name your {selected.name}
            </label>
            <input
              type="text"
              value={recruitName}
              onChange={e => setRecruitName(e.target.value)}
              placeholder="Give them a name..."
              className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            />
          </div>
          <button
            onClick={handleRecruit}
            disabled={!recruitName.trim()}
            className="w-full bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-3 rounded font-medium transition-colors"
          >
            Recruit {selected.name} ({selected.cost} ducats)
          </button>
        </div>
      )}
    </div>
  )
}
