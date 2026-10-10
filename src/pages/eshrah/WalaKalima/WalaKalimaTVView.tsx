import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Trophy, Play, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
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

export const WalaKalimaTVView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // State
  const [phase, setPhase] = useState<EshrahGamePhase>('TEAMS');
  const [players, setPlayers] = useState<EshrahPlayer[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<EshrahCategory[]>([
    'football', 'tv_series', 'movies', 'proverbs'
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
      event: 'WALA_KALIMA_SYNC',
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

    const channel = supabase.channel(`wala_kalima:${normalizedCode}`, {
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

        // Deduplicate
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
      const txt = `إجابة صحيحة! أحرز ${activeTeamRef.current === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'} نقطة (+1 pt)`;
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
      const txt = `سرقة ناجحة! أحرز ${opponentTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'} نقطة (+1 pt)`;
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

    // When switching from team 2 back to team 1, increment round number
    if (activeTeam === 'team_2') {
      nextRound += 1;
    }

    if (nextRound > 5) {
      // Game Over -> Podium
      sound.playVictory();
      setPhase('PODIUM');
      broadcastSync({ phase: 'PODIUM' });
      return;
    }

    // Prepare next turn
    const newPrompt = getRandomPrompt(selectedCategories, usedPromptIds);
    setUsedPromptIds((prev) => new Set([...prev, newPrompt.id]));
    setCurrentPrompt(newPrompt);
    setActiveTeam(nextTeam);
    setCurrentRound(nextRound);
    setTimeLeft(60);
    setStealTimeLeft(15);
    setPhase('ROUND_READY');

    broadcastSync({
      phase: 'ROUND_READY',
      activeTeam: nextTeam,
      currentRound: nextRound,
      prompt: newPrompt,
      timeLeft: 60,
      stealTimeLeft: 15
    });
  };

  // Start Playing Active Round (60s timer)
  const handleStartRound = () => {
    sound.playRoundStart();
    setTimeLeft(60);
    setIsTimerRunning(true);
    setPhase('PLAYING');
    broadcastSync({ phase: 'PLAYING', timeLeft: 60 });
  };

  // Launch Match from Category Picker
  const handleLaunchMatch = () => {
    const firstPrompt = getRandomPrompt(selectedCategories, usedPromptIds);
    setUsedPromptIds(new Set([firstPrompt.id]));
    setCurrentPrompt(firstPrompt);
    setActiveTeam('team_1');
    setCurrentRound(1);
    setTeam1Score(0);
    setTeam2Score(0);
    setTimeLeft(60);
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

  const activeCategoryLabel = ESHRAH_CATEGORIES_CONFIG.find(
    (c) => c.id === currentPrompt?.category
  )?.label || 'عام';

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
          gameTitle="ولا كلمة"
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
        {/* ================= 1. TEAM SELECTION PHASE ================= */}
        {phase === 'TEAMS' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto">
            <CleanTeamSelection
              players={players}
              isHost={true}
              onJoinTeam={(teamId) => {
                // TV host can also pick if desired
              }}
              onConfirmTeams={() => {
                sound.playClick();
                setPhase('CATEGORIES');
                broadcastSync({ phase: 'CATEGORIES' });
              }}
            />
          </div>
        )}

        {/* ================= 2. CATEGORY PICKER PHASE ================= */}
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

        {/* ================= 3. ROUND READY PHASE ================= */}
        {phase === 'ROUND_READY' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center gap-6 my-auto text-center max-w-xl">
            <span className="text-xs font-black text-[#5C4033] bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
              جولة {currentRound} من 5 ({activeTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'})
            </span>

            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <span className="text-sm font-bold text-[#5C4033]">فئة الكلمة المطلوبة:</span>
              <div className="text-2xl md:text-3xl font-black text-[#8A9A5B] bg-[#E5E0D5] px-6 py-2 rounded-2xl border-2 border-[#2C2A29]">
                {activeCategoryLabel}
              </div>

              <div className="text-xs font-bold text-[#5C4033] leading-relaxed max-w-sm mt-2">
                على ممثل <strong className="text-[#2C2A29]">{activeTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'}</strong> النظر إلى جوال فريقه لرؤية الكلمة السرية، وبدء التمثيل الصامت فور انطلاق المؤقت!
              </div>

              <button
                onClick={handleStartRound}
                className="w-full py-4 mt-2 rounded-2xl font-black text-lg bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] hover:bg-[#78884e] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play size={20} />
                <span>بدء المؤقت (60 ثانية)</span>
              </button>
            </div>

            {/* Score Strip */}
            <div className="w-full flex justify-around items-center bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-3 shadow-[3px_3px_0px_#2C2A29]">
              <span className="text-sm font-black text-[#8A9A5B]">الفريق الأول: {team1Score} pt</span>
              <span className="text-xs text-[#5C4033]">|</span>
              <span className="text-sm font-black text-[#C68B59]">الفريق الثاني: {team2Score} pt</span>
            </div>
          </div>
        )}

        {/* ================= 4. PLAYING (60s ACTING) ================= */}
        {phase === 'PLAYING' && (
          <div className="w-full flex-1 flex flex-col items-center justify-between my-auto gap-6 max-w-2xl">
            {/* Header Status */}
            <div className="flex justify-between items-center w-full bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-4 shadow-[3px_3px_0px_#2C2A29]">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3.5 h-3.5 rounded-full border border-[#2C2A29] ${
                    activeTeam === 'team_1' ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'
                  }`}
                />
                <span className="text-sm md:text-base font-black text-[#2C2A29]">
                  الفريق الممثل: {activeTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'}
                </span>
              </div>
              <span className="text-xs font-black bg-[#E5E0D5] border border-[#2C2A29] px-3 py-1 rounded-xl">
                فئة: {activeCategoryLabel}
              </span>
            </div>

            {/* Big Countdown Timer */}
            <div className="flex flex-col items-center justify-center bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-3xl p-8 w-full text-center">
              <span className="text-xs font-black text-[#5C4033] mb-2">الوقت المتبقي للتمثيل</span>
              <div
                className={`text-6xl md:text-8xl font-black font-mono tracking-tight ${
                  timeLeft <= 10 ? 'text-[#C86D51]' : 'text-[#2C2A29]'
                }`}
              >
                0:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-full overflow-hidden mt-6 shadow-inner">
                <div
                  className={`h-full transition-all duration-1000 ease-linear ${
                    timeLeft <= 10 ? 'bg-[#C86D51]' : 'bg-[#8A9A5B]'
                  }`}
                  style={{ width: `${(timeLeft / 60) * 100}%` }}
                />
              </div>

              <div className="text-xs font-bold text-[#5C4033] mt-4 flex items-center justify-center gap-2">
                <ShieldCheck size={16} className="text-[#8A9A5B]" />
                <span>التحكيم بيد الفريق المنافس ({activeTeam === 'team_1' ? 'الفريق الثاني' : 'الفريق الأول'}) عبر الجوال</span>
              </div>
            </div>

            {/* Score Strip */}
            <div className="w-full flex justify-around items-center bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-3 shadow-[3px_3px_0px_#2C2A29]">
              <span className="text-sm font-black text-[#8A9A5B]">الفريق الأول: {team1Score} pt</span>
              <span className="text-xs text-[#5C4033]">الجولة {currentRound} / 5</span>
              <span className="text-sm font-black text-[#C68B59]">الفريق الثاني: {team2Score} pt</span>
            </div>
          </div>
        )}

        {/* ================= 5. STEAL WINDOW (15s STEAL) ================= */}
        {phase === 'STEAL_WINDOW' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center gap-6 my-auto text-center max-w-xl">
            <div className="bg-[#C68B59] text-white border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-3xl p-6 w-full flex flex-col items-center gap-3">
              <AlertTriangle size={36} />
              <h3 className="text-2xl md:text-3xl font-black">فرصة سرقة للفريق المنافس!</h3>
              <p className="text-xs md:text-sm font-bold opacity-90">
                انتهى وقت الفريق الممثل. يحق لـ{' '}
                <strong>{activeTeam === 'team_1' ? 'الفريق الثاني' : 'الفريق الأول'}</strong> تخمين الإجابة
                مرة واحدة بصوت عالٍ!
              </p>

              <div className="text-5xl font-black font-mono bg-white text-[#C68B59] px-6 py-2 rounded-2xl border-2 border-[#2C2A29] my-2">
                0:{stealTimeLeft < 10 ? `0${stealTimeLeft}` : stealTimeLeft}
              </div>

              <span className="text-xs font-bold bg-[#E5E0D5] text-[#2C2A29] px-3 py-1 rounded-xl border border-[#2C2A29]">
                التحكيم واحتساب السرقة عبر جوال الفريق المنافس
              </span>
            </div>
          </div>
        )}

        {/* ================= 6. ROUND RESULT ================= */}
        {phase === 'ROUND_RESULT' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center gap-6 my-auto text-center max-w-lg">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <span className="text-xs font-black text-[#5C4033] bg-[#E5E0D5] px-3 py-1 rounded-xl border border-[#2C2A29]">
                نتيجة الجولة
              </span>

              <h3 className="text-xl md:text-2xl font-black text-[#2C2A29]">
                {roundResultText}
              </h3>

              <div className="w-full p-4 rounded-2xl bg-[#E5E0D5] border-2 border-[#2C2A29] flex flex-col gap-1 text-center my-2">
                <span className="text-xs font-bold text-[#5C4033]">الكلمة كانت:</span>
                <span className="text-2xl font-black text-[#8A9A5B]">{currentPrompt?.text}</span>
              </div>

              {/* Action: Next Turn */}
              <button
                onClick={handleAdvanceNextTurn}
                className="w-full py-3.5 rounded-2xl font-black text-base bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] hover:bg-[#78884e] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>الانتقال للدور التالي</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= 7. PODIUM ================= */}
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
