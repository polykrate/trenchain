export interface LoadStep {
  label: string
  status: 'pending' | 'loading' | 'done' | 'error'
  current?: number
  total?: number
}

const STATUS_ICON: Record<LoadStep['status'], string> = {
  pending: '○',
  loading: '◌',
  done: '●',
  error: '✗',
}

const STATUS_CLASS: Record<LoadStep['status'], string> = {
  pending: 'text-[var(--muted)]',
  loading: 'text-[var(--accent)] animate-pulse',
  done: 'text-green-500',
  error: 'text-red-400',
}

function formatCounter(step: LoadStep): string {
  if (step.status === 'done' && step.current != null) return `${step.label} — ${step.current}`
  if (step.status === 'loading' && step.current != null) return `${step.label} — ${step.current}...`
  if (step.current != null && step.total != null) return `${step.label} — ${step.current}/${step.total}`
  return step.label
}

interface ChainLoaderProps {
  steps: LoadStep[]
  title?: string
  skeletonCount?: number
}

export function ChainLoader({ steps, title, skeletonCount = 0 }: ChainLoaderProps) {
  const doneCount = steps.filter(s => s.status === 'done').length
  const progress = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0

  return (
    <div className="space-y-6 py-4">
      {/* Skeleton placeholders */}
      {skeletonCount > 0 && (
        <div className="space-y-2">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded border border-[var(--border)] bg-[var(--surface)] animate-pulse"
              style={{ opacity: 1 - i * 0.15 }}
            />
          ))}
        </div>
      )}

      {/* Loading indicator */}
      <div className="flex flex-col items-center justify-center gap-4 py-6">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 border-2 border-[var(--border)] rounded-full" />
          <div className="absolute inset-0 border-2 border-t-[var(--accent)] rounded-full animate-spin" />
        </div>

        {title && <p className="text-xs text-[var(--fg)] font-bold uppercase tracking-wider">{title}</p>}

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="w-40 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-[var(--muted)] w-12 text-right">
            {doneCount}/{steps.length}
          </span>
        </div>

        {/* Step log with dynamic counters */}
        <div className="font-mono text-[11px] space-y-0.5 max-w-xs w-full">
          {steps.map(s => (
            <div key={s.label} className={`flex items-center gap-2 ${STATUS_CLASS[s.status]}`}>
              <span className="w-3 text-center shrink-0">{STATUS_ICON[s.status]}</span>
              <span className="truncate">{formatCounter(s)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
