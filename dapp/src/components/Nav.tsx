import { NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'

interface MenuItem {
  to: string
  label: string
  disabled?: boolean
}

interface MenuSection {
  id: string
  label: string
  icon: React.ReactNode
  items: MenuItem[]
}

function IconBook() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function IconSword() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5" /><path d="M13 19l6-6" /><path d="M16 16l4 4" /><path d="M19 21l2-2" />
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

function IconGlobe() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

const menu: MenuSection[] = [
  {
    id: 'compendium',
    label: 'Compendium',
    icon: <IconBook />,
    items: [
      { to: '/compendium/factions', label: 'Factions' },
      { to: '/compendium/entries', label: 'Units' },
      { to: '/compendium/battlekits', label: 'Battlekits' },
      { to: '/compendium/keywords', label: 'Keywords' },
    ],
  },
  {
    id: 'warband',
    label: 'Warband',
    icon: <IconSword />,
    items: [
      { to: '/warband/new', label: 'Create Warband' },
      { to: '/warband/my', label: 'My Warbands' },
    ],
  },
  {
    id: 'campaign',
    label: 'Campaign',
    icon: <IconFlag />,
    items: [
      { to: '/campaign', label: 'Active Campaign' },
      { to: '/campaign/join', label: 'Join / Create' },
      { to: '/campaign/leaderboard', label: 'Leaderboard' },
      { to: '/campaign/tournaments', label: 'Tournaments' },
    ],
  },
  {
    id: 'longwar',
    label: 'The Long War',
    icon: <IconGlobe />,
    items: [
      { to: '/longwar', label: 'World Map' },
      { to: '/longwar/logistics', label: 'Logistics' },
      { to: '/longwar/theatres', label: 'Theatres' },
    ],
  },
]

interface NavProps {
  address: string | null
}

export function Nav({ address }: NavProps) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function toggle(id: string) {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function isSectionActive(section: MenuSection) {
    return section.items.some(item => location.pathname.startsWith(item.to))
  }

  function isItemActive(to: string, sectionItems: MenuItem[]) {
    if (location.pathname === to) return true
    const hasChildPaths = sectionItems.some(i => i.to !== to && i.to.startsWith(to + '/'))
    if (hasChildPaths) return false
    return location.pathname.startsWith(to + '/')
  }

  return (
    <aside className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--card)] flex flex-col">
      {/* Sections */}
      <nav className="flex-1 py-4 px-3 space-y-2 overflow-y-auto">
        {menu.map(section => {
          const active = isSectionActive(section)
          const isOpen = !(collapsed[section.id] ?? false)

          return (
            <div key={section.id} className="space-y-1">
              <button
                onClick={() => toggle(section.id)}
                className="sidebar-section-header w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg text-[var(--fg)] font-medium cursor-pointer select-none hover:bg-[var(--surface)]"
              >
                <div className="flex items-center gap-2">
                  <span className={active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}>{section.icon}</span>
                  <span className="text-sm">{section.label}</span>
                </div>
                <svg
                  className="sidebar-chevron w-4 h-4 text-[var(--muted)]"
                  data-open={isOpen}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9L12 15L18 9" />
                </svg>
              </button>

              <div className="sidebar-section-items" data-collapsed={!isOpen}>
                <div>
                  <div className="flex flex-col gap-0.5 pt-1">
                    {section.items.map(item =>
                      item.disabled ? (
                        <div key={item.to} className="flex items-center gap-1.5 pl-9 pr-3 py-2 text-sm text-[var(--muted)] opacity-40 cursor-not-allowed">
                          <span>{item.label}</span>
                          <span className="text-[9px] uppercase tracking-wider font-medium">soon</span>
                        </div>
                      ) : (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={() => {
                            const base = 'sidebar-nav-link block pl-9 pr-3 py-2 text-sm rounded-r-lg'
                            return isItemActive(item.to, section.items)
                              ? `${base} text-[var(--accent)] font-medium`
                              : `${base} text-[var(--muted)] hover:text-[var(--accent)]`
                          }}
                          data-active={isItemActive(item.to, section.items) ? 'true' : undefined}
                        >
                          {item.label}
                        </NavLink>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      {/* Sidebar footer: connected account */}
      {address && (
        <div className="border-t border-[var(--border)] px-3 py-3">
          <div className="flex items-center gap-2 px-2 py-2 rounded-sm bg-[var(--surface)]">
            <span className="w-2 h-2 rounded-full bg-[var(--olive)] shrink-0" />
            <span className="text-xs text-[var(--fg)] font-mono truncate">
              {address.slice(0, 8)}...{address.slice(-6)}
            </span>
          </div>
        </div>
      )}
    </aside>
  )
}
