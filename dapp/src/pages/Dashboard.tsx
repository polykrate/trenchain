import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet'
import { warband, campaign } from '../chain'
import type { WarbandMeta } from '../chain/warband'
import type { CampaignMeta } from '../chain/campaign'

interface FeatureCard {
  title: string
  description: string
  cta: string
  to: string
  image: string
}

const FEATURES: FeatureCard[] = [
  {
    title: 'Your Roster, Always Up to Date',
    description: 'Stop tracking ducats on sticky notes. Build your warband, equip battlekit, track injuries and promotions — all synced after every battle. Your campaign history lives here permanently.',
    cta: 'Build my Warband',
    to: '/warband/new',
    image: '/images/feature-warband.png',
  },
  {
    title: 'Every Rule, Instantly',
    description: 'Full searchable compendium — factions, units, weapons, keywords. No more flipping through PDFs mid-game. Check stats, resolve disputes, plan your next recruit in seconds.',
    cta: 'Browse the Compendium',
    to: '/compendium/factions',
    image: '/images/feature-compendium.png',
  },
  {
    title: 'Campaigns That Last',
    description: 'Join a theatre of war with real consequences. Your battles update the map, cut supply lines, and shift control. Win territory, build infrastructure, starve the enemy. A campaign that keeps going even when you skip a week.',
    cta: 'Enter the Long War',
    to: '/longwar',
    image: '/images/feature-longwar.png',
  },
]

function IconPlus() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function IconBook() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}
function IconGlobe() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}
function IconFlag() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}
function IconTrophy() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}
function IconHelp() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

const SHORTCUTS: { label: string; to: string; icon: React.ReactNode }[] = [
  { label: 'Create Warband', to: '/warband/new', icon: <IconPlus /> },
  { label: 'Compendium', to: '/compendium/factions', icon: <IconBook /> },
  { label: 'Theatres', to: '/longwar/theatres', icon: <IconGlobe /> },
  { label: 'Campaign', to: '/campaign', icon: <IconFlag /> },
  { label: 'Leaderboard', to: '/campaign/leaderboard', icon: <IconTrophy /> },
  { label: 'FAQ', to: '/faq', icon: <IconHelp /> },
]

