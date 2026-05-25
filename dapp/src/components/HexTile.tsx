import type { HexRegion } from '../chain/types'

const FACTION_COLORS: Record<number, string> = {
  1: 'bg-purple-900/60 border-purple-500',
  2: 'bg-amber-900/60 border-amber-500',
  3: 'bg-blue-900/60 border-blue-500',
  4: 'bg-emerald-900/60 border-emerald-500',
  5: 'bg-rose-900/60 border-rose-500',
  6: 'bg-slate-900/60 border-slate-500',
}

export function HexTile({ region, onClick }: { region: HexRegion; onClick?: () => void }) {
  const colorClass = region.controller
    ? FACTION_COLORS[region.controller] ?? 'bg-gray-800 border-gray-600'
    : 'bg-gray-800/40 border-gray-600 border-dashed'

  return (
    <button
      onClick={onClick}
      className={`relative w-28 h-28 border-2 rounded-lg p-2 flex flex-col justify-between transition-all hover:scale-105 ${colorClass}`}
    >
      <div className="text-xs font-bold leading-tight">{region.name}</div>
      <div className="text-[10px] text-[var(--color-muted)]">
        {region.controller ? `Faction #${region.controller}` : 'Neutral'}
      </div>
      <div className="flex justify-between text-[10px]">
        <span>+{region.resource_output}/turn</span>
        {region.contested && <span className="text-red-400">CONTESTED</span>}
      </div>
    </button>
  )
}
