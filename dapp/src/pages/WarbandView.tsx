import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { warband as warbandApi, roster as rosterApi } from '../chain'
import type { WarbandMeta } from '../chain/warband'
import type { Recruit } from '../chain/roster'
import { useChainFactions } from '../hooks/useChainData'

export function WarbandView() {
  const { id } = useParams<{ id: string }>()
  const [wb, setWb] = useState<WarbandMeta | null>(null)
  const [rosterList, setRosterList] = useState<Recruit[]>([])
  const { factions } = useChainFactions()

  useEffect(() => {
    if (!id) return
    warbandApi.getWarband(Number(id)).then(setWb)
    rosterApi.getRoster(Number(id)).then(setRosterList)
  }, [id])

  if (!wb) return <div className="text-center py-16 text-[var(--muted)]">Loading...</div>

  const faction = factions.find(f => f.code === wb.faction)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl">{wb.name}</h1>
          <p className="text-[var(--muted)]">
            {faction?.name ?? wb.faction} — Owner: {wb.owner.slice(0, 8)}...
          </p>
        </div>
        <Link
          to={`/warband/${wb.id}/recruit`}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-2 rounded-sm font-bold uppercase tracking-wider"
        >
          + Recruit
        </Link>
      </div>

      <div className="stat-block mb-8">
        <div className="stat-item">
          <div className="stat-label">Ducats</div>
          <div className="stat-value">{wb.ducats}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Glory</div>
          <div className="stat-value">{wb.glory}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Elites</div>
          <div className="stat-value">{wb.elites}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Roster</div>
          <div className="stat-value">{rosterList.length}</div>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-4">Roster</h2>
        {rosterList.length === 0 ? (
          <p className="text-[var(--muted)] italic">No recruits yet. Add models to your roster.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rosterList.map((r, i) => (
              <div key={i} className="card-military p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">{r.name}</span>
                  {r.isElite && <span className="text-xs font-bold text-[var(--brass)]">ELITE</span>}
                </div>
                <div className="text-xs text-[var(--muted)]">{r.entryCode}</div>
                <div className="flex gap-4 mt-2 text-xs">
                  <span>XP: {r.xp}</span>
                  <span>Scars: {r.battleScars}</span>
                  {r.items.length > 0 && <span>Items: {r.items.join(', ')}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