function LandingView() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl mb-2 uppercase tracking-wider">Trench Crusade Campaign Manager</h1>
        <p className="text-[var(--fg)] font-medium mb-1">Track your warband. Fight for territory. Every battle counts.</p>
        <p className="text-sm text-[var(--fg-secondary)] leading-relaxed">
          A digital companion for Trench Crusade campaigns — roster management, persistent world-state, and automatic campaign tracking.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {FEATURES.map(feature => (
          <div key={feature.title} className="card-military flex flex-col">
            <div className="aspect-[16/10] bg-[var(--surface)] border-b border-[var(--border)] overflow-hidden">
              <img
                src={feature.image}
                alt={feature.title}
                className="w-full h-full object-cover object-center scale-110"
              />
            </div>
            <div className="p-6 flex flex-col flex-1">
              <h3 className="font-bold uppercase tracking-wider mb-3">{feature.title}</h3>
              <p className="text-[var(--fg-secondary)] leading-relaxed text-justify flex-1 mb-5">{feature.description}</p>
              <Link
                to={feature.to}
                className="inline-flex items-center gap-2 font-bold uppercase tracking-wider text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] group"
              >
                {feature.cta}
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ConnectedDashboard({ address }: { address: string }) {
  const [warbands, setWarbands] = useState<WarbandMeta[]>([])
  const [campaigns, setCampaigns] = useState<CampaignMeta[]>([])

  useEffect(() => {
    warband.getOwnedWarbands(address).then(setWarbands)
    campaign.getAllCampaigns().then(setCampaigns)
  }, [address])

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl mb-1 uppercase tracking-wider">Command Headquarters</h1>
          <p className="text-[var(--muted)]">
            {address.slice(0, 8)}...{address.slice(-6)}
          </p>
        </div>
        <Link
          to="/warband/new"
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-5 py-2.5 rounded-sm font-bold uppercase tracking-wider text-sm"
        >
          + New Warband
        </Link>
      </div>

      {/* Shortcuts */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {SHORTCUTS.map(s => (
          <Link
            key={s.to}
            to={s.to}
            className="card-military p-3 flex flex-col items-center justify-center hover:border-[var(--sepia)] transition-colors"
          >
            <div className="mb-1.5 text-[var(--sepia)]">{s.icon}</div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* My Warbands */}
        <div className="card-military p-5 flex flex-col">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-4">My Warbands</h2>
          {warbands.length === 0 ? (
            <p className="text-[var(--muted)] text-sm flex-1">No warbands yet.</p>
          ) : (
            <div className="space-y-3 flex-1">
              {warbands.map(w => (
                <Link key={w.id} to={`/warband/${w.id}`} className="block p-3 bg-[var(--surface)] border border-[var(--border)] rounded-sm hover:border-[var(--sepia)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">{w.name}</span>
                    <span className="text-xs text-[var(--sepia)]">{w.gamesPlayed} games</span>
                  </div>
                  <div className="flex gap-3 text-xs text-[var(--muted)]">
                    <span>{w.ducats} ducats</span>
                    <span>{w.glory} glory</span>
                    <span>{w.elites} elites</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Link to="/warband/my" className="text-xs font-bold uppercase text-[var(--accent)] mt-4 hover:underline">
            View All Warbands
          </Link>
        </div>

        {/* Active Campaigns & Battles */}
        <div className="card-military p-5 flex flex-col">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-4">Campaign Status</h2>

          {campaigns.length > 0 && (
            <div className="space-y-2 mb-4">
              {campaigns.map(c => (
                <div key={c.id} className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-sm">
                  <div className="font-bold mb-1">{c.name}</div>
                  <div className="flex gap-3 text-xs text-[var(--muted)]">
                    <span className="text-[var(--olive)]">{c.enrolledWarbands.length}/{c.maxWarbands} warbands</span>
                    <span>Game #{c.currentGame}</span>
                    <span className="uppercase">{c.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {campaigns.length === 0 && (
            <p className="text-[var(--muted)] text-sm flex-1">No active campaigns.</p>
          )}

          <Link to="/campaign" className="text-xs font-bold uppercase text-[var(--accent)] mt-4 hover:underline">
            Go to Campaign
          </Link>
        </div>

        {/* The Long War / Theatres */}
        <div className="card-military p-5 flex flex-col">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-4">The Long War</h2>

          <div className="space-y-3 flex-1">
            <Link
              to="/longwar"
              className="block p-4 bg-[var(--surface)] border border-[var(--border)] rounded-sm hover:border-[var(--sepia)] group"
            >
              <div className="flex items-center gap-3">
                <span className="text-[var(--sepia)]"><IconGlobe /></span>
                <div>
                  <div className="font-bold group-hover:text-[var(--accent)]">World Map</div>
                  <div className="text-xs text-[var(--muted)]">View all theatres of operations</div>
                </div>
              </div>
            </Link>

            <Link
              to="/longwar/theatres"
              className="block p-4 bg-[var(--surface)] border border-[var(--border)] rounded-sm hover:border-[var(--sepia)] group"
            >
              <div className="flex items-center gap-3">
                <span className="text-[var(--sepia)]"><IconFlag /></span>
                <div>
                  <div className="font-bold group-hover:text-[var(--accent)]">Theatres</div>
                  <div className="text-xs text-[var(--muted)]">List & create theatres</div>
                </div>
              </div>
            </Link>

            <Link
              to="/longwar/theatres/new"
              className="block p-4 bg-[var(--surface)] border border-[var(--border)] rounded-sm hover:border-[var(--sepia)] group"
            >
              <div className="flex items-center gap-3">
                <span className="text-[var(--sepia)]"><IconPlus /></span>
                <div>
                  <div className="font-bold group-hover:text-[var(--accent)]">Create Theatre</div>
                  <div className="text-xs text-[var(--muted)]">Design a new theatre of operations</div>
                </div>
              </div>
            </Link>
          </div>

          <div className="pt-4 border-t border-[var(--border)] mt-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Quick Access</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/compendium/entries" className="text-xs text-[var(--fg-secondary)] hover:text-[var(--accent)] p-2 bg-[var(--surface)] border border-[var(--border)] rounded-sm text-center">
                Units
              </Link>
              <Link to="/compendium/battlekits" className="text-xs text-[var(--fg-secondary)] hover:text-[var(--accent)] p-2 bg-[var(--surface)] border border-[var(--border)] rounded-sm text-center">
                Battlekits
              </Link>
              <Link to="/compendium/keywords" className="text-xs text-[var(--fg-secondary)] hover:text-[var(--accent)] p-2 bg-[var(--surface)] border border-[var(--border)] rounded-sm text-center">
                Keywords
              </Link>
              <Link to="/campaign/tournaments" className="text-xs text-[var(--fg-secondary)] hover:text-[var(--accent)] p-2 bg-[var(--surface)] border border-[var(--border)] rounded-sm text-center">
                Tournaments
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Dashboard() {
  const { address } = useWallet()

  if (address) {
    return <ConnectedDashboard address={address} />
  }

  return <LandingView />
}
