import type { MatchResult } from '../chain/types'

export function MatchReport({ match }: { match: MatchResult }) {
  const date = new Date(match.timestamp).toLocaleDateString()
  const isWin = match.winner === match.warband_a

  return (
    <div className="border border-white/10 rounded p-3 flex items-center justify-between text-sm bg-[var(--color-surface-alt)]">
      <div>
        <span className="font-mono text-xs text-[var(--color-muted)]">{date}</span>
        <div className="mt-1">
          Warband #{match.warband_a} vs #{match.warband_b}
        </div>
      </div>
      <div className="text-right">
        <div className={`font-bold ${isWin ? 'text-green-400' : match.winner === null ? 'text-yellow-400' : 'text-red-400'}`}>
          {match.winner === null ? 'DRAW' : isWin ? 'VICTORY' : 'DEFEAT'}
        </div>
        <div className="text-xs text-[var(--color-muted)]">
          Glory: +{match.glory_a}
        </div>
      </div>
    </div>
  )
}
