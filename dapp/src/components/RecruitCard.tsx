import type { Recruit } from '../chain/types'

export function RecruitCard({ recruit, slot }: { recruit: Recruit; slot: number }) {
  return (
    <div className="border border-white/10 rounded-lg p-3 bg-[var(--color-surface-alt)]">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">{recruit.name}</h4>
        <span className="text-xs text-[var(--color-muted)]">Slot #{slot}</span>
      </div>
      <p className="text-xs text-[var(--color-muted)] mt-1">Entry #{recruit.entry_id}</p>
      <div className="mt-2 flex gap-3 text-xs">
        <span>XP: <strong>{recruit.xp}</strong></span>
        <span>Scars: <strong>{recruit.battle_scars}</strong></span>
        <span>Items: <strong>{recruit.items.length}</strong></span>
        <span>Skills: <strong>{recruit.skills.length}</strong></span>
      </div>
      {recruit.battle_scars >= 2 && (
        <div className="mt-2 text-xs text-yellow-400">
          Warning: {3 - recruit.battle_scars} scar(s) left before unfit for duty
        </div>
      )}
    </div>
  )
}
