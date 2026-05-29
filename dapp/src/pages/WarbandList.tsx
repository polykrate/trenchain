import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { warband as warbandApi } from '../chain'
import type { WarbandMeta } from '../chain/warband'
import { ChainLoader } from '../components/ChainLoader'
import { Keyring } from '@polkadot/keyring'
import { cryptoWaitReady } from '@polkadot/util-crypto'

export function WarbandList() {
  const [warbands, setWarbands] = useState<WarbandMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        await cryptoWaitReady()
        const keyring = new Keyring({ type: 'sr25519' })
        const alice = keyring.addFromUri('//Alice')
        const owned = await warbandApi.getOwnedWarbands(alice.address)
        setWarbands(owned)
      } catch (e) {
        console.error('Failed to load warbands:', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <ChainLoader title="My Warbands" skeletonCount={2} steps={[
    { label: 'Loading warbands', status: 'loading' },
  ]} />

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl">My Warbands</h1>
          <p className="text-[var(--muted)]">Manage your war companies.</p>
        </div>
        <Link
          to="/warband/new"
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-2.5 rounded-sm font-bold uppercase tracking-wider text-sm"
        >
          + Muster New
        </Link>
      </div>

      <div className="space-y-4">
        {warbands.map(wb => (
          <Link
            key={wb.id}
            to={`/warband/${wb.id}`}
            className="card-military block p-5 hover:border-[var(--sepia)]"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold uppercase tracking-wider">{wb.name}</h3>
              <span className={`text-xs font-bold uppercase px-2 py-0.5 border rounded-sm ${
                wb.locked
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-[var(--olive)] text-[var(--olive)]'
              }`}>
                {wb.locked ? 'In Campaign' : 'Available'}
              </span>
            </div>
            <div className="flex gap-4 text-xs text-[var(--muted)]">
              <span>Faction: {wb.faction}</span>
              <span>Ducats: {wb.ducats}</span>
              <span>Glory: {wb.glory}</span>
              <span>Games: {wb.gamesPlayed}</span>
            </div>
          </Link>
        ))}

        {warbands.length === 0 && (
          <div className="card-military p-8 text-center">
            <p className="text-[var(--muted)] mb-4">No warbands yet. Muster your first war company!</p>
            <Link
              to="/warband/new"
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-2.5 rounded-sm font-bold uppercase tracking-wider text-sm"
            >
              Muster Warband
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
