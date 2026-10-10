import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Users, Timer, Trophy, ShieldAlert, Sparkles, AlertTriangle, ArrowRight, Play } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ConspiracyTopBar } from './components/ConspiracyTopBar';
import { CONSPIRACY_EVENTS_BANK } from './data/conspiracyEventsBank';
import {
  ConspiracyPhase,
  EventPair,
  PlayerTheory,
  ConspiracyEvaluation,
  ConspiracyScore,
  ConspiracyPlayer
} from './types';

export const ConspiracyTVView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // State Management
  const [phase, setPhase] = useState<ConspiracyPhase>('LOBBY');
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [players, setPlayers] = useState<ConspiracyPlayer[]>([]);
  const [currentEventPair, setCurrentEventPair] = useState<EventPair>(CONSPIRACY_EVENTS_BANK[0]);
  const [playerTheories, setPlayerTheories] = useState<PlayerTheory[]>([]);
  const [evaluation, setEvaluation] = useState<ConspiracyEvaluation | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  
  // Timers & Countdown
  const [countdown, setCountdown] = useState<number>(0);
  const [lobbyStartCountdown, setLobbyStartCountdown] = useState<number | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Realtime Channel Ref Singleton
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Pick random event pair for a round
  const selectRandomEventPair = (roundNum: number) => {
    const idx = (roundNum - 1 + Math.floor(Math.random() * (CONSPIRACY_EVENTS_BANK.length - 3))) % CONSPIRACY_EVENTS_BANK.length;
    return CONSPIRACY_EVENTS_BANK[idx];
  };

  // Broadcast state helper
  const broadcastState = (channel: RealtimeChannel, newPhase: ConspiracyPhase, eventPair?: EventPair) => {
    channel.send({
      type: 'broadcast',
      event: 'CONSPIRACY_STATE_SYNC',
      payload: {
        phase: newPhase,
        eventPair: eventPair || currentEventPair,
        currentRound
      }
    });
  };

  // 1. Setup Supabase Realtime Channel
  useEffect(() => {
    const normalizedCode = roomCode.trim().toUpperCase();
    if (!normalizedCode) return;

    const channel = supabase.channel(`conspiracy:${normalizedCode}`, {
      config: { broadcast: { self: true }, presence: { key: 'tv_screen' } }
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activePlayers: ConspiracyPlayer[] = [];
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          presences.forEach((p) => {
            if (p.playerId && p.playerName) {
              activePlayers.push({
                id: p.playerId,
                name: p.playerName,
                isReady: !!p.isReady
              });
            }
          });
        });

        // Deduplicate players by ID
        const uniqueMap = new Map<string, ConspiracyPlayer>();
        activePlayers.forEach((p) => uniqueMap.set(p.id, p));
        setPlayers(Array.from(uniqueMap.values()));
      })
      .on('broadcast', { event: 'SUBMIT_THEORY' }, ({ payload }) => {
        const { playerId, playerName, theoryText } = payload;
        setPlayerTheories((prev) => {
          const filtered = prev.filter((t) => t.playerId !== playerId);
          return [...filtered, { playerId, playerName, theoryText, submittedAt: Date.now() }];
        });
      })
      .on('broadcast', { event: 'PLAYER_READY_TOGGLE' }, ({ payload }) => {
        const { playerId, isReady } = payload;
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, isReady } : p))
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode]);

  // 2. Lobby Auto-Start Countdown when >= 2 ready players
  const readyCount = useMemo(() => players.filter((p) => p.isReady).length, [players]);

  useEffect(() => {
    if (phase !== 'LOBBY') {
      setLobbyStartCountdown(null);
      return;
    }

    if (players.length >= 2 && readyCount >= 2) {
      if (lobbyStartCountdown === null) {
        setLobbyStartCountdown(3);
      }
    } else {
      setLobbyStartCountdown(null);
    }
  }, [players.length, readyCount, phase, lobbyStartCountdown]);

  useEffect(() => {
    if (phase !== 'LOBBY' || lobbyStartCountdown === null) return;

    if (lobbyStartCountdown <= 0) {
      startMatch();
      return;
    }

    const timer = setTimeout(() => {
      setLobbyStartCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [lobbyStartCountdown, phase]);

  // Start Match Handler
  const startMatch = () => {
    const selected = selectRandomEventPair(1);
    setCurrentEventPair(selected);
    setCurrentRound(1);
    setPhase('EVENTS_REVEAL');
    setCountdown(15);

    if (channelRef.current) {
      broadcastState(channelRef.current, 'EVENTS_REVEAL', selected);
    }
  };

  // Phase Timers Logic
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  // Timer completion side-effects
  useEffect(() => {
    if (countdown > 0) return;

    if (phase === 'EVENTS_REVEAL') {
      setPhase('THEORY_INPUT');
      setCountdown(60);
      if (channelRef.current) {
        broadcastState(channelRef.current, 'THEORY_INPUT');
      }
    } else if (phase === 'THEORY_INPUT') {
      // Auto-evaluate when time expires
      triggerAiEvaluation();
    }
  }, [countdown, phase]);

  // Check if all players submitted during THEORY_INPUT
  useEffect(() => {
    if (phase !== 'THEORY_INPUT') return;
    if (players.length > 0 && playerTheories.length >= players.length) {
      triggerAiEvaluation();
    }
  }, [playerTheories.length, players.length, phase]);

  // AI Judge Evaluation Handler
  const triggerAiEvaluation = async () => {
    if (isEvaluating) return;
    setIsEvaluating(true);
    setPhase('DOSSIERS_SHOWCASE');

    if (channelRef.current) {
      broadcastState(channelRef.current, 'DOSSIERS_SHOWCASE');
    }

    try {
      const { data, error } = await supabase.functions.invoke('conspiracy-judge', {
        body: {
          eventPair: currentEventPair,
          theories: playerTheories
        }
      });

      if (error) throw error;

      const evalData: ConspiracyEvaluation = data;
      setEvaluation(evalData);

      // Award +10 pt to winner
      if (evalData?.winnerPlayerId) {
        setScores((prev) => ({
          ...prev,
          [evalData.winnerPlayerId]: (prev[evalData.winnerPlayerId] || 0) + 10
        }));
      }

      setPhase('VERDICT_REVEAL');
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'CONSPIRACY_EVALUATION_READY',
          payload: evalData
        });
        broadcastState(channelRef.current, 'VERDICT_REVEAL');
      }
    } catch (err) {
      console.error('[AI Evaluation Failed]:', err);
      // Fallback evaluation if Edge Function fails
      const fallbackWinner = playerTheories[0] || { playerId: players[0]?.id || 'p1', playerName: players[0]?.name || 'لاعب 1' };
      const fallbackEval: ConspiracyEvaluation = {
        winnerPlayerId: fallbackWinner.playerId,
        winnerName: fallbackWinner.playerName,
        classifiedTitle: 'عملية الربط الكوني المشبوهة',
        verdictCommentary: 'تحليل دقيق ومباغت كشف أسرار خيوط المؤامرة بين الحدثين!',
        theoriesAudit: playerTheories.map((t, i) => ({
          playerId: t.playerId,
          dangerLevel: 65 + i * 5,
          codeName: `العميل #${i + 1}`,
          quickRoast: 'نظرية مثيرة للشبهات!'
        }))
      };

      setEvaluation(fallbackEval);
      setScores((prev) => ({
        ...prev,
        [fallbackWinner.playerId]: (prev[fallbackWinner.playerId] || 0) + 10
      }));
      setPhase('VERDICT_REVEAL');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Move to next round or podium
  const handleNextRound = () => {
    if (currentRound >= 3) {
      setPhase('PODIUM');
      if (channelRef.current) {
        broadcastState(channelRef.current, 'PODIUM');
      }
    } else {
      const nextR = currentRound + 1;
      const nextEvent = selectRandomEventPair(nextR);
      setCurrentRound(nextR);
      setCurrentEventPair(nextEvent);
      setPlayerTheories([]);
      setEvaluation(null);
      setPhase('EVENTS_REVEAL');
      setCountdown(15);
      if (channelRef.current) {
        broadcastState(channelRef.current, 'EVENTS_REVEAL', nextEvent);
      }
    }
  };

  // Host Kick Player
  const handleKickPlayer = (playerId: string) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'KICK_PLAYER',
        payload: { playerId }
      });
    }
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
  };

  // Terminate Session (Host closes room)
  const handleTerminateSession = () => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'GAME_TERMINATED',
        payload: {}
      });
    }
    navigate('/');
  };

  // Sorted leaderboard
  const sortedScores = useMemo(() => {
    return players
      .map((p) => ({
        id: p.id,
        name: p.name,
        score: scores[p.id] || 0
      }))
      .sort((a, b) => b.score - a.score);
  }, [players, scores]);

  const joinUrl = `${window.location.origin}/join/${roomCode}`;

  return (
    <div className="w-full min-h-screen bg-[#E5E0D5] text-[#2C2A29] flex flex-col font-sans relative overflow-hidden select-none"
         style={{ backgroundImage: 'radial-gradient(rgba(44, 42, 41, 0.04) 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
      
      {/* Top Bar Header */}
      <ConspiracyTopBar
        roomCode={roomCode}
        phase={phase}
        currentRound={currentRound}
        maxRounds={3}
        onTerminateSession={handleTerminateSession}
        onReturnToLobby={() => {
          setPhase('LOBBY');
          if (channelRef.current) broadcastState(channelRef.current, 'LOBBY');
        }}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-6xl mx-auto w-full">
        
        {/* PHASE 1: LOBBY */}
        {phase === 'LOBBY' && (
          <div className="w-full flex flex-col items-center gap-8">
            <div className="text-center space-y-2">
              <h1 className="text-4xl md:text-5xl font-black text-[#2C2A29]">صانع المؤامرة</h1>
              <p className="text-base text-[#2C2A29]/70 font-semibold max-w-xl">
                اربط بين الحدثين العشوائيين بنظرية مؤامرة مجنونة.. وكبير المحققين يعتمد النظريات ويجلد الفاشلين!
              </p>
            </div>

            {/* QR Code & How To Play Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
              {/* QR Code Card */}
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 flex flex-col items-center justify-center gap-4 text-center">
                <div className="bg-white p-3 rounded-xl border-2 border-[#2C2A29] shadow-inner">
                  <QRCodeSVG value={joinUrl} size={140} />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#2C2A29]/60">امسح الكود للجوال</div>
                  <div className="font-mono font-black text-2xl tracking-widest text-[#2C2A29]">{roomCode}</div>
                </div>
              </div>

              {/* How to Play Card */}
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 flex flex-col justify-between text-right">
                <div>
                  <h3 className="font-black text-lg text-[#2C2A29] border-b-2 border-[#2C2A29] pb-2 mb-3">
                    طريقة لعب صانع المؤامرة
                  </h3>
                  <ul className="space-y-2 text-sm font-bold text-[#2C2A29]/80 leading-relaxed">
                    <li>• يظهر في الشاشة حدثين مالهم دخل ببعض (مثل الفول والمريخ).</li>
                    <li>• معك 60 ثانية لتأليف خيوط مؤامرة سرية ترتبط بينهم.</li>
                    <li>• الـ AI يقيّم خطورة ملفك السري ويتوّج المؤامرة المعتمدة بـ (+10 pt).</li>
                  </ul>
                </div>
                
                {/* Auto Countdown or Ready Status */}
                <div className="mt-4 pt-3 border-t-2 border-[#2C2A29]/10 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2C2A29]/70">
                    اللاعبون الجاهزون: {readyCount} / {players.length}
                  </span>
                  {lobbyStartCountdown !== null ? (
                    <span className="bg-[#C68B59] text-white px-3 py-1 rounded-xl text-xs font-black animate-pulse">
                      ينطلق التحدي خلال {lobbyStartCountdown}s
                    </span>
                  ) : (
                    <span className="text-xs font-extrabold text-[#8A9A5B]">
                      (يتطلب لاعبين جاهزين على الأقل)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Players Grid */}
            <div className="w-full max-w-4xl space-y-3">
              <div className="flex items-center justify-between px-2">
                <span className="font-black text-lg text-[#2C2A29]">غرفة الاستخبارات ({players.length})</span>
                {players.length >= 2 && (
                  <button
                    onClick={startMatch}
                    className="flex items-center gap-2 bg-[#8A9A5B] hover:bg-[#78874e] text-white px-5 py-2 rounded-xl font-black text-sm border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>ابدأ اللعبة فوراً</span>
                  </button>
                )}
              </div>

              {players.length === 0 ? (
                <div className="bg-[#F7F4EC] border-2 border-dashed border-[#2C2A29]/40 rounded-2xl p-8 text-center text-[#2C2A29]/50 font-bold">
                  في انتظار انضمام العملاء والجواسيس...
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl p-3 flex items-center justify-between relative group"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className={`w-3 h-3 rounded-full border border-[#2C2A29] ${player.isReady ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'}`} />
                        <span className="font-extrabold text-sm text-[#2C2A29] truncate">{player.name}</span>
                      </div>
                      <button
                        onClick={() => handleKickPlayer(player.id)}
                        className="opacity-0 group-hover:opacity-100 text-[#C68B59] hover:bg-[#C68B59]/10 p-1 rounded font-bold text-xs transition-opacity"
                        title="طرد اللاعب"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PHASE 2: EVENTS REVEAL */}
        {phase === 'EVENTS_REVEAL' && (
          <div className="w-full max-w-4xl flex flex-col items-center gap-8 text-center">
            <div className="space-y-1">
              <span className="bg-[#C68B59] text-white px-4 py-1 rounded-xl text-xs font-black tracking-wider border border-[#2C2A29]">
                كشف الملفات الغامضة
              </span>
              <h2 className="text-3xl font-black text-[#2C2A29]">الحدثين العشوائيين لهذا اليوم</h2>
            </div>

            {/* Event Cards Pair */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full relative">
              {/* Event A Card */}
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-2xl p-6 flex flex-col items-center justify-center gap-4 min-h-[200px]">
                <span className="bg-[#8A9A5B] text-white text-xs font-black px-3 py-1 rounded-lg border border-[#2C2A29]">
                  الحدث الأول (A)
                </span>
                <p className="font-black text-xl text-[#2C2A29] leading-relaxed">
                  "{currentEventPair.eventA}"
                </p>
              </div>

              {/* Central Stamped Connector */}
              <div className="md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-10 my-2 md:my-0">
                <div className="bg-[#C68B59] text-white font-black text-xs px-4 py-2 rounded-xl border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] uppercase tracking-wider rotate-[-3deg]">
                  [الرابط المشبوه]
                </div>
              </div>

              {/* Event B Card */}
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-2xl p-6 flex flex-col items-center justify-center gap-4 min-h-[200px]">
                <span className="bg-[#8A9A5B] text-white text-xs font-black px-3 py-1 rounded-lg border border-[#2C2A29]">
                  الحدث الثاني (B)
                </span>
                <p className="font-black text-xl text-[#2C2A29] leading-relaxed">
                  "{currentEventPair.eventB}"
                </p>
              </div>
            </div>

            {/* Timer Bar */}
            <div className="w-full max-w-md bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4 flex items-center justify-between">
              <span className="font-bold text-sm text-[#2C2A29]">يبدأ كتابة التقرير خلال:</span>
              <span className="font-mono font-black text-2xl text-[#C68B59]">{countdown}s</span>
            </div>
          </div>
        )}

        {/* PHASE 3: THEORY INPUT */}
        {phase === 'THEORY_INPUT' && (
          <div className="w-full max-w-4xl flex flex-col items-center gap-8 text-center">
            {/* Header with Circular Timer */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-full bg-[#F7F4EC] border-4 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] flex items-center justify-center">
                <span className="font-mono font-black text-3xl text-[#C68B59]">{countdown}</span>
              </div>
              <h2 className="text-2xl font-black text-[#2C2A29]">أكتب خيوط المؤامرة عبر جوالك!</h2>
              <p className="text-xs font-bold text-[#2C2A29]/70">
                ربط الحدثين: "{currentEventPair.eventA.substring(0, 25)}..." + "{currentEventPair.eventB.substring(0, 25)}..."
              </p>
            </div>

            {/* Submission Live Tracker */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-2xl p-6 w-full max-w-2xl">
              <div className="flex items-center justify-between border-b-2 border-[#2C2A29] pb-3 mb-4">
                <span className="font-black text-base text-[#2C2A29]">الملفات المسرّبة المستلمة</span>
                <span className="font-mono font-black text-lg bg-[#8A9A5B] text-white px-3 py-0.5 rounded-lg border border-[#2C2A29]">
                  {playerTheories.length} / {players.length}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {players.map((p) => {
                  const hasSubmitted = playerTheories.some((t) => t.playerId === p.id);
                  return (
                    <div
                      key={p.id}
                      className={`border-2 border-[#2C2A29] rounded-xl p-3 text-right font-extrabold text-sm flex items-center justify-between ${
                        hasSubmitted ? 'bg-[#8A9A5B]/20 text-[#8A9A5B]' : 'bg-[#E5E0D5]/50 text-[#2C2A29]/50'
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-xs font-black">{hasSubmitted ? '✓ تم' : '...'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PHASE 4: DOSSIERS SHOWCASE (Evaluating) */}
        {phase === 'DOSSIERS_SHOWCASE' && (
          <div className="w-full max-w-3xl flex flex-col items-center gap-6 text-center">
            <div className="bg-[#C68B59] text-white px-5 py-2 rounded-2xl font-black text-sm border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] animate-pulse">
              كبير المحققين يفحص الملفات السرية الآن...
            </div>
            
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-2xl p-8 w-full flex flex-col items-center justify-center gap-4 min-h-[240px]">
              <div className="font-mono font-black text-[#2C2A29]/40 text-xs tracking-widest">[CONFIDENTIAL-DOSSIERS-AUDIT]</div>
              <h3 className="text-2xl font-black text-[#2C2A29]">جاري التدقيق في خوارزمية الربط الاستخباراتي</h3>
              <p className="text-sm font-bold text-[#2C2A29]/70">
                يتم قياس خطورة النظريات وترشيح "المؤامرة المعتمدة" للجولة...
              </p>
            </div>
          </div>
        )}

        {/* PHASE 5: VERDICT REVEAL */}
        {phase === 'VERDICT_REVEAL' && evaluation && (
          <div className="w-full max-w-5xl flex flex-col items-center gap-6">
            
            {/* Top Winner Card */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[8px_8px_0px_#2C2A29] rounded-2xl p-6 w-full text-right relative overflow-hidden">
              
              {/* Winner Stamp */}
              <div className="absolute top-4 left-4 bg-[#8A9A5B] text-white px-4 py-1.5 rounded-xl font-black text-sm border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rotate-[-2deg]">
                [المؤامرة المعتمدة رسمياً (+10 pt)]
              </div>

              <div className="space-y-3 pr-2">
                <div className="flex items-center gap-2">
                  <span className="bg-[#C68B59] text-white text-xs font-black px-2.5 py-0.5 rounded-md border border-[#2C2A29]">
                    الفائز بالجولة
                  </span>
                  <span className="font-black text-xl text-[#2C2A29]">{evaluation.winnerName}</span>
                </div>

                <h2 className="text-2xl font-black text-[#8A9A5B] border-b-2 border-[#2C2A29]/10 pb-2">
                  "{evaluation.classifiedTitle}"
                </h2>

                <p className="font-extrabold text-base text-[#2C2A29] leading-relaxed bg-[#E5E0D5]/60 p-4 rounded-xl border border-[#2C2A29]/30">
                  {evaluation.verdictCommentary}
                </p>
              </div>
            </div>

            {/* Audit List of All Player Theories */}
            <div className="w-full space-y-3">
              <h3 className="font-black text-lg text-[#2C2A29] text-right">سجل تدقيق ملفات العملاء:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {evaluation.theoriesAudit.map((audit) => {
                  const theoryObj = playerTheories.find((t) => t.playerId === audit.playerId);
                  return (
                    <div
                      key={audit.playerId}
                      className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-xl p-4 flex flex-col justify-between gap-3 text-right"
                    >
                      <div className="flex items-center justify-between border-b border-[#2C2A29]/20 pb-2">
                        <span className="font-black text-sm text-[#2C2A29]">{audit.codeName}</span>
                        <span className="bg-[#C68B59]/20 text-[#C68B59] font-mono font-black text-xs px-2.5 py-0.5 rounded-md border border-[#C68B59]/40">
                          مستوى الخطر: {audit.dangerLevel}%
                        </span>
                      </div>

                      <p className="text-sm font-bold text-[#2C2A29]/90 italic">
                        "{theoryObj?.theoryText || 'ملف سري مسرّب'}"
                      </p>

                      <div className="bg-[#E5E0D5] p-2.5 rounded-lg border border-[#2C2A29]/20 text-xs font-bold text-[#2C2A29]/80">
                        <span className="font-black text-[#8A9A5B]">تقييم المحقق: </span>
                        {audit.quickRoast}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Controls to Next Round */}
            <button
              onClick={handleNextRound}
              className="mt-4 flex items-center gap-2 bg-[#8A9A5B] hover:bg-[#78874e] text-white px-8 py-3 rounded-2xl font-black text-base border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] transition-transform active:translate-x-[1px] active:translate-y-[1px]"
            >
              <span>{currentRound >= 3 ? 'الانتقال إلى منصة التتويج' : `الانتقال للجولة ${currentRound + 1}`}</span>
              <ArrowRight className="w-5 h-5 rotate-180" />
            </button>
          </div>
        )}

        {/* PHASE 6: PODIUM */}
        {phase === 'PODIUM' && (
          <div className="w-full max-w-3xl flex flex-col items-center gap-8 text-center">
            <div className="space-y-2">
              <div className="bg-[#8A9A5B] text-white px-4 py-1 rounded-xl text-xs font-black inline-block border border-[#2C2A29]">
                الترتيب النهائي
              </div>
              <h1 className="text-4xl font-black text-[#2C2A29]">بطل صانع المؤامرة</h1>
            </div>

            {/* Leaderboard Grid */}
            <div className="w-full space-y-3">
              {sortedScores.map((item, index) => (
                <div
                  key={item.id}
                  className={`bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4 flex items-center justify-between ${
                    index === 0 ? 'bg-[#8A9A5B]/15 border-2 border-[#8A9A5B]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-xl w-8 h-8 rounded-xl bg-[#E5E0D5] border border-[#2C2A29] flex items-center justify-center">
                      #{index + 1}
                    </span>
                    <span className="font-black text-lg text-[#2C2A29]">{item.name}</span>
                  </div>
                  <span className="font-mono font-black text-xl bg-[#C68B59] text-white px-4 py-1 rounded-xl border border-[#2C2A29]">
                    {item.score} pt
                  </span>
                </div>
              ))}
            </div>

            {/* Return / Restart */}
            <button
              onClick={() => {
                setScores({});
                setPhase('LOBBY');
                if (channelRef.current) broadcastState(channelRef.current, 'LOBBY');
              }}
              className="bg-[#C68B59] hover:bg-[#b57a48] text-white px-8 py-3 rounded-2xl font-black text-base border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] transition-transform active:translate-x-[1px] active:translate-y-[1px]"
            >
              لعب مباراة جديدة
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
