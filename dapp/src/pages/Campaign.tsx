import { useEffect, useState } from 'react'
import { campaign } from '../chain'
import type {
  ActiveCampaign,
  CampaignWarband,
  PendingBattle,
  ModelCasualty,
  PostBattleState,
  BattleResult,
  PostBattlePhase,
} from '../chain/campaign'
import { territory } from '../chain'
import type { CampaignLocation, Recruit } from '../chain/types'
import { Stepper } from '../components/Stepper'

type View = 'select_campaign' | 'campaign_hub' | 'challenge' | 'report' | 'post_battle'

const REPORT_STEPS = [
  { label: 'Select Battle' },
  { label: 'Result' },
  { label: 'Casualties' },
  { label: 'Confirm' },
]

const POST_BATTLE_PHASES: { key: PostBattlePhase; label: string; desc: string }[] = [
  { key: 'trauma', label: 'Trauma', desc: 'Roll for injured models — determine survival and battle scars' },
  { key: 'promotions', label: 'Promotions', desc: 'Spend XP, learn new skills from patron' },
  { key: 'reinforcements', label: 'Reinforcements', desc: 'Recruit replacement models' },
  { key: 'exploration', label: 'Exploration', desc: 'Discover loot in surrounding territory' },
  { key: 'quartermaster', label: 'Quartermaster', desc: 'Buy/sell battlekit, equip models' },
  { key: 'done', label: 'Complete', desc: 'Unlock warband for next battle' },
]

