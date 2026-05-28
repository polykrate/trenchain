import { useEffect, useState, useRef } from 'react'
import { getChainClient, getActiveEndpoint } from '../hooks/useChainClient'

type Status = 'connecting' | 'connected' | 'disconnected'

export function ChainStatus() {
  const [status, setStatus] = useState<Status>('connecting')
  const [blockNumber, setBlockNumber] = useState<number | null>(null)
  const [endpoint, setEndpoint] = useState<string>('')
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const client = await getChainClient()
        if (cancelled) return
        setStatus('connected')
        setEndpoint(getActiveEndpoint())

        const unsub = await client.query.system.number((num: any) => {
          if (!cancelled) setBlockNumber(Number(num))
        })
        unsubRef.current = unsub as any
      } catch {
        if (!cancelled) setStatus('disconnected')
      }
    })()

    return () => {
      cancelled = true
      unsubRef.current?.()
    }
  }, [])

  const isLocal = endpoint.includes('127.0.0.1') || endpoint.includes('localhost')
  const polkadotJsUrl = `https://polkadot.js.org/apps/?rpc=${encodeURIComponent(endpoint)}#/explorer`

  const dotColor = status === 'connected'
    ? 'bg-[var(--olive)]'
    : status === 'connecting'
      ? 'bg-[var(--brass)] animate-pulse'
      : 'bg-red-500'

  const label = status === 'connected'
    ? `#${blockNumber ?? '...'}`
    : status === 'connecting'
      ? '...'
      : 'offline'

  return (
    <a
      href={status === 'connected' ? polkadotJsUrl : undefined}
      target="_blank"
      rel="noopener noreferrer"
      title={status === 'connected'
        ? `Connected to ${isLocal ? 'local' : 'remote'} node — Open in Polkadot.js`
        : status === 'connecting'
          ? 'Connecting to chain...'
          : 'Chain disconnected'
      }
      className={`flex items-center gap-1.5 text-xs font-mono border border-[var(--border)] rounded-sm px-2 py-1 transition-colors ${
        status === 'connected'
          ? 'hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer'
          : 'cursor-default'
      }`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
      <span className="text-[var(--muted)]">{label}</span>
      {status === 'connected' && !isLocal && (
        <span className="text-[9px] text-[var(--brass)] uppercase font-bold">ngrok</span>
      )}
    </a>
  )
}
