import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { MatchResult, Warband } from '../chain/types'
import { warband as warbandApi, territory } from '../chain'
import { RecruitCard } from '../components/RecruitCard'
import { MatchReport } from '../components/MatchReport'
import { factions } from '../data'

export function WarbandView() {
  const { id } = useParams<{ id: string }>()
  const [wb, setWb] = useState<Warband | null>(null)
  const [matches, setMatches] = useState<MatchResult[]>([])

  useEffect(() => {
    if (!id) return
    warbandApi.getWarband(Number(id)).then(setWb)
    territory.getMatchHistory(Number(id)).then(setMatches)
  }, [id])

  if (!wb) return <div className="text-center py-16 text-[var(--muted)]">Loading...</div>

  const faction = factions.find(f => f.id === wb.faction)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl">{wb.name}</h1>
          <p className="text-[var(--muted)]">
            {faction?.name ?? `Faction #${wb.faction}`} — Owner: {wb.owner.slice(0, 8)}...
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
          <div className="stat-value">{wb.roster.length}</div>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-4">Roster</h2>
        {wb.roster.length === 0 ? (
          <p className="text-[var(--muted)] italic">No recruits yet. Add models to your roster.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {wb.roster.map((r, i) => (
              <RecruitCard key={i} recruit={r} slot={i} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-4">Match History</h2>
        {matches.length === 0 ? (
          <p className="text-[var(--muted)] italic">No battles fought yet.</p>
        ) : (
          <div className="space-y-2">
            {matches.map(m => (
              <MatchReport key={m.id} match={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
