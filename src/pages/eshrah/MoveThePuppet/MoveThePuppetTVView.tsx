import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Trophy, Play, CheckCircle2, AlertTriangle, ShieldCheck, UserCheck, Eye, EyeOff } from 'lucide-react';
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

export const MoveThePuppetTVView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // State
  const [phase, setPhase] = useState<EshrahGamePhase>('TEAMS');
  const [players, setPlayers] = useState<EshrahPlayer[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<EshrahCategory[]>([
    'tools', 'food', 'proverbs', 'movies'
  ]);
  const [activeTeam, setActiveTeam] = useState<EshrahTeamId>('team_1');
  const [currentRound, setCurrentRound] = useState<number>(1); // 1 to 5 per team
  const [team1Score, setTeam1Score] = useState<number>(0);
  const [team2Score, setTeam2Score] = useState<number>(0);
  const [currentPrompt, setCurrentPrompt] = useState<EshrahPromptItem | null>(null);
  const [usedPromptIds, setUsedPromptIds] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [stealTimeLeft, setStealTimeLeft] = useState<number>(15);
  const [roundResultText, setRoundResultText] = useState<string>('');
  const [isPromptRevealedOnTV, setIsPromptRevealedOnTV] = useState<boolean>(false);

  // Channel ref singleton
  const channelRef = useRef<RealtimeChannel | null>(null);
  const phaseRef = useRef(phase);
  const playersRef = useRef(players);
  const activeTeamRef = useRef(activeTeam);
  const team1ScoreRef = useRef(team1Score);
  const team2ScoreRef = useRef(team2Score);
  const currentPromptRef = useRef(currentPrompt);
  const currentRoundRef = useRef(currentRound);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { activeTeamRef.current = activeTeam; }, [activeTeam]);
  useEffect(() => { team1ScoreRef.current = team1Score; }, [team1Score]);
  useEffect(() => { team2ScoreRef.current = team2Score; }, [team2Score]);
  useEffect(() => { currentPromptRef.current = currentPrompt; }, [currentPrompt]);
  useEffect(() => { currentRoundRef.current = currentRound; }, [currentRound]);

  // Broadcast Full State
  const broadcastSync = useCallback((customPayload?: any) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'MOVE_THE_PUPPET_SYNC',
      payload: {
        phase: phaseRef.current,
        players: playersRef.current,
        activeTeam: activeTeamRef.current,
        team1Score: team1ScoreRef.current,
        team2Score: team2ScoreRef.current,
        currentRound: currentRoundRef.current,
        prompt: currentPromptRef.current,
        timeLeft,
        stealTimeLeft,
        ...customPayload
      }
    });
  }, [timeLeft, stealTimeLeft]);

  // Setup Realtime Channel
  useEffect(() => {
    const normalizedCode = roomCode.trim().toUpperCase();
    if (!normalizedCode) return;

    const channel = supabase.channel(`move_the_puppet:${normalizedCode}`, {
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
      .on('broadcast', { event: 'REFEREE_ACTION' }, ({ payload }) => {
        handleRefereeAction(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, broadcastSync]);

  // Main 60s Timer Loop
  useEffect(() => {
    if (phase !== 'PLAYING' || !isTimerRunning) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleMainTimerExpired();
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

  // Steal 15s Timer Loop
  useEffect(() => {
    if (phase !== 'STEAL_WINDOW') return;

    const interval = setInterval(() => {
      setStealTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleStealExpired();
          return 0;
        }
        sound.playTick();
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  // Handle Main Timer Expiration
  const handleMainTimerExpired = () => {
    sound.playTimeout();
    setIsTimerRunning(false);
    setPhase('STEAL_WINDOW');
    setStealTimeLeft(15);
    broadcastSync({ phase: 'STEAL_WINDOW', stealTimeLeft: 15 });
  };

  // Handle Steal Expiration
  const handleStealExpired = () => {
    sound.playTimeout();
    setRoundResultText('انتهت فرصة السرقة ولم يُحرز أي فريق نقطة (0 pt)');
    setPhase('ROUND_RESULT');
    broadcastSync({ phase: 'ROUND_RESULT', roundResultText: 'انتهت فرصة السرقة (0 pt)' });
  };

  // Handle Referee Button Actions from Opponent Phone
  const handleRefereeAction = (payload: { action: 'CORRECT' | 'STEAL_SUCCESS' | 'STEAL_FAIL' }) => {
    const { action } = payload;
    const opponentTeam: EshrahTeamId = activeTeamRef.current === 'team_1' ? 'team_2' : 'team_1';

    if (action === 'CORRECT') {
      sound.playVictory();
      setIsTimerRunning(false);
      if (activeTeamRef.current === 'team_1') {
        setTeam1Score((prev) => prev + 1);
        team1ScoreRef.current += 1;
      } else {
        setTeam2Score((prev) => prev + 1);
        team2ScoreRef.current += 1;
      }
      const txt = `إجابة صحيحة! أحرز ${activeTeamRef.current === 'team_1' ? 'فريق 1' : 'فريق 2'} نقطة (+1 pt)`;
      setRoundResultText(txt);
      setPhase('ROUND_RESULT');
      broadcastSync({ phase: 'ROUND_RESULT', roundResultText: txt });
    } else if (action === 'STEAL_SUCCESS') {
      sound.playVictory();
      if (opponentTeam === 'team_1') {
        setTeam1Score((prev) => prev + 1);
        team1ScoreRef.current += 1;
      } else {
        setTeam2Score((prev) => prev + 1);
        team2ScoreRef.current += 1;
      }
      const txt = `سرقة ناجحة! أحرز ${opponentTeam === 'team_1' ? 'فريق 1' : 'فريق 2'} نقطة (+1 pt)`;
      setRoundResultText(txt);
      setPhase('ROUND_RESULT');
      broadcastSync({ phase: 'ROUND_RESULT', roundResultText: txt });
    } else if (action === 'STEAL_FAIL') {
      sound.playIncorrect();
      const txt = 'فشلت السرقة، لا توجد نقاط لهذه الجولة (0 pt)';
      setRoundResultText(txt);
      setPhase('ROUND_RESULT');
      broadcastSync({ phase: 'ROUND_RESULT', roundResultText: txt });
    }
  };

  // Advance Turn (5 rounds per team = 10 turns total)
  const handleAdvanceNextTurn = () => {
    sound.playClick();
    const nextTeam: EshrahTeamId = activeTeam === 'team_1' ? 'team_2' : 'team_1';
    let nextRound = currentRound;

    if (activeTeam === 'team_2') {
      nextRound += 1;
    }

    if (nextRound > 5) {
      sound.playVictory();
      setPhase('PODIUM');
      broadcastSync({ phase: 'PODIUM' });
      return;
    }

    const nextPrompt = getRandomPrompt(selectedCategories, usedPromptIds);
    setUsedPromptIds((prev) => new Set([...prev, nextPrompt.id]));
    setCurrentPrompt(nextPrompt);
    setActiveTeam(nextTeam);
    setCurrentRound(nextRound);
    setTimeLeft(60);
    setIsTimerRunning(false);
    setIsPromptRevealedOnTV(false);
    setPhase('ROUND_READY');

    broadcastSync({
      phase: 'ROUND_READY',
      activeTeam: nextTeam,
      currentRound: nextRound,
      prompt: nextPrompt,
      timeLeft: 60
    });
  };

  // Start Playing Turn
  const handleStartTurn = () => {
    sound.playRoundStart();
    setTimeLeft(60);
    setIsTimerRunning(true);
    setPhase('PLAYING');
    broadcastSync({ phase: 'PLAYING', timeLeft: 60 });
  };

  // Launch Match from Categories
  const handleLaunchMatch = () => {
    const firstPrompt = getRandomPrompt(selectedCategories, usedPromptIds);
    setUsedPromptIds(new Set([firstPrompt.id]));
    setCurrentPrompt(firstPrompt);
    setActiveTeam('team_1');
    setCurrentRound(1);
    setTeam1Score(0);
    setTeam2Score(0);
    setTimeLeft(60);
    setIsTimerRunning(false);
    setIsPromptRevealedOnTV(false);
    setPhase('ROUND_READY');

    broadcastSync({
      phase: 'ROUND_READY',
      activeTeam: 'team_1',
      currentRound: 1,
      team1Score: 0,
      team2Score: 0,
      prompt: firstPrompt,
      timeLeft: 60
    });
  };

  const categoryLabel = ESHRAH_CATEGORIES_CONFIG.find(
    (c) => c.id === currentPrompt?.category
  )?.label || 'عام';

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
      <div className="relative z-20">
        <EshrahTopBar
          roomCode={roomCode}
          gameTitle="حرّك الدمية"
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#5C4033] bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                جولة {currentRound} من 5
              </span>
              <span className={`text-xs font-black text-white px-4 py-1.5 rounded-xl border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] ${
                activeTeam === 'team_1' ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'
              }`}>
                دور: {activeTeam === 'team_1' ? 'فريق 1' : 'فريق 2'}
              </span>
            </div>

            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <div className="bg-[#E5E0D5] p-3 rounded-2xl border-2 border-[#2C2A29]">
                <UserCheck className="w-10 h-10 text-[#C68B59]" />
              </div>

              <h3 className="text-2xl font-black text-[#2C2A29]">
                استعد لتحريك الدمية!
              </h3>

              <div className="bg-[#E5E0D5]/70 border-2 border-[#2C2A29] rounded-2xl p-4 text-xs font-bold text-[#5C4033] text-right space-y-2 w-full">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-black text-[#8A9A5B]">1.</span>
                  <span><strong>الدمية:</strong> لاعب من الفريق يقف في الصالة <strong>بدون جوال</strong> ولا يتحرك إلا بتوجيه أطرافه.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-sm font-black text-[#8A9A5B]">2.</span>
                  <span><strong>فريق الدمية:</strong> يمسك الجوال لرؤية المشهد وتوجيه أطراف الدمية صامتاً بدون أي كلمة أو صوت!</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-sm font-black text-[#C68B59]">3.</span>
                  <span><strong>الفريق المنافس:</strong> يمسك جواله للتحكيم واحتساب الوقت والنقاط.</span>
                </div>
              </div>

              <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-xl px-4 py-2 text-xs font-bold text-[#2C2A29]">
                الفئة: <span className="font-black text-[#8A9A5B]">{categoryLabel}</span>
              </div>

              <button
                onClick={handleStartTurn}
                className="w-full bg-[#8A9A5B] hover:bg-[#78884d] active:scale-98 text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl py-4 font-black text-lg flex items-center justify-center gap-2 transition-all mt-2"
              >
                <Play className="w-6 h-6 fill-white" />
                <span>ابدأ الوقت (60 ثانية)</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= 4. PLAYING ================= */}
        {phase === 'PLAYING' && (
          <div className="w-full flex-1 flex flex-col items-center justify-between my-auto gap-6 max-w-2xl text-center">
            {/* Header info */}
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-black text-[#2C2A29] bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                جولة {currentRound} / 5
              </span>
              <div className={`px-4 py-1.5 rounded-xl border-2 border-[#2C2A29] font-black text-xs text-white shadow-[2px_2px_0px_#2C2A29] ${
                activeTeam === 'team_1' ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'
              }`}>
                الفريق الموجّه: {activeTeam === 'team_1' ? 'فريق 1' : 'فريق 2'}
              </div>
            </div>

            {/* Giant Timer */}
            <div className={`flex items-center justify-center gap-3 px-8 py-3 rounded-3xl border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] ${
              timeLeft <= 10 ? 'bg-[#C68B59] text-white animate-pulse' : 'bg-[#F7F4EC] text-[#2C2A29]'
            }`}>
              <Clock className="w-8 h-8" />
              <span className="text-5xl font-black font-mono tracking-wider">
                00:{timeLeft.toString().padStart(2, '0')}
              </span>
            </div>

            {/* Central Card */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-8 shadow-[6px_6px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl text-xs font-black text-[#5C4033]">
                الفئة: {categoryLabel}
              </div>

              <div className="py-4">
                {isPromptRevealedOnTV ? (
                  <div className="text-4xl md:text-5xl font-black text-[#2C2A29]">
                    {currentPrompt?.text}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-lg font-black text-[#5C4033]">
                      المشهد سرّي ومعروض على جوال الفريق الموجّه 📱
                    </span>
                    <span className="text-xs font-bold text-[#8A9A5B]">
                      الدمية تقف في الصالة بدون جوال ويتم تحريك أطرافها صامتاً!
                    </span>
                  </div>
                )}
              </div>

              {/* Reveal toggle for host if desired */}
              <button
                onClick={() => setIsPromptRevealedOnTV(!isPromptRevealedOnTV)}
                className="bg-[#E5E0D5] hover:bg-[#d8d2c5] text-[#2C2A29] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl px-4 py-1.5 text-xs font-bold flex items-center gap-2"
              >
                {isPromptRevealedOnTV ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{isPromptRevealedOnTV ? 'إخفاء المشهد عن الشاشة' : 'إظهار المشهد للمشاهدين'}</span>
              </button>
            </div>

            {/* Bottom Status */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl px-6 py-3 shadow-[3px_3px_0px_#2C2A29] text-xs font-bold text-[#5C4033]">
              التحكيم والوقت بيد الفريق المنافس عبر جوالهم
            </div>
          </div>
        )}

        {/* ================= 5. STEAL WINDOW ================= */}
        {phase === 'STEAL_WINDOW' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto gap-6 max-w-xl text-center">
            <div className="bg-[#C68B59] text-white border-2 border-[#2C2A29] px-6 py-2 rounded-2xl shadow-[4px_4px_0px_#2C2A29] text-sm font-black flex items-center gap-2 animate-bounce">
              <AlertTriangle className="w-5 h-5 stroke-[3]" />
              <span>فرصة سرقة للفريق المنافس!</span>
            </div>

            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-8 shadow-[6px_6px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <span className="text-sm font-black text-[#5C4033]">
                حق التخمين انتقل لـ: {activeTeam === 'team_1' ? 'فريق 2' : 'فريق 1'}
              </span>

              <div className="flex items-center justify-center gap-3 px-6 py-2 rounded-2xl bg-[#C68B59] text-white border-2 border-[#2C2A29]">
                <Clock className="w-6 h-6" />
                <span className="text-3xl font-black font-mono">
                  00:{stealTimeLeft.toString().padStart(2, '0')}
                </span>
              </div>

              <p className="text-xs font-bold text-[#5C4033]">
                إذا عرف الفريق المنافس المشهد يضغط على "سرقة صحيحة (+1 pt)" في جواله!
              </p>
            </div>
          </div>
        )}

        {/* ================= 6. ROUND RESULT ================= */}
        {phase === 'ROUND_RESULT' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto gap-6 max-w-lg text-center">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-8 shadow-[6px_6px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <CheckCircle2 className="w-12 h-12 text-[#8A9A5B]" />
              <h3 className="text-2xl font-black text-[#2C2A29]">
                {roundResultText || 'انتهت الجولة'}
              </h3>

              <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-2xl p-4 w-full">
                <span className="text-xs font-bold text-[#5C4033] block mb-1">المشهد كان:</span>
                <span className="text-2xl font-black text-[#2C2A29]">{currentPrompt?.text}</span>
              </div>

              {/* Current Score Cards */}
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-[#8A9A5B]/15 border-2 border-[#2C2A29] rounded-2xl p-3">
                  <div className="text-xs font-bold text-[#2C2A29]">فريق 1</div>
                  <div className="text-3xl font-black text-[#8A9A5B]">{team1Score} pt</div>
                </div>
                <div className="bg-[#C68B59]/15 border-2 border-[#2C2A29] rounded-2xl p-3">
                  <div className="text-xs font-bold text-[#2C2A29]">فريق 2</div>
                  <div className="text-3xl font-black text-[#C68B59]">{team2Score} pt</div>
                </div>
              </div>

              <button
                onClick={handleAdvanceNextTurn}
                className="w-full bg-[#8A9A5B] hover:bg-[#78884d] active:scale-98 text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl py-3.5 font-black text-base transition-all mt-2"
              >
                الدور التالي ➔
              </button>
            </div>
          </div>
        )}

        {/* ================= 7. PODIUM ================= */}
        {phase === 'PODIUM' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto">
            <EshrahPodium
              team1Score={team1Score}
              team2Score={team2Score}
              onPlayAgain={() => {
                sound.playClick();
                handleLaunchMatch();
              }}
              onBackToHome={() => navigate('/')}
            />
          </div>
        )}

        {/* Bottom scoreboard in non-podium phases */}
        {phase !== 'PODIUM' && phase !== 'TEAMS' && phase !== 'CATEGORIES' && (
          <div className="w-full flex items-center justify-center gap-6 mt-4">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl px-6 py-2 shadow-[3px_3px_0px_#2C2A29] flex items-center gap-6 text-sm font-black">
              <span className="text-[#8A9A5B]">فريق 1: {team1Score} pt</span>
              <span className="text-[#2C2A29]/30">|</span>
              <span className="text-[#C68B59]">فريق 2: {team2Score} pt</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
