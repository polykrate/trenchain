import { useEffect, useState } from 'react'
import type { LeaderboardEntry } from '../chain/types'
import { territory } from '../chain'
import { factions } from '../data'

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    territory.getLeaderboard().then(setEntries)
  }, [])

  return (
    <div>
      <h1 className="text-2xl mb-6">Glory Leaderboard</h1>

      <div className="card-military overflow-hidden">
        <table className="table-military">
          <thead>
            <tr>
              <th>#</th>
              <th>Warband</th>
              <th>Faction</th>
              <th className="text-right">Glory</th>
              <th className="text-right">W/L</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const faction = factions.find(f => f.id === e.faction)
              return (
                <tr key={e.warband_id}>
                  <td className="font-mono">{i + 1}</td>
                  <td className="font-bold">{e.warband_name}</td>
                  <td className="text-[var(--muted)]">{faction?.name ?? `#${e.faction}`}</td>
                  <td className="text-right font-mono text-[var(--brass)] font-bold">{e.glory}</td>
                  <td className="text-right font-mono">
                    <span className="text-[var(--olive)]">{e.wins}</span>
                    /
                    <span className="text-[var(--accent)]">{e.losses}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
