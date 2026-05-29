export function LongWarRules() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl mb-2">The Long War — Campaign Rules</h1>
        <p className="text-[var(--muted)]">
          Season-based grand strategy layer for Trench Crusade. All state lives on-chain.
        </p>
      </div>

      {/* Overview */}
      <Section title="Overview">
        <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--fg-secondary)]">
          <li>Campaigns host up to <strong>12 players</strong> on a Theatre (group of hex regions)</li>
          <li>Players enroll existing warbands — locked for the campaign duration</li>
          <li>Battles are fought on the tabletop, results reported on-chain</li>
          <li>The world permanently evolves based on collective campaign outcomes</li>
        </ul>
      </Section>

      {/* Campaign Lifecycle */}
      <Section title="Campaign Lifecycle">
        <ol className="list-decimal pl-5 space-y-2 text-sm text-[var(--fg-secondary)]">
          <li><strong>Theatre Selection</strong> — Admin defines a theatre from world regions, sets objectives</li>
          <li><strong>Campaign Creation</strong> — Player creates campaign (2-12 players, FFA or Teams)</li>
          <li><strong>Enrollment</strong> — Warbands join and are locked to the campaign</li>
          <li><strong>Turns</strong> — Battle → Post-Battle → Movement → Supply (repeat)</li>
          <li><strong>Conclusion</strong> — Victory by elimination or VP threshold</li>
          <li><strong>Season Resolution</strong> — Results compiled, world mutated</li>
        </ol>
      </Section>

      {/* Turn Structure */}
      <Section title="Turn Structure">
        <div className="space-y-4">
          <Phase number={1} name="Battle" color="var(--accent)">
            <ul className="list-disc pl-5 space-y-1">
              <li>Warbands on same/adjacent tiles may engage</li>
              <li>Battle played on tabletop, result reported on-chain</li>
              <li>VP awarded: Win +3, Loss +1, Draw +2 each</li>
              <li>Secondary objectives: Kill Leader +2 VP, Loot Resource +1 VP/turn</li>
            </ul>
          </Phase>

          <Phase number={2} name="Post-Battle" color="var(--sepia)">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Trauma</strong> — Injured models roll on the trauma table</li>
              <li><strong>XP</strong> — Survivors gain experience</li>
              <li><strong>Promotions</strong> — Elite upgrades at XP thresholds</li>
              <li><strong>Exploration</strong> — Winners loot the battlefield</li>
              <li><strong>Quartermaster</strong> — Spend ducats: recruit, equip, heal</li>
            </ul>
          </Phase>

          <Phase number={3} name="Movement" color="var(--olive)">
            <ul className="list-disc pl-5 space-y-1">
              <li>Move 1-3 hexes per turn</li>
              <li>Terrain cost: Plains/Steppe = 1, Forest/Med = 1, Mountain/Marsh = 2</li>
              <li>Iron Wall = impassable (except Iron Sultanate)</li>
              <li>Lock position for next turn's battle phase</li>
            </ul>
          </Phase>

          <Phase number={4} name="Supply" color="var(--brass)">
            <ul className="list-disc pl-5 space-y-1">
              <li>Logistics tick: resources flow to theatre regions</li>
              <li>Connected warbands: full resupply, ducats income, healing</li>
              <li>Cut-off warbands: no recruitment, no equipment, no healing, -1 morale</li>
            </ul>
          </Phase>
        </div>
      </Section>

      {/* Economy */}
      <Section title="War Economy">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                <th className="pb-2 pr-4">Resource</th>
                <th className="pb-2 pr-4">Source</th>
                <th className="pb-2">Role</th>
              </tr>
            </thead>
            <tbody className="text-[var(--fg-secondary)]">
              <tr className="border-b border-[var(--border)]">
                <td className="py-2 pr-4 font-bold text-red-400">Flesh</td>
                <td className="py-2 pr-4">Farms (northern regions)</td>
                <td className="py-2">Feeds armies, recruits models</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="py-2 pr-4 font-bold text-gray-300">Iron</td>
                <td className="py-2 pr-4">Mines (mountains, Iron Wall)</td>
                <td className="py-2">Arms and armours</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="py-2 pr-4 font-bold text-yellow-400">Powder</td>
                <td className="py-2 pr-4">Powder mills (eastern/Islamic regions)</td>
                <td className="py-2">Ammunition — the critical bottleneck</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-bold text-amber-300">Ducats</td>
                <td className="py-2 pr-4">Trade posts, markets (local only)</td>
                <td className="py-2">Currency for quartermaster — never transported</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--muted)] mt-3 italic">
          Production is intentionally below demand (~0.7x ratio). No region is self-sufficient.
          Supply line control is strategically vital.
        </p>
      </Section>

      {/* Victory */}
      <Section title="Victory Conditions">
        <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--fg-secondary)]">
          <li><strong>Elimination</strong> — Last team/player standing</li>
          <li><strong>VP Threshold</strong> — First to reach configurable VP total</li>
          <li><strong>Turn Limit</strong> (optional) — Highest VP when time runs out</li>
        </ul>
      </Section>

      {/* Seasons */}
      <Section title="Season System">
        <p className="text-sm text-[var(--fg-secondary)] mb-3">
          A season represents a period of the Great War. Multiple campaigns run on various theatres.
          At season end, the chain computes permanent world mutations:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--fg-secondary)]">
          <li><strong>Territory</strong> — Regions change hands based on campaign outcomes</li>
          <li><strong>Buildings</strong> — Battles damage structures; winners may build new ones</li>
          <li><strong>Supply Routes</strong> — Contested routes are disrupted (slower transit)</li>
          <li><strong>New Objectives</strong> — New theatres emerge from the new territorial situation</li>
          <li><strong>Warband Legacy</strong> — Surviving warbands carry everything forward; dead is dead</li>
        </ul>
      </Section>

      {/* Status */}
      <Section title="Implementation Status">
        <p className="text-xs text-[var(--muted)] mb-3 italic">This is a proof of concept. Some features are on-chain but not yet wired to the dApp.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                <th className="pb-2 pr-4">Feature</th>
                <th className="pb-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody className="text-[var(--fg-secondary)]">
              <StatusRow feature="Campaign lifecycle" status="done" />
              <StatusRow feature="Warband enrollment & locking" status="done" />
              <StatusRow feature="Battle challenge & reporting" status="done" />
              <StatusRow feature="Post-battle trauma, XP, promotion" status="done" />
              <StatusRow feature="Exploration & loot" status="done" />
              <StatusRow feature="Logistics simulation" status="done" />
              <StatusRow feature="Territory control" status="done" />
              <StatusRow feature="Theatre & objectives" status="done" />
              <StatusRow feature="Hex movement on theatre map" status="planned" />
              <StatusRow feature="Post-battle phase machine" status="planned" />
              <StatusRow feature="Auto VP from battle results" status="planned" />
              <StatusRow feature="Season system & world mutations" status="planned" />
              <StatusRow feature="DApp campaign flow (end-to-end)" status="wip" />
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-military p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted)] mb-3">{title}</h2>
      {children}
    </section>
  )
}

function Phase({ number, name, color, children }: { number: number; name: string; color: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 pl-4" style={{ borderColor: color }}>
      <h3 className="text-sm font-bold mb-1" style={{ color }}>
        Phase {number}: {name}
      </h3>
      <div className="text-sm text-[var(--fg-secondary)]">{children}</div>
    </div>
  )
}

function StatusRow({ feature, status }: { feature: string; status: 'done' | 'wip' | 'planned' }) {
  const badge = {
    done: { text: 'DONE', cls: 'text-[var(--olive)] border-[var(--olive)]' },
    wip: { text: 'WIP', cls: 'text-[var(--sepia)] border-[var(--sepia)]' },
    planned: { text: 'PLANNED', cls: 'text-[var(--muted)] border-[var(--muted)]' },
  }[status]

  return (
    <tr className="border-b border-[var(--border)]">
      <td className="py-1.5 pr-4">{feature}</td>
      <td className="py-1.5">
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 border rounded-sm ${badge.cls}`}>
          {badge.text}
        </span>
      </td>
    </tr>
  )
}
