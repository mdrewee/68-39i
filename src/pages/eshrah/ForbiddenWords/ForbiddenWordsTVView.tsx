import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Trophy, Play, CheckCircle2, AlertOctagon, ShieldAlert, Award } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { EshrahTopBar } from '../../../components/eshrah/EshrahTopBar';
import { CleanTeamSelection } from '../../../components/eshrah/CleanTeamSelection';
import { CategoryPicker } from '../../../components/eshrah/CategoryPicker';
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

export const ForbiddenWordsTVView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // State
  const [phase, setPhase] = useState<EshrahGamePhase>('TEAMS');
  const [players, setPlayers] = useState<EshrahPlayer[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<EshrahCategory[]>([
    'football', 'tv_series', 'movies', 'proverbs', 'tools', 'food'
  ]);
  const [activeTeam, setActiveTeam] = useState<EshrahTeamId>('team_1');
  const [currentRound, setCurrentRound] = useState<number>(1); // 1 to 3 per team
  const [team1Score, setTeam1Score] = useState<number>(0);
  const [team2Score, setTeam2Score] = useState<number>(0);
  const [currentRunCorrectCount, setCurrentRunCorrectCount] = useState<number>(0);
  const [currentPrompt, setCurrentPrompt] = useState<EshrahPromptItem | null>(null);
  const [usedPromptIds, setUsedPromptIds] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [recentNotification, setRecentNotification] = useState<{ type: 'HIT' | 'VIOLATION' | 'SKIP'; word: string } | null>(null);

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
      .on('broadcast', { event: 'TABOO_ACTION' }, ({ payload }) => {
        handleTabooAction(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, broadcastSync]);

  // 60s Round Timer
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

  // Handle Taboo Action from Mobile
  const handleTabooAction = (payload: { action: 'CORRECT' | 'VIOLATION' | 'SKIP' }) => {
    const { action } = payload;
    const oldWord = currentPromptRef.current?.text || '';

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
      setRecentNotification({ type: 'HIT', word: oldWord });
    } else if (action === 'VIOLATION') {
      sound.playIncorrect();
      setRecentNotification({ type: 'VIOLATION', word: oldWord });
    } else if (action === 'SKIP') {
      sound.playClick();
      setRecentNotification({ type: 'SKIP', word: oldWord });
    }

    // Load next prompt in speed-run
    const nextPrompt = getRandomPrompt(selectedCategories, usedPromptIds);
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

  // When 60s expires
  const handleRoundTimeExpired = () => {
    sound.playTimeout();
    setIsTimerRunning(false);
    setPhase('ROUND_RESULT');
    broadcastSync({ phase: 'ROUND_RESULT', timeLeft: 0 });
  };

  // Advance Next Turn (3 rounds per team = 6 turns total)
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

    const newPrompt = getRandomPrompt(selectedCategories, usedPromptIds);
    setUsedPromptIds((prev) => new Set([...prev, newPrompt.id]));
    setCurrentPrompt(newPrompt);
    setActiveTeam(nextTeam);
    setCurrentRound(nextRound);
    setCurrentRunCorrectCount(0);
    setTimeLeft(60);
    setRecentNotification(null);
    setPhase('ROUND_READY');

    broadcastSync({
      phase: 'ROUND_READY',
      activeTeam: nextTeam,
      currentRound: nextRound,
      prompt: newPrompt,
      currentRunCorrectCount: 0,
      timeLeft: 60
    });
  };

  // Start Active 60s Round
  const handleStartRound = () => {
    sound.playRoundStart();
    setTimeLeft(60);
    setIsTimerRunning(true);
    setCurrentRunCorrectCount(0);
    setRecentNotification(null);
    setPhase('PLAYING');
    broadcastSync({ phase: 'PLAYING', timeLeft: 60, currentRunCorrectCount: 0 });
  };

  // Launch from Categories
  const handleLaunchMatch = () => {
    const firstPrompt = getRandomPrompt(selectedCategories, usedPromptIds);
    setUsedPromptIds(new Set([firstPrompt.id]));
    setCurrentPrompt(firstPrompt);
    setActiveTeam('team_1');
    setCurrentRound(1);
    setTeam1Score(0);
    setTeam2Score(0);
    setCurrentRunCorrectCount(0);
    setTimeLeft(60);
    setPhase('ROUND_READY');

    broadcastSync({
      phase: 'ROUND_READY',
      activeTeam: 'team_1',
      currentRound: 1,
      team1Score: 0,
      team2Score: 0,
      prompt: firstPrompt,
      currentRunCorrectCount: 0,
      timeLeft: 60
    });
  };

  return (
    <div className="min-h-screen bg-[#E5E0D5] flex flex-col font-sans select-none overflow-hidden relative" dir="rtl">
      {/* Background static dot pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40 z-0"
        style={{
          backgroundImage: 'radial-gradient(#2C2A29 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* TopBar */}
      <div className="relative z-20">
        <EshrahTopBar
          roomCode={roomCode}
          gameTitle="كلمات محظورة"
          phase={phase}
          onTerminate={() => {
            sound.playClick();
            setPhase('TEAMS');
            broadcastSync({ phase: 'TEAMS' });
          }}
          onExit={() => navigate('/')}
        />
      </div>

      <main className="flex-1 flex flex-col items-center justify-between p-4 md:p-6 relative z-10 max-w-6xl mx-auto w-full">
        {/* ================= 1. TEAMS ================= */}
        {phase === 'TEAMS' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto">
            <CleanTeamSelection
              players={players}
              isHost={true}
              onJoinTeam={() => {}}
              onConfirmTeams={() => {
                sound.playClick();
                setPhase('CATEGORIES');
                broadcastSync({ phase: 'CATEGORIES' });
              }}
            />
          </div>
        )}

        {/* ================= 2. CATEGORIES ================= */}
        {phase === 'CATEGORIES' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto">
            <CategoryPicker
              selectedCategories={selectedCategories}
              onChangeCategories={setSelectedCategories}
              onStartMatch={handleLaunchMatch}
              onBackToTeams={() => {
                sound.playClick();
                setPhase('TEAMS');
                broadcastSync({ phase: 'TEAMS' });
              }}
            />
          </div>
        )}

        {/* ================= 3. ROUND READY ================= */}
        {phase === 'ROUND_READY' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center gap-6 my-auto text-center max-w-xl">
            <span className="text-xs font-black text-[#5C4033] bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
              جولة السرعة {currentRound} من 3 ({activeTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'})
            </span>

            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <h3 className="text-2xl font-black text-[#2C2A29]">
                استعدوا لجولة تابو (60 ثانية)!
              </h3>

              <div className="text-xs font-bold text-[#5C4033] leading-relaxed max-w-md">
                شارح <strong className="text-[#8A9A5B]">{activeTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'}</strong> يمسك الجوال لشرح أكبر عدد من الكلمات، بينما يراقب الفريق المنافس الكلمات المحظورة عبر جوالهم لاصطياد أي مخالفة!
              </div>

              <button
                onClick={handleStartRound}
                className="w-full py-4 mt-2 rounded-2xl font-black text-lg bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] hover:bg-[#78884e] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play size={20} />
                <span>انطلاق جولة السرعة (60 ثانية)</span>
              </button>
            </div>

            <div className="w-full flex justify-around items-center bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-3 shadow-[3px_3px_0px_#2C2A29]">
              <span className="text-sm font-black text-[#8A9A5B]">الفريق الأول: {team1Score} pt</span>
              <span className="text-xs text-[#5C4033]">|</span>
              <span className="text-sm font-black text-[#C68B59]">الفريق الثاني: {team2Score} pt</span>
            </div>
          </div>
        )}

        {/* ================= 4. PLAYING (60s SPEED RUN) ================= */}
        {phase === 'PLAYING' && (
          <div className="w-full flex-1 flex flex-col items-center justify-between my-auto gap-6 max-w-3xl">
            {/* Header Status */}
            <div className="flex justify-between items-center w-full bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-4 shadow-[3px_3px_0px_#2C2A29]">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3.5 h-3.5 rounded-full border border-[#2C2A29] ${
                    activeTeam === 'team_1' ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'
                  }`}
                />
                <span className="text-sm md:text-base font-black text-[#2C2A29]">
                  الفريق الشارح: {activeTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Award size={18} className="text-[#8A9A5B]" />
                <span className="text-sm font-black text-[#8A9A5B]">
                  أحرزوا الآن: {currentRunCorrectCount} كلمات ✓
                </span>
              </div>
            </div>

            {/* Central Timer & Arena */}
            <div className="flex flex-col items-center justify-center bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-3xl p-8 w-full text-center">
              <span className="text-xs font-black text-[#5C4033] mb-2">الوقت المتبقي لجولة السرعة</span>
              <div
                className={`text-6xl md:text-8xl font-black font-mono tracking-tight ${
                  timeLeft <= 10 ? 'text-[#C86D51]' : 'text-[#2C2A29]'
                }`}
              >
                0:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
              </div>

              <div className="w-full h-3 bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-full overflow-hidden mt-6 shadow-inner">
                <div
                  className={`h-full transition-all duration-1000 ease-linear ${
                    timeLeft <= 10 ? 'bg-[#C86D51]' : 'bg-[#8A9A5B]'
                  }`}
                  style={{ width: `${(timeLeft / 60) * 100}%` }}
                />
              </div>

              {/* Feed ticker */}
              {recentNotification && (
                <div className="mt-4 px-4 py-2 rounded-xl text-xs font-black border-2 border-[#2C2A29] inline-block shadow-sm">
                  {recentNotification.type === 'HIT' && (
                    <span className="text-[#8A9A5B]">✓ إجابة صحيحة لكلمة: {recentNotification.word} (+1 pt)</span>
                  )}
                  {recentNotification.type === 'VIOLATION' && (
                    <span className="text-[#C86D51]">✗ مخالفة كلمة محظورة! تم استبعاد الكلمة (0 pt)</span>
                  )}
                  {recentNotification.type === 'SKIP' && (
                    <span className="text-[#5C4033]">↻ تم تخطي الكلمة</span>
                  )}
                </div>
              )}
            </div>

            {/* Score Strip */}
            <div className="w-full flex justify-around items-center bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-3 shadow-[3px_3px_0px_#2C2A29]">
              <span className="text-sm font-black text-[#8A9A5B]">الفريق الأول: {team1Score} pt</span>
              <span className="text-xs text-[#5C4033]">الجولة {currentRound} / 3</span>
              <span className="text-sm font-black text-[#C68B59]">الفريق الثاني: {team2Score} pt</span>
            </div>
          </div>
        )}

        {/* ================= 5. ROUND RESULT ================= */}
        {phase === 'ROUND_RESULT' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center gap-6 my-auto text-center max-w-lg">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <span className="text-xs font-black text-[#5C4033] bg-[#E5E0D5] px-3 py-1 rounded-xl border border-[#2C2A29]">
                انتهت 60 ثانية
              </span>

              <h3 className="text-2xl font-black text-[#2C2A29]">
                {activeTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'} أحرز:{' '}
                <span className="text-[#8A9A5B]">{currentRunCorrectCount} كلمات ✓</span>
              </h3>

              <p className="text-xs font-bold text-[#5C4033]">
                تمت إضافة +{currentRunCorrectCount} pt إلى رصيد الفريق!
              </p>

              <button
                onClick={handleAdvanceNextTurn}
                className="w-full py-3.5 mt-2 rounded-2xl font-black text-base bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] hover:bg-[#78884e] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>الانتقال للدور التالي</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= 6. PODIUM ================= */}
        {phase === 'PODIUM' && (
          <EshrahPodium
            team1Score={team1Score}
            team2Score={team2Score}
            onPlayAgain={() => {
              setPhase('TEAMS');
              broadcastSync({ phase: 'TEAMS' });
            }}
            onBackToHome={() => navigate('/')}
          />
        )}
      </main>
    </div>
  );
};
