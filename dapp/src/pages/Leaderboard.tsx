import { useEffect, useState } from 'react'
import { territory, warband as warbandApi } from '../chain'
import { useChainFactions } from '../hooks/useChainData'
import { decodeBytes, decodeCode } from '../lib/chainCodec'
import { getChainClient } from '../hooks/useChainClient'

interface LeaderboardRow {
  warbandId: number;
  name: string;
  faction: string;
  glory: number;
  gamesPlayed: number;
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardRow[]>([])
  const { factions } = useChainFactions()

  useEffect(() => {
    (async () => {
      const client = await getChainClient();
      const raw = await client.query.warband.warbands.entries();
      const rows: LeaderboardRow[] = raw.map(([key, value]) => {
        const v = value as any;
        return {
          warbandId: key as any as number,
          name: decodeBytes(v.name),
          faction: decodeCode(v.faction),
          glory: v.glory ?? 0,
          gamesPlayed: v.gamesPlayed ?? 0,
        };
      });
      rows.sort((a, b) => b.glory - a.glory);
      setEntries(rows.slice(0, 20));
    })();
  }, [])

  return (
    <div>
      <h1 className="text-2xl mb-6">Glory Leaderboard</h1>

      {entries.length === 0 ? (
        <p className="text-[var(--muted)] italic">No warbands yet. Be the first to muster!</p>
      ) : (
        <div className="card-military overflow-hidden">
          <table className="table-military">
            <thead>
              <tr>
                <th>#</th>
                <th>Warband</th>
                <th>Faction</th>
                <th className="text-right">Glory</th>
                <th className="text-right">Games</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const faction = factions.find(f => f.code === e.faction)
                return (
                  <tr key={e.warbandId}>
                    <td className="font-mono">{i + 1}</td>
                    <td className="font-bold">{e.name}</td>
                    <td className="text-[var(--muted)]">{faction?.name ?? e.faction}</td>
                    <td className="text-right font-mono text-[var(--brass)] font-bold">{e.glory}</td>
                    <td className="text-right font-mono">{e.gamesPlayed}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
