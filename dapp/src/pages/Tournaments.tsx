import { useEffect, useState } from 'react'
import type { Tournament } from '../chain/types'
import { territory } from '../chain'

export function Tournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])

  useEffect(() => {
    territory.getTournaments().then(setTournaments)
  }, [])

  return (
    <div>
      <h1 className="text-2xl mb-6">Tournaments</h1>

      {tournaments.map(t => (
        <div key={t.id} className="card-military p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold uppercase tracking-wider">{t.name}</h2>
            <StatusBadge status={t.status} />
          </div>

          <p className="text-[var(--muted)] mb-4">
            {t.participants.length} participants
          </p>

          <div className="space-y-4">
            {t.rounds.map(round => (
              <div key={round.round_number}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">
                  Round {round.round_number}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {round.matches.map((m, i) => (
                    <div key={i} className="card-military p-3 flex justify-between items-center">
                      <span>#{m.warband_a} vs #{m.warband_b}</span>
                      {m.winner ? (
                        <span className="text-[var(--olive)] font-bold">Winner: #{m.winner}</span>
                      ) : (
                        <span className="text-[var(--brass)] font-bold">Pending</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {t.status === 'registration' && (
            <button className="mt-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-2 rounded-sm font-bold uppercase tracking-wider cursor-pointer">
              Register Warband
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: Tournament['status'] }) {
  const styles = {
    registration: 'border-[var(--brass)] text-[var(--brass)]',
    in_progress: 'border-[var(--olive)] text-[var(--olive)]',
    completed: 'border-[var(--sepia)] text-[var(--sepia)]',
  }
  return (
    <span className={`badge-faction ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
