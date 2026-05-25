export interface StepDef {
  label: string
  description?: string
}

interface StepperProps {
  steps: StepDef[]
  currentStep: number
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="flex items-center w-full mb-8">
      {steps.map((step, i) => {
        const state = i < currentStep ? 'completed' : i === currentStep ? 'active' : 'upcoming'
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                  state === 'completed'
                    ? 'bg-[var(--olive)] border-[var(--olive)] text-[var(--parchment)]'
                    : state === 'active'
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--parchment)]'
                      : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)]'
                }`}
              >
                {state === 'completed' ? '✓' : i + 1}
              </div>
              <span
                className={`mt-1.5 text-xs uppercase tracking-wider whitespace-nowrap ${
                  state === 'active' ? 'text-[var(--accent)] font-bold' : 'text-[var(--muted)]'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-3 mt-[-1rem] ${
                  i < currentStep ? 'bg-[var(--olive)]' : 'bg-[var(--border)]'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
