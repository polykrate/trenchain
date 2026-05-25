import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { theatre } from '../chain'
import type { Theatre } from '../chain/theatre'

export function TheatreList() {
  const [theatres, setTheatres] = useState<Theatre[]>([])

  useEffect(() => {
    theatre.getTheatres().then(setTheatres)
  }, [])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl">Theatres of Operations</h1>
          <p className="text-[var(--muted)]">Active and planned theatres across the Great War.</p>
        </div>
        <Link
          to="/longwar/theatres/new"
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-2.5 rounded-sm font-bold uppercase tracking-wider text-sm"
        >
          + New Theatre
        </Link>
      </div>

      <div className="space-y-4">
        {theatres.map(t => (
          <Link
            key={t.id}
            to={`/longwar/theatre/${t.id}`}
            className="card-military block p-5 hover:border-[var(--sepia)]"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold uppercase tracking-wider">{t.name}</h3>
              <span className={`text-xs font-bold uppercase px-2 py-0.5 border rounded-sm ${
                t.status === 'active'
                  ? 'border-[var(--olive)] text-[var(--olive)]'
                  : t.status === 'draft'
                    ? 'border-[var(--sepia)] text-[var(--sepia)]'
                    : 'border-[var(--muted)] text-[var(--muted)]'
              }`}>
                {t.status}
              </span>
            </div>
            <p className="text-[var(--fg-secondary)] mb-2">{t.description}</p>
            <div className="flex gap-4 text-xs text-[var(--muted)]">
              <span>Region: {t.region}</span>
              <span>Nodes: {t.graph.nodes.length}</span>
              <span>Map: {t.map_cid ? 'Uploaded' : 'Pending'}</span>
            </div>
          </Link>
        ))}

        {theatres.length === 0 && (
          <div className="card-military p-8 text-center">
            <p className="text-[var(--muted)]">No theatres created yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
