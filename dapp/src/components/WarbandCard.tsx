import { Link } from 'react-router-dom'
import type { Warband } from '../chain/types'

export function WarbandCard({ warband }: { warband: Warband }) {
  return (
    <Link
      to={`/warband/${warband.id}`}
      className="block border border-white/10 rounded-lg p-4 hover:border-red-500/50 transition-colors bg-[var(--color-surface-alt)]"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-lg">{warband.name}</h3>
          <p className="text-sm text-[var(--color-muted)]">Faction #{warband.faction} — Patron #{warband.patron}</p>
        </div>
        <span className="text-xs bg-red-900/40 text-red-300 px-2 py-0.5 rounded">
          ID: {warband.id}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
        <Stat label="Ducats" value={`${warband.ducats}`} />
        <Stat label="Glory" value={`${warband.glory}`} />
        <Stat label="Elites" value={`${warband.elites}`} />
        <Stat label="Roster" value={`${warband.roster.length}`} />
      </div>
    </Link>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[var(--color-muted)] text-xs">{label}</div>
      <div className="font-mono font-bold">{value}</div>
    </div>
  )
}
