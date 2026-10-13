import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Play, Users, Trophy, RotateCcw, ArrowLeft, CheckCircle2, Clock, Award, Sparkles, User, Zap } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ChainTopBar } from './components/ChainTopBar';
import {
  ChainGamePhase,
  ChainChallenge,
  ChainContestantProgress,
  ChainEventPayload,
  WinningChainReveal,
} from './types';
import { getRandomChainChallenges, CHAIN_CHALLENGES_BANK } from '../../../data/chainChallenges';
import { sound } from '../../../lib/audio';

export const ChainTVView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // Core Game State (Strictly 5 Rounds)
  const TOTAL_ROUNDS = 5;
  const ROUND_DURATION_SEC = 90;

  const [phase, setPhase] = useState<ChainGamePhase>('LOBBY');
  const [round, setRound] = useState<number>(1);
  const [challenges, setChallenges] = useState<ChainChallenge[]>(() => getRandomChainChallenges(TOTAL_ROUNDS));
  const [currentChallenge, setCurrentChallenge] = useState<ChainChallenge | null>(null);

  // Contestants & Live Race Tracking
  const [contestants, setContestants] = useState<ChainContestantProgress[]>([]);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(ROUND_DURATION_SEC);
  const [winningReveal, setWinningReveal] = useState<WinningChainReveal | null>(null);

  // Match cumulative leaderboards
  const [leaderboard, setLeaderboard] = useState<Record<string, { score: number; wins: number; name: string; teamLogo?: string }>>({});

  // Realtime References
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef<boolean>(false);
  const phaseRef = useRef<ChainGamePhase>(phase);
  const contestantsRef = useRef<ChainContestantProgress[]>(contestants);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { contestantsRef.current = contestants; }, [contestants]);

  // Safe Broadcast to all mobiles
  const broadcastEvent = useCallback((payload: ChainEventPayload) => {
    if (!channelRef.current || !isSubscribedRef.current) {
      console.warn('[Realtime Chain TV] Cannot send event - channel not SUBSCRIBED yet:', payload.action);
      return;
    }
    channelRef.current.send({
      type: 'broadcast',
      event: 'chain_event',
      payload,
    });
  }, []);

  // Supabase Realtime Setup
  useEffect(() => {
    if (!roomCode) return;

    const channelId = `chain:${roomCode}`;
    const existingChannel = supabase.getChannels().find(
      (ch) => ch.topic === `realtime:${channelId}` || ch.topic === channelId
    );
    if (existingChannel) supabase.removeChannel(existingChannel);

    const channel = supabase.channel(channelId, {
      config: {
        broadcast: { self: true },
        presence: { key: 'host_tv' },
      },
    });

    const syncConnectedPlayers = () => {
      const state = channel.presenceState();
      const playerList: any[] = [];
      const seenIds = new Set<string>();

      Object.values(state).forEach((presences: any) => {
        if (Array.isArray(presences)) {
          presences.forEach((p) => {
            if (p && p.id && p.id !== 'host_tv' && !seenIds.has(p.id)) {
              seenIds.add(p.id);
              playerList.push(p);
            }
          });
        }
      });

      setContestants((prev) => {
        const existingMap = new Map(prev.map((c) => [c.playerId, c]));
        return playerList.map((entry) => {
          const existing = existingMap.get(entry.id);
          return {
            playerId: entry.id,
            playerName: entry.name || existing?.playerName || 'متسابق',
            teamLogo: entry.teamLogo || existing?.teamLogo,
            teamName: entry.teamName || existing?.teamName,
            currentStepCount: existing?.currentStepCount || 0,
            hasFinished: existing?.hasFinished || false,
            score: existing?.score || 0,
            roundWins: existing?.roundWins || 0,
          };
        });
      });
    };

    channel
      .on('presence', { event: 'sync' }, syncConnectedPlayers)
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        sound.playPlayerJoin();
        syncConnectedPlayers();
      })
      .on('presence', { event: 'leave' }, () => {
        syncConnectedPlayers();
      })
      .on('broadcast', { event: 'chain_event' }, ({ payload }) => {
        if (!payload) return;
        const ev = payload as ChainEventPayload;

        if (ev.action === 'STEP_ADVANCED' && ev.playerId) {
          // Increment contestant's step count on the live track without revealing names
          setContestants((prev) =>
            prev.map((c) =>
              c.playerId === ev.playerId
                ? { ...c, currentStepCount: ev.stepCount || c.currentStepCount + 1 }
                : c
            )
          );
        } else if (ev.action === 'STEP_BACKTRACKED' && ev.playerId) {
          // Contestant backtracked a step
          setContestants((prev) =>
            prev.map((c) =>
              c.playerId === ev.playerId
                ? { ...c, currentStepCount: Math.max(0, ev.stepCount ?? (c.currentStepCount - 1)) }
                : c
            )
          );
        } else if (ev.action === 'CHAIN_COMPLETED' && ev.winningReveal) {
          // Round Finished with a Winner!
          const reveal = ev.winningReveal;
          setWinningReveal(reveal);
          setPhase('ROUND_PODIUM');

          // Update Leaderboard
          setLeaderboard((prev) => {
            const current = prev[reveal.winnerId] || {
              score: 0,
              wins: 0,
              name: reveal.winnerName,
              teamLogo: reveal.winnerTeamLogo,
            };
            return {
              ...prev,
              [reveal.winnerId]: {
                ...current,
                score: current.score + reveal.totalPoints,
                wins: current.wins + 1,
              },
            };
          });

          // Update contestant state
          setContestants((prev) =>
            prev.map((c) =>
              c.playerId === reveal.winnerId
                ? {
                    ...c,
                    hasFinished: true,
                    score: c.score + reveal.totalPoints,
                    roundWins: c.roundWins + 1,
                    currentStepCount: reveal.stepsCount,
                  }
                : c
            )
          );

          sound.playVictory();
        } else if (ev.action === 'PLAYER_NEXT_ROUND_READY') {
          sound.playClick();
        }
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribedRef.current = true;
      }
    });

    channelRef.current = channel;

    return () => {
      isSubscribedRef.current = false;
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode]);

  // Round Timer Countdown
  useEffect(() => {
    if (phase !== 'RACE_ACTIVE') return;

    const interval = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          // Timer expired!
          handleRoundTimeout();
          return 0;
        }
        if (prev <= 10) {
          sound.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  // Handle Timeout without complete winner
  const handleRoundTimeout = useCallback(() => {
    sound.playIncorrect();

    // Check if anyone made partial steps
    const highestStepContestant = [...contestantsRef.current].sort((a, b) => b.currentStepCount - a.currentStepCount)[0];

    const currentCh = currentChallenge || challenges[0];

    const fallbackReveal: WinningChainReveal = {
      winnerId: highestStepContestant?.playerId || '',
      winnerName: highestStepContestant?.playerName || 'انتهى الوقت!',
      winnerTeamLogo: highestStepContestant?.teamLogo,
      stepsCount: highestStepContestant?.currentStepCount || 0,
      chainSteps: [],
      startPlayer: currentCh.startPlayer,
      targetPlayer: currentCh.targetPlayer,
      bonusPoints: 0,
      totalPoints: highestStepContestant ? 2 : 0,
    };

    setWinningReveal(fallbackReveal);
    setPhase('ROUND_PODIUM');

    broadcastEvent({
      action: 'ROUND_TIMEOUT',
      winningReveal: fallbackReveal,
    });
  }, [currentChallenge, challenges, broadcastEvent]);

  // Start Game (Host Action)
  const handleStartGame = () => {
    if (contestants.length === 0) {
      alert('يجب انضمام متسابق واحد على الأقل لبدء المنافسة!');
      return;
    }

    sound.playRoundStart();
    const challengeList = getRandomChainChallenges(TOTAL_ROUNDS);
    setChallenges(challengeList);
    const firstChallenge = challengeList[0];
    setCurrentChallenge(firstChallenge);
    setRound(1);
    setTimeLeftSec(ROUND_DURATION_SEC);
    setPhase('RACE_ACTIVE');
    setWinningReveal(null);

    // Reset contestant step counters for race
    setContestants((prev) =>
      prev.map((c) => ({
        ...c,
        currentStepCount: 0,
        hasFinished: false,
      }))
    );

    broadcastEvent({
      action: 'GAME_START',
      round: 1,
      totalRounds: TOTAL_ROUNDS,
      challenge: firstChallenge,
    });
  };

  // Advance to Next Round (Host Action)
  const handleNextRound = () => {
    if (round >= TOTAL_ROUNDS) {
      setPhase('MATCH_OVER');
      sound.playVictory();
      return;
    }

    sound.playRoundStart();
    const nextRound = round + 1;
    const nextChallenge = challenges[nextRound - 1] || challenges[0];

    setRound(nextRound);
    setCurrentChallenge(nextChallenge);
    setTimeLeftSec(ROUND_DURATION_SEC);
    setPhase('RACE_ACTIVE');
    setWinningReveal(null);

    setContestants((prev) =>
      prev.map((c) => ({
        ...c,
        currentStepCount: 0,
        hasFinished: false,
      }))
    );

    broadcastEvent({
      action: 'START_NEXT_ROUND',
      round: nextRound,
      totalRounds: TOTAL_ROUNDS,
      challenge: nextChallenge,
    });
  };

  // Reset to Lobby
  const handleResetLobby = () => {
    sound.playClick();
    setPhase('LOBBY');
    setRound(1);
    setTimeLeftSec(ROUND_DURATION_SEC);
    setWinningReveal(null);
    setContestants((prev) =>
      prev.map((c) => ({
        ...c,
        currentStepCount: 0,
        hasFinished: false,
        score: 0,
        roundWins: 0,
      }))
    );

    broadcastEvent({
      action: 'RESET_LOBBY',
    });
  };

  const joinUrl = `${window.location.origin}/room/${roomCode}/football/football-chain`;

  return (
    <div
      className="min-h-screen w-full bg-[#E5E0D5] text-[#2C2A29] flex flex-col font-sans select-none overflow-x-hidden relative"
      dir="rtl"
    >
      <ChainTopBar
        roomCode={roomCode}
        round={phase !== 'LOBBY' ? round : undefined}
        totalRounds={TOTAL_ROUNDS}
        timeLeft={phase === 'RACE_ACTIVE' ? timeLeftSec : undefined}
        onEndRoom={() => navigate('/')}
      />

      <main className="flex-1 flex flex-col p-4 md:p-8 max-w-6xl mx-auto w-full justify-between items-center">
        {/* =======================================================
            STATE 1: LOBBY
            ======================================================= */}
        {phase === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl space-y-8 animate-fade-in text-center my-auto">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 bg-[#8A9A5B] text-white px-4 py-1.5 rounded-full border-2 border-[#2C2A29] font-black text-sm shadow-[3px_3px_0px_#2C2A29]">
                <span>🔗 لعبة العلاقات وزمالة اللاعبين</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-[#2C2A29] tracking-tight">
                سِكّة اللاعبين
              </h1>
              <p className="text-base md:text-xl font-bold text-[#5C4033] max-w-2xl mx-auto">
                من لاعب البداية إلى لاعب الهدف.. ابنِ أسرع سلسلة ربط بين اللاعبين عبر زملائهم في الأندية والمنتخبات!
              </p>
            </div>

            {/* QR Code and Join Banner */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 bg-[#F7F4EC] border-3 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-3xl p-6 md:p-8 max-w-2xl w-full">
              <div className="p-3 bg-white border-2 border-[#2C2A29] rounded-2xl shadow-[3px_3px_0px_#2C2A29]">
                <QRCodeSVG value={joinUrl} size={150} />
              </div>
              <div className="text-right space-y-2">
                <span className="text-xs font-black text-[#5C4033] block">امسح الكود أو ادخل عبر الرابط:</span>
                <span className="font-mono text-xs bg-[#E5E0D5] px-3 py-1.5 rounded-lg border border-[#2C2A29] block select-all">
                  {joinUrl}
                </span>
                <div className="pt-2">
                  <span className="text-xs font-black text-[#8A9A5B] block">رمز الغرفة:</span>
                  <span className="font-mono text-3xl font-black tracking-widest text-[#2C2A29]">
                    {roomCode}
                  </span>
                </div>
              </div>
            </div>

            {/* Connected Contestants Grid */}
            <div className="w-full space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm font-black text-[#5C4033]">
                <Users size={18} />
                <span>المتسابقون المتصلون ({contestants.length}):</span>
              </div>

              {contestants.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-3">
                  {contestants.map((c) => (
                    <div
                      key={c.playerId}
                      className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] px-4 py-2.5 rounded-2xl flex items-center gap-2.5"
                    >
                      {c.teamLogo && <img src={c.teamLogo} alt="" className="w-6 h-6 object-contain" />}
                      <span className="font-black text-sm text-[#2C2A29]">{c.playerName}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-bold text-[#5C4033]">بانتظار انضمام المتسابقين بالجوال...</p>
              )}
            </div>

            {/* Host Start Button */}
            <button
              onClick={handleStartGame}
              disabled={contestants.length === 0}
              className="bg-[#8A9A5B] hover:bg-[#78884E] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-lg py-4 px-12 rounded-2xl border-3 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer flex items-center gap-3"
            >
              <Play size={22} />
              <span>بدء سباق السلسلة</span>
            </button>
          </div>
        )}

        {/* =======================================================
            STATE 2: RACE ACTIVE (CENTER CONFRONTATION & LIVE TRACK)
            ======================================================= */}
        {phase === 'RACE_ACTIVE' && currentChallenge && (
          <div className="flex-1 flex flex-col justify-between w-full space-y-6 animate-fade-in my-auto">
            {/* Center Confrontation Banner (Start -> Target) */}
            <div className="bg-[#F7F4EC] border-3 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-3xl p-6 md:p-8 flex items-center justify-between gap-4 text-center">
              {/* Start Player */}
              <div className="flex-1 flex flex-col items-center space-y-2">
                <span className="text-xs font-black bg-[#8A9A5B] text-white px-3 py-1 rounded-full border border-[#2C2A29]">
                  نقطة البداية 🏁
                </span>
                <div className="w-20 h-20 md:w-28 md:h-28 bg-[#E5E0D5] border-3 border-[#2C2A29] rounded-2xl overflow-hidden shadow-[3px_3px_0px_#2C2A29] flex items-center justify-center">
                  {currentChallenge.startPlayer.photoUrl ? (
                    <img src={currentChallenge.startPlayer.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={36} className="text-[#5C4033]" />
                  )}
                </div>
                <h3 className="text-xl md:text-2xl font-black text-[#2C2A29]">
                  {currentChallenge.startPlayer.name}
                </h3>
                <span className="text-xs font-bold text-[#5C4033]">
                  {currentChallenge.startPlayer.nationality} • {currentChallenge.startPlayer.currentClub || currentChallenge.startPlayer.clubs[0]}
                </span>
              </div>

              {/* Glowing Arrow & Mystery Hops */}
              <div className="flex flex-col items-center space-y-2 px-4 shrink-0">
                <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] px-3 py-1 rounded-xl text-xs font-black text-[#5C4033]">
                  أقصر طريق: {currentChallenge.minHops} خطوات
                </div>
                <div className="text-2xl md:text-4xl font-black text-[#C68B59] animate-pulse">
                  ──────────▶
                </div>
                <span className="text-[11px] font-bold text-[#5C4033]">
                  ابحث عن الزملاء المشتركين!
                </span>
              </div>

              {/* Target Player */}
              <div className="flex-1 flex flex-col items-center space-y-2">
                <span className="text-xs font-black bg-[#C68B59] text-white px-3 py-1 rounded-full border border-[#2C2A29]">
                  الهدف النهائي 🎯
                </span>
                <div className="w-20 h-20 md:w-28 md:h-28 bg-[#E5E0D5] border-3 border-[#2C2A29] rounded-2xl overflow-hidden shadow-[3px_3px_0px_#2C2A29] flex items-center justify-center">
                  {currentChallenge.targetPlayer.photoUrl ? (
                    <img src={currentChallenge.targetPlayer.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Trophy size={36} className="text-[#C68B59]" />
                  )}
                </div>
                <h3 className="text-xl md:text-2xl font-black text-[#2C2A29]">
                  {currentChallenge.targetPlayer.name}
                </h3>
                <span className="text-xs font-bold text-[#5C4033]">
                  {currentChallenge.targetPlayer.nationality} • {currentChallenge.targetPlayer.currentClub || currentChallenge.targetPlayer.clubs[0]}
                </span>
              </div>
            </div>

            {/* Live Progress Race Track (مضمار السباق الحي - Privacy Guard) */}
            <div className="bg-[#F7F4EC] border-3 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-[#2C2A29] pb-3">
                <h4 className="text-lg font-black text-[#2C2A29] flex items-center gap-2">
                  <Zap size={20} className="text-[#C68B59]" />
                  <span>مضمار السباق الحي (موقع كل متسابق):</span>
                </h4>
                <span className="text-xs font-bold text-[#5C4033]">
                  * أسماء الزملاء سرية لمنع الغش حتى إتمام السلسلة!
                </span>
              </div>

              <div className="space-y-4">
                {contestants.map((c) => {
                  const stepNumber = c.currentStepCount;
                  const maxDisplaySteps = 5;

                  return (
                    <div
                      key={c.playerId}
                      className="bg-white border-2 border-[#2C2A29] rounded-2xl p-3 flex items-center justify-between gap-4 shadow-sm"
                    >
                      {/* Contestant Profile */}
                      <div className="flex items-center gap-3 w-48 shrink-0">
                        {c.teamLogo && <img src={c.teamLogo} alt="" className="w-8 h-8 object-contain shrink-0" />}
                        <div>
                          <span className="text-sm font-black text-[#2C2A29] block leading-tight">
                            {c.playerName}
                          </span>
                          <span className="text-[11px] font-bold text-[#5C4033]">
                            {stepNumber === 0 ? 'عند البداية' : `قطع ${stepNumber} خطوات`}
                          </span>
                        </div>
                      </div>

                      {/* Horizontal Step Progression Line */}
                      <div className="flex-1 flex items-center gap-2 relative">
                        {[0, 1, 2, 3, 4, 5].map((stepIdx) => {
                          const isReached = stepNumber >= stepIdx;
                          const isCurrent = stepNumber === stepIdx;

                          return (
                            <div key={stepIdx} className="flex-1 flex items-center">
                              <div
                                className={`w-8 h-8 rounded-xl border-2 border-[#2C2A29] flex items-center justify-center font-mono font-black text-xs transition-all ${
                                  isCurrent
                                    ? 'bg-[#C68B59] text-white scale-110 shadow-[2px_2px_0px_#2C2A29]'
                                    : isReached
                                    ? 'bg-[#8A9A5B] text-white'
                                    : 'bg-[#E5E0D5] text-[#5C4033]'
                                }`}
                              >
                                {stepIdx === 0 ? '🏁' : stepIdx}
                              </div>
                              {stepIdx < 5 && (
                                <div
                                  className={`flex-1 h-2 mx-1 rounded-full border border-[#2C2A29] ${
                                    stepNumber > stepIdx ? 'bg-[#8A9A5B]' : 'bg-[#E5E0D5]'
                                  }`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            STATE 3: ROUND PODIUM & DRAMATIC CHAIN REVEAL
            ======================================================= */}
        {phase === 'ROUND_PODIUM' && winningReveal && (
          <div className="flex-1 flex flex-col items-center justify-center w-full space-y-6 animate-fade-in text-center my-auto">
            {/* Winner Celebration Banner */}
            <div className="bg-[#8A9A5B] text-white border-3 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-3xl p-6 md:p-8 max-w-2xl w-full space-y-2">
              <span className="text-xs font-black uppercase tracking-wider bg-[#2C2A29] text-white px-3 py-1 rounded-full inline-block">
                {round >= TOTAL_ROUNDS ? 'بطل المباراة النهائي 🏆' : `بطل الجولة ${round} 🥇`}
              </span>
              <div className="flex items-center justify-center gap-3">
                {winningReveal.winnerTeamLogo && (
                  <img src={winningReveal.winnerTeamLogo} alt="" className="w-10 h-10 object-contain" />
                )}
                <h2 className="text-3xl md:text-5xl font-black">
                  {winningReveal.winnerName}
                </h2>
              </div>
              <p className="text-base font-bold opacity-95 pt-1">
                وصل إلى لاعب الهدف في <span className="underline font-black">{winningReveal.stepsCount} خطوات فقط</span> (+{winningReveal.totalPoints} نقطة)!
              </p>
            </div>

            {/* Card-by-Card Reveal of the Full Winning Chain */}
            {winningReveal.chainSteps.length > 0 && (
              <div className="w-full bg-[#F7F4EC] border-3 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-3xl p-6 space-y-3">
                <h4 className="text-base font-black text-[#5C4033]">
                  السلسلة الفائزة المكتشفة:
                </h4>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="bg-[#8A9A5B] text-white px-4 py-2 rounded-xl border-2 border-[#2C2A29] font-black text-sm shadow-sm">
                    {winningReveal.startPlayer.name}
                  </span>
                  {winningReveal.chainSteps.map((step, sIdx) => (
                    <React.Fragment key={sIdx}>
                      <span className="text-xs font-black text-[#2C2A29] bg-[#E5E0D5] border-2 border-[#2C2A29] px-3 py-1 rounded-lg">
                        ──({step.connectingEntity})──▶
                      </span>
                      <span className="bg-white text-[#2C2A29] px-4 py-2 rounded-xl border-2 border-[#2C2A29] font-black text-sm shadow-sm">
                        {step.toPlayer.name}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Next Round / Final Podium Controls */}
            <div className="flex items-center justify-center gap-4 pt-2">
              {round < TOTAL_ROUNDS ? (
                <button
                  onClick={handleNextRound}
                  className="bg-[#C68B59] hover:bg-[#B57A48] text-white border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none py-3.5 px-8 rounded-2xl font-black text-base flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Play size={20} />
                  <span>الانتقال للجولة {round + 1} من {TOTAL_ROUNDS}</span>
                </button>
              ) : (
                <button
                  onClick={() => setPhase('MATCH_OVER')}
                  className="bg-[#8A9A5B] hover:bg-[#78884E] text-white border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] py-3.5 px-8 rounded-2xl font-black text-base flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Trophy size={20} />
                  <span>عرض التتويج النهائي</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* =======================================================
            STATE 4: MATCH OVER (FINAL LEADERBOARD)
            ======================================================= */}
        {phase === 'MATCH_OVER' && (
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl space-y-6 animate-fade-in text-center my-auto">
            <div className="space-y-2">
              <span className="text-4xl">👑</span>
              <h2 className="text-4xl md:text-5xl font-black text-[#2C2A29]">
                اختتام منافسة سِكّة اللاعبين!
              </h2>
              <p className="text-sm font-bold text-[#5C4033]">
                جدول الترتيب النهائي عبر الجولات الخمس:
              </p>
            </div>

            {/* Final Leaderboard Cards */}
            <div className="w-full space-y-3">
              {Object.entries(leaderboard)
                .sort((a, b) => b[1].score - a[1].score)
                .map(([pId, data], idx) => (
                  <div
                    key={pId}
                    className={`border-3 border-[#2C2A29] rounded-2xl p-4 flex items-center justify-between shadow-[4px_4px_0px_#2C2A29] ${
                      idx === 0 ? 'bg-[#8A9A5B] text-white' : 'bg-[#F7F4EC] text-[#2C2A29]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-black text-xl w-8">#{idx + 1}</span>
                      {data.teamLogo && <img src={data.teamLogo} alt="" className="w-8 h-8 object-contain" />}
                      <span className="font-black text-lg">{data.name}</span>
                    </div>

                    <div className="flex items-center gap-4 text-sm font-bold">
                      <span>فاز بـ {data.wins} جولات</span>
                      <span className="font-mono text-xl font-black bg-black/10 px-3 py-1 rounded-xl">
                        {data.score} نقطة
                      </span>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex items-center gap-4 pt-4">
              <button
                onClick={handleResetLobby}
                className="bg-[#C68B59] text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] py-3 px-6 rounded-xl font-black text-sm flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw size={16} />
                <span>إعادة اللعب من البداية</span>
              </button>
              <button
                onClick={() => navigate('/')}
                className="bg-[#F7F4EC] text-[#2C2A29] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] py-3 px-6 rounded-xl font-black text-sm cursor-pointer"
              >
                العودة للرئيسية
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
