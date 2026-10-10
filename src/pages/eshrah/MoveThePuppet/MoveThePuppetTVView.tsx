import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Trophy, Play, CheckCircle2, AlertTriangle, ShieldCheck, UserCheck, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { EshrahTopBar } from '../../../components/eshrah/EshrahTopBar';
import { EshrahTVLobby } from '../../../components/eshrah/EshrahTVLobby';
import { EshrahPodium } from '../../../components/eshrah/EshrahPodium';
import {
  EshrahPlayer,
  EshrahTeamId,
  EshrahGamePhase
} from '../../../types/eshrah';
import { PuppetActionItem, getRandomPuppetAction } from '../../../data/puppetActionsBank';
import { sound } from '../../../lib/audio';

export const MoveThePuppetTVView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // State
  const [phase, setPhase] = useState<EshrahGamePhase>('TEAMS');
  const [players, setPlayers] = useState<EshrahPlayer[]>([]);
  const [activeTeam, setActiveTeam] = useState<EshrahTeamId>('team_1');
  const [currentRound, setCurrentRound] = useState<number>(1); // 1 to 5 per team
  const [team1Score, setTeam1Score] = useState<number>(0);
  const [team2Score, setTeam2Score] = useState<number>(0);
  const [currentAction, setCurrentAction] = useState<PuppetActionItem | null>(null);
  const [usedActionIds, setUsedActionIds] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [stealTimeLeft, setStealTimeLeft] = useState<number>(15);
  const [isPromptRevealedOnTV, setIsPromptRevealedOnTV] = useState<boolean>(false);

  // Channel ref singleton
  const channelRef = useRef<RealtimeChannel | null>(null);
  const phaseRef = useRef(phase);
  const playersRef = useRef(players);
  const activeTeamRef = useRef(activeTeam);
  const team1ScoreRef = useRef(team1Score);
  const team2ScoreRef = useRef(team2Score);
  const currentActionRef = useRef(currentAction);
  const currentRoundRef = useRef(currentRound);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { activeTeamRef.current = activeTeam; }, [activeTeam]);
  useEffect(() => { team1ScoreRef.current = team1Score; }, [team1Score]);
  useEffect(() => { team2ScoreRef.current = team2Score; }, [team2Score]);
  useEffect(() => { currentActionRef.current = currentAction; }, [currentAction]);
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
        action: currentActionRef.current,
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
      .on('broadcast', { event: 'EXPLAINER_READY_START' }, () => {
        handleStartDirecting();
      })
      .on('broadcast', { event: 'REFEREE_ACTION' }, ({ payload }) => {
        handleRefereeAction(payload);
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

  // Directing Team clicks [جاهز - ابدأ الوقت] on mobile
  const handleStartDirecting = () => {
    sound.playRoundStart();
    setTimeLeft(60);
    setIsTimerRunning(true);
    setPhase('PLAYING');
    broadcastSync({ phase: 'PLAYING', timeLeft: 60 });
  };

  // Main Timer Expiration -> Open 15s Steal Window
  const handleMainTimerExpired = () => {
    sound.playTimeout();
    setIsTimerRunning(false);
    setPhase('STEAL_WINDOW');
    setStealTimeLeft(15);
    broadcastSync({ phase: 'STEAL_WINDOW', stealTimeLeft: 15 });
  };

  // Steal Expired -> Instant transition to next turn
  const handleStealExpired = () => {
    sound.playTimeout();
    handleAdvanceNextTurn();
  };

  // Referee Action (Correct / Steal / Fail) -> Instant Round Progression!
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
      // Instant transition!
      handleAdvanceNextTurn();
    } else if (action === 'STEAL_SUCCESS') {
      sound.playVictory();
      if (opponentTeam === 'team_1') {
        setTeam1Score((prev) => prev + 1);
        team1ScoreRef.current += 1;
      } else {
        setTeam2Score((prev) => prev + 1);
        team2ScoreRef.current += 1;
      }
      // Instant transition!
      handleAdvanceNextTurn();
    } else if (action === 'STEAL_FAIL') {
      sound.playIncorrect();
      // Instant transition!
      handleAdvanceNextTurn();
    }
  };

  // Advance Next Turn (5 rounds per team = 10 turns total)
  const handleAdvanceNextTurn = () => {
    const nextTeam: EshrahTeamId = activeTeamRef.current === 'team_1' ? 'team_2' : 'team_1';
    let nextRound = currentRoundRef.current;

    if (activeTeamRef.current === 'team_2') {
      nextRound += 1;
    }

    if (nextRound > 5) {
      sound.playVictory();
      setPhase('PODIUM');
      broadcastSync({
        phase: 'PODIUM',
        team1Score: team1ScoreRef.current,
        team2Score: team2ScoreRef.current
      });
      return;
    }

    const nextAct = getRandomPuppetAction(usedActionIds);
    setUsedActionIds((prev) => new Set([...prev, nextAct.id]));
    setCurrentAction(nextAct);
    currentActionRef.current = nextAct;
    setActiveTeam(nextTeam);
    activeTeamRef.current = nextTeam;
    setCurrentRound(nextRound);
    currentRoundRef.current = nextRound;
    setTimeLeft(60);
    setIsTimerRunning(false);
    setIsPromptRevealedOnTV(false);
    setPhase('PREP_WORD');

    broadcastSync({
      phase: 'PREP_WORD',
      activeTeam: nextTeam,
      currentRound: nextRound,
      action: nextAct,
      team1Score: team1ScoreRef.current,
      team2Score: team2ScoreRef.current,
      timeLeft: 60
    });
  };

  // Launch Match from Lobby (NO CATEGORY SELECTION)
  const handleLaunchMatch = () => {
    const firstAct = getRandomPuppetAction(usedActionIds);
    setUsedActionIds(new Set([firstAct.id]));
    setCurrentAction(firstAct);
    currentActionRef.current = firstAct;
    setActiveTeam('team_1');
    activeTeamRef.current = 'team_1';
    setCurrentRound(1);
    currentRoundRef.current = 1;
    setTeam1Score(0);
    setTeam2Score(0);
    setTimeLeft(60);
    setIsTimerRunning(false);
    setIsPromptRevealedOnTV(false);
    setPhase('PREP_WORD');

    broadcastSync({
      phase: 'PREP_WORD',
      activeTeam: 'team_1',
      currentRound: 1,
      team1Score: 0,
      team2Score: 0,
      action: firstAct,
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
      <div className="relative z-20">
        <EshrahTopBar
          roomCode={roomCode}
          gameTitle="حرّك الدمية"
          phase={phase}
          onTerminate={handleEndRoom}
          onExit={handleEndRoom}
        />
      </div>

      <main className="flex-1 flex flex-col items-center justify-between p-4 md:p-6 relative z-10 max-w-6xl mx-auto w-full">
        {/* ================= 1. TEAMS (LOBBY) ================= */}
        {phase === 'TEAMS' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto">
            <EshrahTVLobby
              roomCode={roomCode}
              gameTitle="حرّك الدمية"
              gameRuleSnippet="توجيه جسدي وحركي صامت! لاعب من الفريق (الدمية) يقف في الصالة بدون جوال ولا يتحرك إلا بتوجيه أطرافه. فريقه يمسك الجوال لتوجيهه صامتاً لتجسيد المشهد، والمنافس يمسك الجوال لاحتساب الإجابة الصحيحة أو السرقة!"
              players={players}
              onStartMatch={handleLaunchMatch}
            />
          </div>
        )}

        {/* ================= 2. PREP WORD (STANDBY) ================= */}
        {phase === 'PREP_WORD' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center gap-6 my-auto text-center max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#5C4033] bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                جولة {currentRound} من 5
              </span>
              <span className={`text-xs font-black text-white px-4 py-1.5 rounded-xl border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] ${
                activeTeam === 'team_1' ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'
              }`}>
                دور التوجيه: {activeTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'}
              </span>
            </div>

            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-8 shadow-[6px_6px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <div className="bg-[#E5E0D5] p-3 rounded-2xl border-2 border-[#2C2A29]">
                <UserCheck className="w-10 h-10 text-[#C68B59]" />
              </div>

              <h3 className="text-2xl font-black text-[#2C2A29]">
                الفريق الموجّه يستعد لتحريك الدمية!
              </h3>

              <div className="bg-[#E5E0D5]/70 border-2 border-[#2C2A29] rounded-2xl p-4 text-xs font-bold text-[#5C4033] text-right space-y-2 w-full">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-black text-[#8A9A5B]">1.</span>
                  <span><strong>الدمية:</strong> يقف في الصالة <strong>بدون جوال</strong> ولا يتحرك إلا عند تحريك أطرافه.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-sm font-black text-[#8A9A5B]">2.</span>
                  <span><strong>الفريق الموجّه:</strong> يقرأ الحركة في جواله ويضغط <strong>[جاهز]</strong> لبدء الـ 60 ثانية.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 3. PLAYING (60s ACTIVE) ================= */}
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
                الفريق الموجّه: {activeTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'}
              </div>
            </div>

            {/* Giant Timer */}
            <div className={`flex items-center justify-center gap-3 px-8 py-3 rounded-3xl border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] ${
              timeLeft <= 10 ? 'bg-[#C86D51] text-white animate-pulse' : 'bg-[#F7F4EC] text-[#2C2A29]'
            }`}>
              <Clock className="w-8 h-8" />
              <span className="text-5xl font-black font-mono tracking-wider">
                00:{timeLeft.toString().padStart(2, '0')}
              </span>
            </div>

            {/* Central Card */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-8 shadow-[6px_6px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <div className="py-2">
                {isPromptRevealedOnTV ? (
                  <div className="text-3xl md:text-4xl font-black text-[#2C2A29]">
                    {currentAction?.action}
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
                className="bg-[#E5E0D5] hover:bg-[#d8d2c5] text-[#2C2A29] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl px-4 py-1.5 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                {isPromptRevealedOnTV ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{isPromptRevealedOnTV ? 'إخفاء الحركة عن الشاشة' : 'إظهار الحركة للمشاهدين'}</span>
              </button>
            </div>

            {/* Bottom Status */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl px-6 py-3 shadow-[3px_3px_0px_#2C2A29] text-xs font-bold text-[#5C4033]">
              التحكيم واحتساب الإجابة الصحيحة بيد الفريق المنافس عبر جوالهم
            </div>
          </div>
        )}

        {/* ================= 4. STEAL WINDOW (15s) ================= */}
        {phase === 'STEAL_WINDOW' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto gap-6 max-w-xl text-center">
            <div className="bg-[#C68B59] text-white border-2 border-[#2C2A29] px-6 py-2 rounded-2xl shadow-[4px_4px_0px_#2C2A29] text-sm font-black flex items-center gap-2 animate-bounce">
              <AlertTriangle className="w-5 h-5 stroke-[3]" />
              <span>فرصة سرقة للفريق المنافس!</span>
            </div>

            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-8 shadow-[6px_6px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <span className="text-sm font-black text-[#5C4033]">
                حق التخمين انتقل لـ: {activeTeam === 'team_1' ? 'الفريق الثاني' : 'الفريق الأول'}
              </span>

              <div className="flex items-center justify-center gap-3 px-6 py-2 rounded-2xl bg-[#C68B59] text-white border-2 border-[#2C2A29]">
                <Clock className="w-6 h-6" />
                <span className="text-3xl font-black font-mono">
                  00:{stealTimeLeft.toString().padStart(2, '0')}
                </span>
              </div>

              <p className="text-xs font-bold text-[#5C4033]">
                إذا عرف الفريق المنافس الحركة يضغط على [سرقة صحيحة (+1 pt)] في جواله!
              </p>
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

        {/* Bottom scoreboard in non-podium phases */}
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
