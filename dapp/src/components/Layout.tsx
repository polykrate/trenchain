import { Outlet, NavLink } from 'react-router-dom'
import { Nav } from './Nav'
import { useWallet } from '../hooks/useWallet'

export function Layout() {
  const { address, connect, disconnect } = useWallet()

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-[var(--bg)]">
      {/* Topbar */}
      <header className="flex items-stretch border-b border-[var(--border)] bg-[var(--card)]">
        <div className="w-56 flex items-center px-5 py-3 border-r border-[var(--border)]">
          <a href="/" className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--accent)]">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity="0.85" />
              <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-bold tracking-wider uppercase text-[var(--fg)]">Trenchain</span>
          </a>
        </div>

        <div className="flex-1 flex items-center justify-end px-6 gap-4">
          <span className="text-[0.65rem] text-[var(--muted)] font-bold tracking-widest uppercase border border-[var(--border)] px-2 py-0.5 rounded-sm">testnet</span>
          <div className="w-px h-5 bg-[var(--border)]" />
          {address ? (
            <button
              onClick={disconnect}
              className="text-sm font-bold px-3 py-1.5 border border-[var(--border)] rounded-sm text-[var(--fg)] hover:bg-[var(--surface)] cursor-pointer flex items-center gap-2 tracking-wide"
            >
              <span className="w-2 h-2 rounded-full bg-[var(--olive)]" />
              {address.slice(0, 6)}...{address.slice(-4)}
            </button>
          ) : (
            <button
              onClick={connect}
              className="text-sm font-bold px-4 py-1.5 rounded-sm bg-[var(--accent)] text-[var(--parchment)] hover:bg-[var(--accent-hover)] cursor-pointer tracking-wide uppercase"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex-1 flex min-h-0">
        <Nav address={address} />
        <main className="flex-1 overflow-y-auto bg-[var(--bg)]">
          <div className="max-w-[1100px] mx-auto px-10 py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Footer: shared across sidebar + main */}
      <footer className="flex items-stretch border-t border-[var(--border)] bg-[var(--card)]">
        <div className="w-56 border-r border-[var(--border)] px-5 py-2.5 flex items-center gap-4">
          <NavLink
            to="/faq"
            className={({ isActive }) =>
              `flex items-center gap-2 text-sm ${isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`
            }
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            FAQ
          </NavLink>
          <span className="flex items-center gap-2 text-sm text-[var(--muted)] opacity-50 cursor-not-allowed">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Support
            <span className="badge-soon">soon</span>
          </span>
        </div>
        <div className="flex-1 px-6 py-2.5 flex items-center justify-between">
          <span className="text-xs text-[var(--muted)]">
            GPL-3.0
          </span>
          <span className="text-xs text-[var(--muted)] font-mono">
            v0.1.0
          </span>
        </div>
      </footer>
    </div>
  )
}
