import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Trophy, Play, CheckCircle2, AlertOctagon, Flame } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { GameTopBar } from '../../../components/layout/GameTopBar';
import { EshrahTVLobby } from '../../../components/eshrah/EshrahTVLobby';
import { EshrahPodium } from '../../../components/eshrah/EshrahPodium';
import {
  EshrahPlayer,
  EshrahTeamId,
  EshrahCategory,
  EshrahPromptItem,
  EshrahGamePhase
} from '../../../types/eshrah';
import { getRandomPrompt, ESHRAH_CATEGORIES_CONFIG } from '../../../data/eshrahWordsBank';
import { sound } from '../../../lib/audio';

const ALL_CATEGORIES: EshrahCategory[] = [
  'football', 'tv_series', 'movies', 'proverbs', 'theater', 'tools', 'food', 'countries'
];

export const ForbiddenWordsTVView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // State
  const [phase, setPhase] = useState<EshrahGamePhase>('TEAMS');
  const [players, setPlayers] = useState<EshrahPlayer[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<EshrahCategory[]>(ALL_CATEGORIES);
  const [activeTeam, setActiveTeam] = useState<EshrahTeamId>('team_1');
  const [currentRound, setCurrentRound] = useState<number>(1); // 1 to 3 per team (6 turns total)
  const [team1Score, setTeam1Score] = useState<number>(0);
  const [team2Score, setTeam2Score] = useState<number>(0);
  const [currentRunCorrectCount, setCurrentRunCorrectCount] = useState<number>(0);
  const [currentPrompt, setCurrentPrompt] = useState<EshrahPromptItem | null>(null);
  const [usedPromptIds, setUsedPromptIds] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const phaseRef = useRef(phase);
  const playersRef = useRef(players);
  const activeTeamRef = useRef(activeTeam);
  const team1ScoreRef = useRef(team1Score);
  const team2ScoreRef = useRef(team2Score);
  const currentPromptRef = useRef(currentPrompt);
  const currentRoundRef = useRef(currentRound);
  const currentRunCorrectRef = useRef(currentRunCorrectCount);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { activeTeamRef.current = activeTeam; }, [activeTeam]);
  useEffect(() => { team1ScoreRef.current = team1Score; }, [team1Score]);
  useEffect(() => { team2ScoreRef.current = team2Score; }, [team2Score]);
  useEffect(() => { currentPromptRef.current = currentPrompt; }, [currentPrompt]);
  useEffect(() => { currentRoundRef.current = currentRound; }, [currentRound]);
  useEffect(() => { currentRunCorrectRef.current = currentRunCorrectCount; }, [currentRunCorrectCount]);

  // Broadcast Full State
  const broadcastSync = useCallback((customPayload?: any) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'FORBIDDEN_WORDS_SYNC',
      payload: {
        phase: phaseRef.current,
        players: playersRef.current,
        activeTeam: activeTeamRef.current,
        team1Score: team1ScoreRef.current,
        team2Score: team2ScoreRef.current,
        currentRound: currentRoundRef.current,
        currentRunCorrectCount: currentRunCorrectRef.current,
        prompt: currentPromptRef.current,
        timeLeft,
        ...customPayload
      }
    });
  }, [timeLeft]);

  // Setup Realtime Channel
  useEffect(() => {
    const normalizedCode = roomCode.trim().toUpperCase();
    if (!normalizedCode) return;

    const channel = supabase.channel(`forbidden_words:${normalizedCode}`, {
      config: { broadcast: { self: true }, presence: { key: 'tv_screen' } }
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const active: EshrahPlayer[] = [];
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          presences.forEach((p) => {
            if (p.playerId && p.playerName) {
              const existing = playersRef.current.find((pl) => pl.id === p.playerId);
              active.push({
                id: p.playerId,
                name: p.playerName,
                teamId: existing?.teamId || p.teamId || null,
                isHost: !!p.isHost
              });
            }
          });
        });

        const unique = Array.from(new Map(active.map((p) => [p.id, p])).values());
        setPlayers(unique);
        broadcastSync({ players: unique });
      })
      .on('broadcast', { event: 'PLAYER_JOIN_TEAM' }, ({ payload }) => {
        const { playerId, teamId } = payload;
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, teamId } : p))
        );
      })
      .on('broadcast', { event: 'EXPLAINER_READY_START' }, () => {
        handleExplainerReady();
      })
      .on('broadcast', { event: 'TABOO_ACTION' }, ({ payload }) => {
        handleTabooAction(payload);
      })
      .on('broadcast', { event: 'ROOM_TERMINATED' }, () => {
        navigate('/');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, broadcastSync, navigate]);

  // 60s Round Timer Loop
  useEffect(() => {
    if (phase !== 'PLAYING' || !isTimerRunning) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleRoundTimeExpired();
          return 0;
        }
        if (prev <= 4) {
          sound.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, isTimerRunning]);

  // Explainer clicks [جاهز - ابدأ الوقت] on mobile
  const handleExplainerReady = () => {
    sound.playRoundStart();
    setTimeLeft(60);
    setIsTimerRunning(true);
    setPhase('PLAYING');
    broadcastSync({ phase: 'PLAYING', timeLeft: 60 });
  };

  const handleToggleCategory = (cat: EshrahCategory) => {
    sound.playClick();
    setSelectedCategories((prev) => {
      if (prev.includes(cat)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== cat);
      }
      return [...prev, cat];
    });
  };

  // Explainer reports: [جبتها ✓] or [مخالفة كلمة محظورة ✗]
  const handleTabooAction = (payload: { action: 'CORRECT' | 'VIOLATION' }) => {
    const { action } = payload;

    if (action === 'CORRECT') {
      sound.playCorrect();
      setCurrentRunCorrectCount((prev) => prev + 1);
      currentRunCorrectRef.current += 1;
      if (activeTeamRef.current === 'team_1') {
        setTeam1Score((prev) => prev + 1);
        team1ScoreRef.current += 1;
      } else {
        setTeam2Score((prev) => prev + 1);
        team2ScoreRef.current += 1;
      }
    } else if (action === 'VIOLATION') {
      sound.playIncorrect();
    }

    // Load next card instantly
    const cats = selectedCategories.length > 0 ? selectedCategories : ALL_CATEGORIES;
    const nextPrompt = getRandomPrompt(cats, usedPromptIds);
    setUsedPromptIds((prev) => new Set([...prev, nextPrompt.id]));
    setCurrentPrompt(nextPrompt);
    currentPromptRef.current = nextPrompt;

    broadcastSync({
      prompt: nextPrompt,
      currentRunCorrectCount: currentRunCorrectRef.current,
      team1Score: team1ScoreRef.current,
      team2Score: team2ScoreRef.current
    });
  };

  // 60s Expired
  const handleRoundTimeExpired = () => {
    sound.playTimeout();
    setIsTimerRunning(false);
    setPhase('ROUND_RESULT');
    broadcastSync({ phase: 'ROUND_RESULT', timeLeft: 0 });
  };

  // Advance Next Turn
  const handleAdvanceNextTurn = () => {
    sound.playClick();
    const nextTeam: EshrahTeamId = activeTeam === 'team_1' ? 'team_2' : 'team_1';
    let nextRound = currentRound;

    if (activeTeam === 'team_2') {
      nextRound += 1;
    }

    if (nextRound > 3) {
      sound.playVictory();
      setPhase('PODIUM');
      broadcastSync({ phase: 'PODIUM' });
      return;
    }

    const cats = selectedCategories.length > 0 ? selectedCategories : ALL_CATEGORIES;
    const newPrompt = getRandomPrompt(cats, usedPromptIds);
    setUsedPromptIds((prev) => new Set([...prev, newPrompt.id]));
    setCurrentPrompt(newPrompt);
    setActiveTeam(nextTeam);
    setCurrentRound(nextRound);
    setCurrentRunCorrectCount(0);
    setTimeLeft(60);
    setIsTimerRunning(false);
    setPhase('PREP_WORD');

    broadcastSync({
      phase: 'PREP_WORD',
      activeTeam: nextTeam,
      currentRound: nextRound,
      prompt: newPrompt,
      currentRunCorrectCount: 0,
      timeLeft: 60
    });
  };

  // Launch Match from Lobby
  const handleLaunchMatch = () => {
    const cats = selectedCategories.length > 0 ? selectedCategories : ALL_CATEGORIES;
    const firstPrompt = getRandomPrompt(cats, usedPromptIds);
    setUsedPromptIds(new Set([firstPrompt.id]));
    setCurrentPrompt(firstPrompt);
    setActiveTeam('team_1');
    setCurrentRound(1);
    setTeam1Score(0);
    setTeam2Score(0);
    setCurrentRunCorrectCount(0);
    setTimeLeft(60);
    setIsTimerRunning(false);
    setPhase('PREP_WORD');

    broadcastSync({
      phase: 'PREP_WORD',
      activeTeam: 'team_1',
      currentRound: 1,
      team1Score: 0,
      team2Score: 0,
      prompt: firstPrompt,
      currentRunCorrectCount: 0,
      timeLeft: 60
    });
  };

  // Universal End Room
  const handleEndRoom = () => {
    sound.playClick();
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'ROOM_TERMINATED',
        payload: {}
      });
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#E5E0D5] flex flex-col font-sans select-none overflow-hidden relative" dir="rtl">
      {/* Background static dots */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40 z-0"
        style={{
          backgroundImage: 'radial-gradient(#2C2A29 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* TopBar */}
      <GameTopBar
        roomCode={roomCode}
        isHost={true}
        gameTitle="كلمات محظورة"
        currentRound={phase !== 'TEAMS' ? currentRound : undefined}
        totalRounds={phase !== 'TEAMS' ? 3 : undefined}
        onTerminate={handleEndRoom}
        onExit={handleEndRoom}
      />

      <main className="flex-1 flex flex-col items-center justify-between p-4 md:p-6 relative z-10 max-w-6xl mx-auto w-full">
        {/* ================= 1. TEAMS (LOBBY) ================= */}
        {phase === 'TEAMS' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto">
            <EshrahTVLobby
              roomCode={roomCode}
              gameTitle="كلمات محظورة"
              gameRuleSnippet="شرح سريع وتخمين أكبر عدد من الكلمات في 60 ثانية بدون نطق الكلمات الأربع الممنوعة! الشارح يمسك جواله لرؤية الكلمة والمحظورات ويسجل النقاط بنفسه."
              players={players}
              onStartMatch={handleLaunchMatch}
              categories={ESHRAH_CATEGORIES_CONFIG}
              selectedCategories={selectedCategories}
              onToggleCategory={handleToggleCategory}
            />
          </div>
        )}

        {/* ================= 2. PREP WORD (EXPLAINER PREPARING) ================= */}
        {phase === 'PREP_WORD' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center gap-6 my-auto text-center max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#5C4033] bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                جولة {currentRound} من 3
              </span>
              <span className={`text-xs font-black text-white px-4 py-1.5 rounded-xl border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] ${
                activeTeam === 'team_1' ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'
              }`}>
                دور الشرح: {activeTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'}
              </span>
            </div>

            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-8 shadow-[6px_6px_0px_#2C2A29] w-full flex flex-col items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-[#8A9A5B]/15 border-2 border-[#8A9A5B] flex items-center justify-center text-[#8A9A5B]">
                <Clock className="w-8 h-8" />
              </div>

              <h3 className="text-2xl md:text-3xl font-black text-[#2C2A29]">
                الشارح يراجع الكلمة ويستعد...
              </h3>

              <p className="text-sm font-bold text-[#5C4033] max-w-md leading-relaxed">
                الكلمة والكلمات المحظورة معروضة على جوال الشارح ليأخذ وقته في التفكير.
                الوقت يبدأ بالعد التنازلي (60 ثانية) فور ضغطه على <strong>[جاهز - ابدأ الوقت]</strong> في جواله!
              </p>

              <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-2xl px-6 py-2.5 text-xs font-black text-[#2C2A29]">
                ⏱️ مدة الجولة: 60 ثانية بعد الضغط على جاهز
              </div>
            </div>
          </div>
        )}

        {/* ================= 3. PLAYING (60s ACTIVE) ================= */}
        {phase === 'PLAYING' && (
          <div className="w-full flex-1 flex flex-col items-center justify-between my-auto gap-6 max-w-3xl text-center">
            {/* Top Bar Status */}
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-black text-[#2C2A29] bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                جولة {currentRound} / 3
              </span>
              <div className={`px-4 py-1.5 rounded-xl border-2 border-[#2C2A29] font-black text-xs text-white shadow-[2px_2px_0px_#2C2A29] ${
                activeTeam === 'team_1' ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'
              }`}>
                الفريق الشارح: {activeTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'}
              </div>
            </div>

            {/* Giant Timer */}
            <div className={`flex items-center justify-center gap-3 px-10 py-4 rounded-3xl border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] ${
              timeLeft <= 10 ? 'bg-[#C86D51] text-white' : 'bg-[#F7F4EC] text-[#2C2A29]'
            }`}>
              <Clock className="w-10 h-10" />
              <span className="text-6xl font-black font-mono tracking-wider">
                00:{timeLeft.toString().padStart(2, '0')}
              </span>
            </div>

            {/* Central Score Streak Box */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-8 shadow-[6px_6px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-sm font-black text-[#8A9A5B]">
                <Flame className="w-5 h-5 fill-current" />
                <span>الكلمات الصحيحة في هذه الجولة</span>
              </div>

              <div className="text-6xl md:text-7xl font-black text-[#2C2A29]">
                {currentRunCorrectCount}
              </div>

              <span className="text-xs font-bold text-[#5C4033] bg-[#E5E0D5] border border-[#2C2A29] px-4 py-1.5 rounded-xl">
                الكلمات والمحظورات على جوال الشارح لمنع الغش بالصالة!
              </span>
            </div>
          </div>
        )}

        {/* ================= 4. ROUND RESULT ================= */}
        {phase === 'ROUND_RESULT' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto gap-6 max-w-lg text-center">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-8 shadow-[6px_6px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <CheckCircle2 className="w-14 h-14 text-[#8A9A5B]" />
              <h3 className="text-2xl font-black text-[#2C2A29]">
                انتهت الـ 60 ثانية!
              </h3>

              <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-2xl p-4 w-full">
                <span className="text-xs font-bold text-[#5C4033] block mb-1">
                  أحرز {activeTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'}:
                </span>
                <span className="text-3xl font-black text-[#8A9A5B]">
                  +{currentRunCorrectCount} pt
                </span>
              </div>

              {/* Total Scores */}
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-[#8A9A5B]/15 border-2 border-[#2C2A29] rounded-2xl p-3">
                  <div className="text-xs font-bold text-[#2C2A29]">الفريق الأول</div>
                  <div className="text-3xl font-black text-[#8A9A5B]">{team1Score} pt</div>
                </div>
                <div className="bg-[#C68B59]/15 border-2 border-[#2C2A29] rounded-2xl p-3">
                  <div className="text-xs font-bold text-[#2C2A29]">الفريق الثاني</div>
                  <div className="text-3xl font-black text-[#C68B59]">{team2Score} pt</div>
                </div>
              </div>

              <button
                onClick={handleAdvanceNextTurn}
                className="w-full bg-[#8A9A5B] hover:bg-[#78884d] active:scale-98 text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl py-3.5 font-black text-lg transition-all mt-2 cursor-pointer"
              >
                الدور التالي ➔
              </button>
            </div>
          </div>
        )}

        {/* ================= 5. PODIUM ================= */}
        {phase === 'PODIUM' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto">
            <EshrahPodium
              team1Score={team1Score}
              team2Score={team2Score}
              onPlayAgain={() => {
                sound.playClick();
                handleLaunchMatch();
              }}
              onBackToHome={handleEndRoom}
            />
          </div>
        )}

        {/* Bottom scoreboard during gameplay */}
        {phase !== 'PODIUM' && phase !== 'TEAMS' && (
          <div className="w-full flex items-center justify-center gap-6 mt-4">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl px-6 py-2 shadow-[3px_3px_0px_#2C2A29] flex items-center gap-6 text-sm font-black">
              <span className="text-[#8A9A5B]">الفريق الأول: {team1Score} pt</span>
              <span className="text-[#2C2A29]/30">|</span>
              <span className="text-[#C68B59]">الفريق الثاني: {team2Score} pt</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
