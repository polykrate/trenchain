import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Factions } from './pages/Factions'
import { Units } from './pages/Units'
import { Battlekits } from './pages/Battlekits'
import { Keywords } from './pages/Keywords'
import { WarbandCreate } from './pages/WarbandCreate'
import { WarbandView } from './pages/WarbandView'
import { Recruit } from './pages/Recruit'
import { Campaign } from './pages/Campaign'
import { Leaderboard } from './pages/Leaderboard'
import { Tournaments } from './pages/Tournaments'
import { TerritoryMap } from './pages/TerritoryMap'
import { TheatreList } from './pages/TheatreList'
import { TheatreCreate } from './pages/TheatreCreate'
import { FAQ } from './pages/FAQ'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />

        {/* Compendium */}
        <Route path="/compendium/factions" element={<Factions />} />
        <Route path="/compendium/entries" element={<Units />} />
        <Route path="/compendium/battlekits" element={<Battlekits />} />
        <Route path="/compendium/keywords" element={<Keywords />} />

        {/* Warband */}
        <Route path="/warband/new" element={<WarbandCreate />} />
        <Route path="/warband/my" element={<WarbandView />} />
        <Route path="/warband/:id" element={<WarbandView />} />
        <Route path="/warband/:id/recruit" element={<Recruit />} />

        {/* Campaign */}
        <Route path="/campaign" element={<Campaign />} />
        <Route path="/campaign/join" element={<Campaign />} />
        <Route path="/campaign/leaderboard" element={<Leaderboard />} />
        <Route path="/campaign/tournaments" element={<Tournaments />} />

        {/* The Long War */}
        <Route path="/longwar" element={<TerritoryMap />} />
        <Route path="/longwar/theatres" element={<TheatreList />} />
        <Route path="/longwar/theatres/new" element={<TheatreCreate />} />
        <Route path="/longwar/theatre/:id" element={<TerritoryMap />} />

        {/* FAQ */}
        <Route path="/faq" element={<FAQ />} />
      </Route>
    </Routes>
  )
}