export function Campaign() {
  const [view, setView] = useState<View>('select_campaign')
  const [campaigns, setCampaigns] = useState<ActiveCampaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<ActiveCampaign | null>(null)
  const [myWarbands, setMyWarbands] = useState<CampaignWarband[]>([])
  const [pendingBattles, setPendingBattles] = useState<PendingBattle[]>([])
  const [mapLocations, setMapLocations] = useState<CampaignLocation[]>([])

  // Challenge state
  const [challengeWarband, setChallengeWarband] = useState<number | null>(null)
  const [challengeLocation, setChallengeLocation] = useState<number | null>(null)

  // Report state
  const [reportStep, setReportStep] = useState(0)
  const [selectedBattle, setSelectedBattle] = useState<PendingBattle | null>(null)
  const [reportWarband, setReportWarband] = useState<number | null>(null)
  const [roster, setRoster] = useState<Recruit[]>([])
  const [winner, setWinner] = useState<number | null>(null)
  const [loserRoute, setLoserRoute] = useState(false)
  const [casualties, setCasualties] = useState<ModelCasualty[]>([])
  const [submitted, setSubmitted] = useState(false)

  // Post-battle state
  const [postBattleWarband, setPostBattleWarband] = useState<CampaignWarband | null>(null)
  const [postBattleState, setPostBattleState] = useState<PostBattleState | null>(null)
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null)

  useEffect(() => {
    campaign.getActiveCampaigns().then(setCampaigns)
  }, [])

  useEffect(() => {
    if (selectedCampaign) {
      campaign.getMyWarbandsInCampaign(selectedCampaign.id, 'mock_owner').then(setMyWarbands)
      campaign.getPendingBattles(selectedCampaign.id).then(setPendingBattles)
      territory.getCampaignMap().then(setMapLocations)
    }
  }, [selectedCampaign])

  function selectCampaign(c: ActiveCampaign) {
    setSelectedCampaign(c)
    setView('campaign_hub')
  }

  async function handleChallenge() {
    if (!selectedCampaign || challengeWarband === null || challengeLocation === null) return
    await campaign.challengeLocation(selectedCampaign.id, challengeLocation, challengeWarband)
    campaign.getPendingBattles(selectedCampaign.id).then(setPendingBattles)
    campaign.getMyWarbandsInCampaign(selectedCampaign.id, 'mock_owner').then(setMyWarbands)
    setView('campaign_hub')
    setChallengeWarband(null)
    setChallengeLocation(null)
  }

  async function startReport(battle: PendingBattle) {
    setSelectedBattle(battle)
    setReportStep(1)
    const myW = battle.challenger_warband === 1 ? battle.challenger_warband : battle.defender_warband!
    setReportWarband(myW)
    const r = await campaign.getWarbandRoster(myW)
    setRoster(r)
    setCasualties(r.map((rec, i) => ({
      recruit_index: i,
      name: rec.name,
      out_of_action: false,
      killed: false,
    })))
  }

  async function handleSubmitReport() {
    if (!selectedBattle || reportWarband === null) return
    await campaign.submitBattleReport({
      battle_id: selectedBattle.id,
      reporter_warband: reportWarband,
      winner: winner,
      loser_route: loserRoute,
      my_casualties: casualties.filter(c => c.out_of_action || c.killed),
    })
    setSubmitted(true)
  }

  async function openPostBattle(w: CampaignWarband) {
    if (!w.pending_battle_id) return
    setPostBattleWarband(w)
    const [state, result] = await Promise.all([
      campaign.getPostBattleState(w.id, w.pending_battle_id),
      campaign.getBattleResult(w.pending_battle_id),
    ])
    setPostBattleState(state)
    setBattleResult(result)
    setView('post_battle')
  }

  async function advancePhase(phase: PostBattlePhase) {
    if (!postBattleWarband || !postBattleWarband.pending_battle_id) return
    const newState = await campaign.advancePostBattle(
      postBattleWarband.id,
      postBattleWarband.pending_battle_id,
      phase,
      {},
    )
    setPostBattleState(newState)
  }

  async function completePostBattle() {
    if (!postBattleWarband || !postBattleWarband.pending_battle_id) return
    await campaign.completePostBattle(postBattleWarband.id, postBattleWarband.pending_battle_id)
    setView('campaign_hub')
    if (selectedCampaign) {
      campaign.getMyWarbandsInCampaign(selectedCampaign.id, 'mock_owner').then(setMyWarbands)
    }
  }

  const unlockedWarbands = myWarbands.filter(w => !w.locked)
  const lockedInPostBattle = myWarbands.filter(w => w.locked && w.post_battle_phase !== null)
  const battlesAwaitingResult = pendingBattles.filter(b => b.status === 'awaiting_result')
  const battlesPendingOpponent = pendingBattles.filter(b => b.status === 'pending_opponent')

  // ─── Select Campaign ────────────────────────────────────────────
  if (view === 'select_campaign') {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl mb-2">Active Campaigns</h1>
        <p className="text-[var(--muted)] mb-6">Select a campaign to join the war effort.</p>

        <div className="space-y-4">
          {campaigns.map(c => (
            <button
              key={c.id}
              onClick={() => selectCampaign(c)}
              className="card-military w-full text-left p-5 cursor-pointer hover:border-[var(--sepia)]"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold uppercase tracking-wider">{c.name}</h3>
                <span className={`text-xs font-bold uppercase px-2 py-0.5 border rounded-sm ${
                  c.status === 'active' ? 'border-[var(--olive)] text-[var(--olive)]' : 'border-[var(--muted)] text-[var(--muted)]'
                }`}>
                  {c.status}
                </span>
              </div>
              <p className="text-[var(--fg-secondary)] mb-2">{c.description}</p>
              <div className="text-xs text-[var(--muted)]">
                {c.enrolled_warbands}/{c.max_warbands} warbands enrolled
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ─── Campaign Hub ───────────────────────────────────────────────
  if (view === 'campaign_hub') {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => { setView('select_campaign'); setSelectedCampaign(null) }}
            className="text-[var(--sepia)] font-bold uppercase text-xs cursor-pointer hover:underline"
          >
            ← Campaigns
          </button>
          <h1 className="text-2xl">{selectedCampaign?.name}</h1>
        </div>

        {/* My Warbands */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Your Warbands</h2>
          <div className="space-y-2">
            {myWarbands.map(w => (
              <div key={w.id} className="card-military px-4 py-3 flex items-center gap-4">
                <span className="font-bold flex-1">{w.name}</span>
                {w.locked && w.post_battle_phase && w.post_battle_phase !== 'done' ? (
                  <button
                    onClick={() => openPostBattle(w)}
                    className="text-xs font-bold uppercase text-[var(--accent)] border border-[var(--accent)] px-2 py-0.5 rounded-sm cursor-pointer hover:bg-[var(--surface)]"
                  >
                    Post-Battle: {w.post_battle_phase}
                  </button>
                ) : w.locked ? (
                  <span className="text-xs font-bold uppercase text-[var(--accent)] border border-[var(--accent)] px-2 py-0.5 rounded-sm">
                    Locked — In Battle
                  </span>
                ) : (
                  <span className="text-xs font-bold uppercase text-[var(--olive)] border border-[var(--olive)] px-2 py-0.5 rounded-sm">
                    Available
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setView('challenge')}
              disabled={unlockedWarbands.length === 0}
              className="card-military p-5 text-left cursor-pointer hover:border-[var(--sepia)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="font-bold uppercase tracking-wider mb-1">Challenge Territory</div>
              <div className="text-[var(--muted)] text-sm">Lock a location and await an opponent</div>
            </button>
            <button
              onClick={() => { setReportStep(0); setSelectedBattle(null); setSubmitted(false); setView('report') }}
              disabled={battlesAwaitingResult.length === 0}
              className="card-military p-5 text-left cursor-pointer hover:border-[var(--sepia)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="font-bold uppercase tracking-wider mb-1">Report Battle</div>
              <div className="text-[var(--muted)] text-sm">{battlesAwaitingResult.length} battle(s) awaiting result</div>
            </button>
          </div>
        </section>

        {/* Warbands in post-battle (resumable) */}
        {lockedInPostBattle.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
              Post-Battle In Progress
            </h2>
            <div className="space-y-2">
              {lockedInPostBattle.map(w => (
                <button
                  key={w.id}
                  onClick={() => openPostBattle(w)}
                  className="card-military w-full text-left px-4 py-3 cursor-pointer hover:border-[var(--sepia)] flex items-center gap-4"
                >
                  <span className="font-bold flex-1">{w.name}</span>
                  <span className="text-xs text-[var(--sepia)] uppercase">Phase: {w.post_battle_phase}</span>
                  <span className="text-xs text-[var(--accent)] font-bold">Resume →</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Open challenges */}
        {battlesPendingOpponent.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
              Open Challenges
            </h2>
            <div className="space-y-2">
              {battlesPendingOpponent.map(b => (
                <div key={b.id} className="card-military px-4 py-3 flex items-center gap-4">
                  <div className="flex-1">
                    <span className="font-bold">{b.challenger_name}</span>
                    <span className="text-[var(--muted)] mx-2">→</span>
                    <span className="text-[var(--sepia)]">{b.location_name}</span>
                  </div>
                  <span className="text-xs text-[var(--muted)]">Awaiting defender</span>
                  {unlockedWarbands.length > 0 && (
                    <button className="text-xs font-bold text-[var(--olive)] uppercase cursor-pointer hover:underline">
                      Accept
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Battles awaiting result */}
        {battlesAwaitingResult.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
              Battles Awaiting Result
            </h2>
            <div className="space-y-2">
              {battlesAwaitingResult.map(b => (
                <div key={b.id} className="card-military px-4 py-3 flex items-center gap-4">
                  <div className="flex-1">
                    <span className="font-bold">{b.challenger_name}</span>
                    <span className="text-[var(--muted)] mx-2">vs</span>
                    <span className="font-bold">{b.defender_name}</span>
                  </div>
                  <span className="text-[var(--sepia)]">{b.location_name}</span>
                  <span className="text-xs text-[var(--accent)] font-bold uppercase">Pending</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  // ─── Challenge Territory ────────────────────────────────────────
  if (view === 'challenge') {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setView('campaign_hub')}
            className="text-[var(--sepia)] font-bold uppercase text-xs cursor-pointer hover:underline"
          >
            ← Back
          </button>
          <h1 className="text-2xl">Challenge Territory</h1>
        </div>

        <div className="space-y-6">
          <Field label="Select your Warband">
            <div className="space-y-2">
              {unlockedWarbands.map(w => (
                <button
                  key={w.id}
                  onClick={() => setChallengeWarband(w.id)}
                  className={`card-military w-full text-left px-4 py-3 cursor-pointer ${
                    challengeWarband === w.id ? 'border-[var(--accent)] bg-[var(--surface)]' : 'hover:border-[var(--sepia)]'
                  }`}
                >
                  <span className="font-bold">{w.name}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Select Location to Challenge">
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {mapLocations.map(loc => (
                <button
                  key={loc.id}
                  onClick={() => setChallengeLocation(loc.id)}
                  className={`card-military text-left px-3 py-2.5 cursor-pointer ${
                    challengeLocation === loc.id ? 'border-[var(--accent)] bg-[var(--surface)]' : 'hover:border-[var(--sepia)]'
                  }`}
                >
                  <div className="font-bold text-sm">{loc.name}</div>
                  <div className="text-xs text-[var(--muted)]">{loc.terrain} — {loc.subtitle}</div>
                </button>
              ))}
            </div>
          </Field>

          <div className="card-military p-4 bg-[var(--surface)]">
            <p className="text-[var(--fg-secondary)] text-sm">
              Challenging a territory will <strong>lock your warband</strong> until the battle and all post-battle steps are resolved.
            </p>
          </div>

          <button
            onClick={handleChallenge}
            disabled={challengeWarband === null || challengeLocation === null}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--border)] disabled:text-[var(--muted)] text-[var(--parchment)] px-4 py-3 rounded-sm font-bold uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed"
          >
            Issue Challenge
          </button>
        </div>
      </div>
    )
  }

  // ─── Report Battle ──────────────────────────────────────────────
  if (view === 'report') {
    if (submitted) {
      return (
        <div className="max-w-3xl mx-auto">
          <div className="card-military text-center py-12 border-[var(--olive)]">
            <div className="text-[var(--olive)] text-lg font-bold uppercase tracking-wider mb-2">Battle Report Submitted</div>
            <p className="text-[var(--muted)] mb-4">
              Awaiting opponent's report. Once both sides confirm, results are computed on-chain.
            </p>
            <button
              onClick={() => setView('campaign_hub')}
              className="text-[var(--sepia)] font-bold uppercase text-xs cursor-pointer hover:underline"
            >
              Return to Campaign
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setView('campaign_hub')}
            className="text-[var(--sepia)] font-bold uppercase text-xs cursor-pointer hover:underline"
          >
            ← Back
          </button>
          <h1 className="text-2xl">Report Battle Result</h1>
        </div>

        <Stepper steps={REPORT_STEPS} currentStep={reportStep} />

        {/* Step 0: Select Battle */}
        {reportStep === 0 && (
          <div className="space-y-4">
            <p className="text-[var(--muted)] mb-4">Select the battle you played:</p>
            {battlesAwaitingResult.map(b => (
              <button
                key={b.id}
                onClick={() => startReport(b)}
                className="card-military w-full text-left px-5 py-4 cursor-pointer hover:border-[var(--sepia)]"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <span className="font-bold">{b.challenger_name}</span>
                    <span className="text-[var(--muted)] mx-2">vs</span>
                    <span className="font-bold">{b.defender_name}</span>
                  </div>
                  <span className="text-[var(--sepia)]">{b.location_name}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 1: Winner */}
        {reportStep === 1 && selectedBattle && (
          <div className="space-y-6">
            <Field label="Who won the battle?">
              <div className="space-y-2">
                <button
                  onClick={() => setWinner(selectedBattle.challenger_warband)}
                  className={`card-military w-full text-left px-4 py-3 cursor-pointer ${
                    winner === selectedBattle.challenger_warband ? 'border-[var(--accent)] bg-[var(--surface)]' : 'hover:border-[var(--sepia)]'
                  }`}
                >
                  <span className="font-bold">{selectedBattle.challenger_name}</span> (Challenger)
                </button>
                <button
                  onClick={() => setWinner(selectedBattle.defender_warband)}
                  className={`card-military w-full text-left px-4 py-3 cursor-pointer ${
                    winner === selectedBattle.defender_warband ? 'border-[var(--accent)] bg-[var(--surface)]' : 'hover:border-[var(--sepia)]'
                  }`}
                >
                  <span className="font-bold">{selectedBattle.defender_name}</span> (Defender)
                </button>
                <button
                  onClick={() => setWinner(null)}
                  className={`card-military w-full text-left px-4 py-3 cursor-pointer ${
                    winner === null && reportStep === 1 ? 'border-[var(--accent)] bg-[var(--surface)]' : 'hover:border-[var(--sepia)]'
                  }`}
                >
                  <span className="font-bold">Draw</span>
                </button>
              </div>
            </Field>

            <Field label="Did the loser rout?">
              <div className="flex gap-3">
                <button
                  onClick={() => setLoserRoute(true)}
                  className={`flex-1 card-military py-2.5 text-center cursor-pointer font-bold uppercase tracking-wider ${
                    loserRoute ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]' : 'text-[var(--muted)]'
                  }`}
                >
                  Yes — Routed
                </button>
                <button
                  onClick={() => setLoserRoute(false)}
                  className={`flex-1 card-military py-2.5 text-center cursor-pointer font-bold uppercase tracking-wider ${
                    !loserRoute ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]' : 'text-[var(--muted)]'
                  }`}
                >
                  No
                </button>
              </div>
            </Field>

            <div className="flex gap-4">
              <button
                onClick={() => setReportStep(0)}
                className="flex-1 border border-[var(--border)] text-[var(--fg)] px-4 py-3 rounded-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-[var(--surface)]"
              >
                Back
              </button>
              <button
                onClick={() => setReportStep(2)}
                className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-3 rounded-sm font-bold uppercase tracking-wider cursor-pointer"
              >
                Next: My Casualties
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Casualties from MY roster */}
        {reportStep === 2 && selectedBattle && (
          <div className="space-y-6">
            <div className="card-military p-4 bg-[var(--surface)]">
              <p className="text-[var(--fg-secondary)] text-sm">
                Select which of <strong>your</strong> models were taken Out of Action. Mark "Killed" for models that failed the trauma roll (permanent death). The chain will compute XP, glory, and territory from both reports.
              </p>
            </div>

            <div className="space-y-2">
              {roster.map((rec, i) => {
                const c = casualties[i]
                return (
                  <div key={i} className="card-military px-4 py-3 flex items-center gap-4">
                    <div className="flex-1">
                      <span className="font-bold">{rec.name}</span>
                      <span className="text-xs text-[var(--muted)] ml-2">XP: {rec.xp}</span>
                    </div>
                    <button
                      onClick={() => {
                        const updated = [...casualties]
                        updated[i] = { ...c, out_of_action: !c.out_of_action, killed: false }
                        setCasualties(updated)
                      }}
                      className={`text-xs font-bold uppercase px-2 py-1 border rounded-sm cursor-pointer ${
                        c.out_of_action
                          ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]'
                          : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
                      }`}
                    >
                      Out of Action
                    </button>
                    {c.out_of_action && (
                      <button
                        onClick={() => {
                          const updated = [...casualties]
                          updated[i] = { ...c, killed: !c.killed }
                          setCasualties(updated)
                        }}
                        className={`text-xs font-bold uppercase px-2 py-1 border rounded-sm cursor-pointer ${
                          c.killed
                            ? 'border-[var(--accent)] text-[var(--parchment)] bg-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
                        }`}
                      >
                        Killed
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="text-sm text-[var(--muted)]">
              {casualties.filter(c => c.out_of_action).length} model(s) Out of Action
              {casualties.filter(c => c.killed).length > 0 && (
                <span className="text-[var(--accent)] ml-2">
                  — {casualties.filter(c => c.killed).length} permanently killed
                </span>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setReportStep(1)}
                className="flex-1 border border-[var(--border)] text-[var(--fg)] px-4 py-3 rounded-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-[var(--surface)]"
              >
                Back
              </button>
              <button
                onClick={() => setReportStep(3)}
                className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-3 rounded-sm font-bold uppercase tracking-wider cursor-pointer"
              >
                Next: Confirm
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm & Submit */}
        {reportStep === 3 && selectedBattle && (
          <div className="space-y-6">
            <div className="card-military p-6">
              <h3 className="font-bold uppercase tracking-wider mb-4">Your Battle Report</h3>

              <div className="stat-block mb-4">
                <div className="stat-item">
                  <div className="stat-label">Location</div>
                  <div className="stat-value">{selectedBattle.location_name}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Winner</div>
                  <div className="stat-value">
                    {winner === selectedBattle.challenger_warband
                      ? selectedBattle.challenger_name
                      : winner === selectedBattle.defender_warband
                        ? selectedBattle.defender_name
                        : 'Draw'}
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Route</div>
                  <div className="stat-value">{loserRoute ? 'Yes' : 'No'}</div>
                </div>
              </div>

              <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">My Casualties</h4>
              <div className="space-y-1 mb-4">
                {casualties.filter(c => c.out_of_action).length === 0 ? (
                  <p className="text-[var(--olive)] text-sm">No casualties — all models survived!</p>
                ) : (
                  casualties.filter(c => c.out_of_action).map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-[var(--fg)]">{c.name}</span>
                      <span className={c.killed ? 'text-[var(--accent)] font-bold' : 'text-[var(--muted)]'}>
                        {c.killed ? '— KILLED' : '— Out of Action'}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-sm p-3 text-sm text-[var(--fg-secondary)]">
                <strong>Computed on-chain after both sides report:</strong> Glory, XP per model, territory capture, promotions eligibility.
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setReportStep(2)}
                className="flex-1 border border-[var(--border)] text-[var(--fg)] px-4 py-3 rounded-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-[var(--surface)]"
              >
                Back
              </button>
              <button
                onClick={handleSubmitReport}
                className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--parchment)] px-4 py-3 rounded-sm font-bold uppercase tracking-wider cursor-pointer"
              >
                Submit Report
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Post-Battle Sequence ───────────────────────────────────────
  if (view === 'post_battle' && postBattleWarband && postBattleState) {
    const phaseIndex = POST_BATTLE_PHASES.findIndex(p => p.key === postBattleState.current_phase)

    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setView('campaign_hub')}
            className="text-[var(--sepia)] font-bold uppercase text-xs cursor-pointer hover:underline"
          >
            ← Campaign
          </button>
          <h1 className="text-2xl">Post-Battle — {postBattleWarband.name}</h1>
        </div>

        {/* Phase progress */}
        <div className="flex gap-1 mb-8">
          {POST_BATTLE_PHASES.slice(0, -1).map((phase, i) => (
            <div
              key={phase.key}
              className={`flex-1 h-2 rounded-sm ${
                i < phaseIndex ? 'bg-[var(--olive)]' : i === phaseIndex ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
              }`}
            />
          ))}
        </div>

        {/* Battle result summary (computed by chain) */}
        {battleResult && (
          <div className="card-military p-5 mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
              Battle Result (computed on-chain)
            </h3>
            <div className="stat-block mb-4">
              <div className="stat-item">
                <div className="stat-label">Result</div>
                <div className="stat-value">
                  {battleResult.winner === postBattleWarband.id ? 'Victory' : battleResult.winner ? 'Defeat' : 'Draw'}
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Glory</div>
                <div className="stat-value text-[var(--brass)]">
                  +{battleResult.winner === postBattleWarband.id ? battleResult.challenger_glory : battleResult.defender_glory}
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Territory</div>
                <div className="stat-value">{battleResult.territory_captured ? 'Captured' : 'No change'}</div>
              </div>
            </div>

            {/* XP distribution */}
            <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">XP Earned</h4>
            <div className="space-y-1">
              {(battleResult.winner === postBattleWarband.id ? battleResult.challenger_xp : battleResult.defender_xp).map((xp, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="font-bold">{xp.name}</span>
                  <span className="text-[var(--brass)]">+{xp.xp_earned} XP</span>
                  <span className="text-[var(--muted)] text-xs">{xp.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current phase */}
        <div className="space-y-4">
          {POST_BATTLE_PHASES.map((phase, i) => {
            const isCurrent = i === phaseIndex
            const isDone = i < phaseIndex
            const isFuture = i > phaseIndex

            if (phase.key === 'done') return null

            return (
              <div
                key={phase.key}
                className={`card-military p-5 ${isCurrent ? 'border-[var(--accent)]' : ''} ${isFuture ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 shrink-0 ${
                    isDone
                      ? 'bg-[var(--olive)] border-[var(--olive)] text-[var(--parchment)]'
                      : isCurrent
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--parchment)]'
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)]'
                  }`}>
                    {isDone ? '✓' : i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="font-bold uppercase tracking-wider">{phase.label}</div>
                    <div className="text-[var(--muted)] text-sm">{phase.desc}</div>
                  </div>
                  {isCurrent && (
                    <button
                      onClick={() => advancePhase(phase.key)}
                      className="px-4 py-2 bg-[var(--accent)] text-[var(--parchment)] font-bold uppercase text-xs rounded-sm cursor-pointer hover:bg-[var(--accent-hover)]"
                    >
                      Complete
                    </button>
                  )}
                </div>

                {/* Phase-specific content */}
                {isCurrent && phase.key === 'trauma' && postBattleState.trauma_results.length > 0 && (
                  <div className="mt-4 border-t border-[var(--border)] pt-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Trauma Results</h4>
                    {postBattleState.trauma_results.map((t, ti) => (
                      <div key={ti} className="flex items-center gap-3 text-sm mb-1">
                        <span className="font-bold">{t.name}</span>
                        <span className={t.survived ? 'text-[var(--olive)]' : 'text-[var(--accent)]'}>
                          {t.survived ? 'Survived' : 'Died'}
                        </span>
                        {t.battle_scar && (
                          <span className="text-[var(--sepia)] text-xs">Scar: {t.battle_scar}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isCurrent && phase.key === 'promotions' && postBattleState.promotions_pending.length > 0 && (
                  <div className="mt-4 border-t border-[var(--border)] pt-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Promotion Status</h4>
                    {postBattleState.promotions_pending.map((p, pi) => (
                      <div key={pi} className="flex items-center gap-3 text-sm mb-1">
                        <span className="font-bold">{p.name}</span>
                        <span className="text-[var(--muted)]">{p.current_xp}/{p.xp_threshold} XP</span>
                        {p.eligible ? (
                          <span className="text-[var(--olive)] font-bold text-xs uppercase">Ready to promote!</span>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">{p.xp_threshold - p.current_xp} XP needed</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isCurrent && phase.key === 'exploration' && postBattleState.exploration_loot.length > 0 && (
                  <div className="mt-4 border-t border-[var(--border)] pt-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Loot Discovered</h4>
                    {postBattleState.exploration_loot.map((l, li) => (
                      <div key={li} className="flex items-center gap-3 text-sm mb-1">
                        <span className="font-bold">{l.name}</span>
                        <span className="text-xs text-[var(--muted)]">{l.type}</span>
                        <span className="text-[var(--brass)]">{l.value} ducats</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Complete button when all phases done */}
          {phaseIndex >= POST_BATTLE_PHASES.length - 1 && (
            <button
              onClick={completePostBattle}
              className="w-full bg-[var(--olive)] hover:bg-[var(--olive)]/90 text-[var(--parchment)] px-4 py-3 rounded-sm font-bold uppercase tracking-wider cursor-pointer"
            >
              Complete Post-Battle — Unlock Warband
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-bold uppercase tracking-wider text-[var(--muted)] mb-2">{label}</label>
      {children}
    </div>
  )
}
