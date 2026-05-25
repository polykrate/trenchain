import { useState } from 'react'

interface FAQItem {
  question: string
  answer: string
}

const FAQ_DATA: FAQItem[] = [
  {
    question: 'What is Trenchain?',
    answer: 'Trenchain is a decentralized application built on Substrate that brings Trench Crusade campaign management on-chain. It enables persistent territory wars, warband tracking, and tournament organization with full transparency and ownership.',
  },
  {
    question: 'How does the Long War work?',
    answer: 'The Long War is a persistent grand strategy layer where factions compete for territorial control across historical theatres. Campaign results from individual games directly affect the global war map, creating a living narrative.',
  },
  {
    question: 'Do I need a wallet to play?',
    answer: 'You can browse the compendium and view the world map without a wallet. To create a warband, join campaigns, or participate in the Long War, you need to connect a Substrate-compatible wallet (Polkadot.js, Talisman, SubWallet).',
  },
  {
    question: 'What are ducats?',
    answer: 'Ducats are the in-game currency used to recruit models and purchase battlekit for your warband. They are earned through campaign victories and territorial control. On-chain, ducats are tracked per warband, not per player.',
  },
  {
    question: 'How are warbands stored on-chain?',
    answer: 'Each warband is a unique on-chain entity with its roster, equipment, glory score, and battle history recorded immutably. This ensures no disputes about warband state between games.',
  },
  {
    question: 'Can I play multiple factions?',
    answer: 'Yes. A single wallet can own multiple warbands from different factions. However, in the Long War, each warband commits to a theatre and cannot switch sides during an active campaign.',
  },
  {
    question: 'What happens when my models are taken Out of Action?',
    answer: 'After each campaign game, models that were taken OoA go through a Trauma Step. The result is recorded on-chain. Models can recover fully, sustain battle scars, or be permanently lost.',
  },
  {
    question: 'Is this on mainnet?',
    answer: 'Currently Trenchain runs on a local testnet. A public testnet is planned, followed by deployment as a parachain. All data on testnet will be wiped before mainnet launch.',
  },
]

export function FAQ() {
  return (
    <div>
      <h1 className="text-lg mb-1">Frequently Asked Questions</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Intelligence briefing for new commanders.
      </p>

      <div className="space-y-2">
        {FAQ_DATA.map((item, idx) => (
          <FAQRow key={idx} item={item} />
        ))}
      </div>
    </div>
  )
}

function FAQRow({ item }: { item: FAQItem }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card-military">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-[var(--surface)]"
      >
        <span className="text-xs font-bold uppercase tracking-wider pr-4">{item.question}</span>
        <svg
          className={`w-4 h-4 text-[var(--muted)] shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
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
      {expanded && (
        <div className="px-4 pb-3 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--fg-secondary)] leading-relaxed pt-3">
            {item.answer}
          </p>
        </div>
      )}
    </div>
  )
}
