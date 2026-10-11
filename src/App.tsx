import React, { useEffect } from 'react';
import { arabicDict } from './utils/arabicDictionary';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { TVScreenView } from './pages/TVScreenView';
import { PlayerMobileView } from './pages/PlayerMobileView';
import { HostModeratorView } from './pages/HostModeratorView';
import { MobileJoinPage } from './pages/MobileJoinPage';

export function App() {
  useEffect(() => {
    arabicDict.init();
  }, []);
  return (
    <Router>
      <Routes>
        {/* Main Entry & Landing */}
        <Route path="/" element={<LandingPage />} />

        {/* Mobile Player Join View */}
        <Route path="/join" element={<MobileJoinPage />} />

        {/* TV Big Screen Room Board */}
        <Route path="/room/:code" element={<TVScreenView />} />
        <Route path="/room/:code/board" element={<TVScreenView />} />

        {/* Flag Color Guesser Views */}
        <Route path="/room/:code/flags-lobby" element={<PlayerMobileView />} />
        <Route path="/room/:code/flags-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/flags-tv" element={<TVScreenView />} />

        {/* Pin the Landmark Views */}
        <Route path="/room/:code/geo-tv" element={<TVScreenView />} />
        <Route path="/room/:code/geo-play" element={<PlayerMobileView />} />

        {/* Line Trajectory Views */}
        <Route path="/room/:code/trajectory-tv" element={<TVScreenView />} />
        <Route path="/room/:code/trajectory-play" element={<PlayerMobileView />} />

        {/* Blind Tourism Views */}
        <Route path="/room/:code/tourism-tv" element={<TVScreenView />} />
        <Route path="/room/:code/tourism-play" element={<PlayerMobileView />} />

        {/* Words Suite - Three Letter Word */}
        <Route path="/room/:code/words/three-letter-word" element={<PlayerMobileView />} />
        <Route path="/room/:code/words/three-letter-word-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/words/three-letter-word-tv" element={<TVScreenView />} />
        <Route path="/room/:code/words/kalim-stack" element={<PlayerMobileView />} />
        <Route path="/room/:code/words/kalim-stack-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/words/kalim-stack-tv" element={<TVScreenView />} />

        {/* Words Suite - Scattergories */}
        <Route path="/room/:code/words/scattergories" element={<PlayerMobileView />} />
        <Route path="/room/:code/words/scattergories-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/words/scattergories-tv" element={<TVScreenView />} />

        {/* Words Suite - Wordle Rush */}
        <Route path="/room/:code/words/wordle-rush" element={<PlayerMobileView />} />
        <Route path="/room/:code/words/wordle-rush-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/words/wordle-rush-tv" element={<TVScreenView />} />

        {/* AI Suite - Who Is AI */}
        <Route path="/room/:code/ai/who-is-ai" element={<PlayerMobileView />} />
        <Route path="/room/:code/ai/who-is-ai-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/ai/who-is-ai-tv" element={<TVScreenView />} />
        <Route path="/room/:code/ai/ai-room" element={<PlayerMobileView />} />
        <Route path="/room/:code/ai/ai-room-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/ai/ai-room-tv" element={<TVScreenView />} />


        {/* AI Suite - Conspiracy Maker */}
        <Route path="/room/:code/ai/conspiracy-maker" element={<PlayerMobileView />} />
        <Route path="/room/:code/ai/conspiracy-maker-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/ai/conspiracy-maker-tv" element={<TVScreenView />} />

        {/* AI Suite - The Scammer */}
        <Route path="/room/:code/ai/the-scammer" element={<PlayerMobileView />} />
        <Route path="/room/:code/ai/the-scammer-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/ai/the-scammer-tv" element={<TVScreenView />} />

        {/* AI Suite - AI Lawyer */}
        <Route path="/room/:code/ai/ai-lawyer" element={<PlayerMobileView />} />
        <Route path="/room/:code/ai/ai-lawyer-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/ai/ai-lawyer-tv" element={<TVScreenView />} />
        {/* Words Suite - Pentagon Clash */}
        <Route path="/room/:code/words/pentagon-clash" element={<PlayerMobileView />} />
        <Route path="/room/:code/words/pentagon-clash-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/words/pentagon-clash-tv" element={<TVScreenView />} />

        {/* Eshrah Suite - Wala Kalima */}
        <Route path="/room/:code/eshrah/wala-kalima" element={<PlayerMobileView />} />
        <Route path="/room/:code/eshrah/wala-kalima-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/eshrah/wala-kalima-tv" element={<TVScreenView />} />

        {/* Eshrah Suite - Forbidden Words */}
        <Route path="/room/:code/eshrah/forbidden-words" element={<PlayerMobileView />} />
        <Route path="/room/:code/eshrah/forbidden-words-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/eshrah/forbidden-words-tv" element={<TVScreenView />} />

        {/* Eshrah Suite - One Word */}
        <Route path="/room/:code/eshrah/one-word" element={<PlayerMobileView />} />
        <Route path="/room/:code/eshrah/one-word-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/eshrah/one-word-tv" element={<TVScreenView />} />

        {/* Eshrah Suite - Move The Puppet */}
        <Route path="/room/:code/eshrah/move-the-puppet" element={<PlayerMobileView />} />
        <Route path="/room/:code/eshrah/move-the-puppet-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/eshrah/move-the-puppet-tv" element={<TVScreenView />} />

        {/* Football Suite - Football Bingo */}
        <Route path="/room/:code/football/football-bingo" element={<PlayerMobileView />} />
        <Route path="/room/:code/football/football-bingo-play" element={<PlayerMobileView />} />
        <Route path="/room/:code/football/football-bingo-tv" element={<TVScreenView />} />

        {/* Player Join & Mobile Controller View */}
        <Route path="/room/:code/join" element={<MobileJoinPage />} />
        <Route path="/room/:code/play" element={<PlayerMobileView />} />

        {/* Host Moderator Mobile View */}
        <Route path="/room/:code/host" element={<HostModeratorView />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
