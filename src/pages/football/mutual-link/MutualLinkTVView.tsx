import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Play, Users, Trophy, Sparkles, RotateCcw, X, Link as LinkIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { MutualLinkTopBar } from './components/MutualLinkTopBar';
import {
  MutualLinkPhase,
  MutualLinkPlayer,
  MutualLinkEventPayload,
} from './types';
import {
  MutualLinkChallenge,
  generateMutualLinkChallenges,
} from '../../../utils/mutualLinkEngine';
import { normalizeArabicFootball } from '../../../utils/footballSearch';
import { sound } from '../../../lib/audio';

export const MutualLinkTVView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // Core Game State
  const [phase, setPhase] = useState<MutualLinkPhase>('LOBBY');
  const [round, setRound] = useState<number>(1);
  const maxRounds = 5;
  const [challenges, setChallenges] = useState<MutualLinkChallenge[]>([]);
  const [currentChallenge, setCurrentChallenge] = useState<MutualLinkChallenge | null>(null);

  const [players, setPlayers] = useState<MutualLinkPlayer[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({}); // playerId -> points

  // Winner of current round
  const [roundWinner, setRoundWinner] = useState<{
    id: string;
    name: string;
    guessText: string;
  } | null>(null);
  const [isTimeout, setIsTimeout] = useState<boolean>(false);

  // 20-Second round timer
  const ROUND_DURATION_MS = 20000;
  const [timeLeftSec, setTimeLeftSec] = useState<number>(20);
  const [progressPercent, setProgressPercent] = useState<number>(100);

  // Auto-advance countdown after reveal
  const [advanceCountdown, setAdvanceCountdown] = useState<number | null>(null);

  // References for live timer & state
  const phaseRef = useRef<MutualLinkPhase>(phase);
  const roundRef = useRef<number>(round);
  const challengesRef = useRef<MutualLinkChallenge[]>([]);
  const currentChallengeRef = useRef<MutualLinkChallenge | null>(null);
  const playersRef = useRef<MutualLinkPlayer[]>(players);
  const scoresRef = useRef<Record<string, number>>(scores);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { challengesRef.current = challenges; }, [challenges]);
  useEffect(() => { currentChallengeRef.current = currentChallenge; }, [currentChallenge]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { scoresRef.current = scores; }, [scores]);

  // Broadcast to all connected clients
  const broadcastEvent = useCallback((payload: MutualLinkEventPayload) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'mutual_link_event',
      payload,
    });
  }, []);

  // Terminate Room entirely
  const handleTerminateRoom = useCallback(() => {
    sound.playClick();
    broadcastEvent({ action: 'ROOM_TERMINATED' });
    sessionStorage.removeItem('mutual_player_id');
    sessionStorage.removeItem('mutual_room');
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    navigate('/');
  }, [broadcastEvent, navigate]);

  // Start match from Lobby
  const handleStartGame = useCallback(() => {
    sound.playWhistle();
    const generated = generateMutualLinkChallenges(maxRounds);
    setChallenges(generated);
    setCurrentChallenge(generated[0]);
    setRound(1);
    setPhase('GAMEPLAY');
    setRoundWinner(null);
    setIsTimeout(false);
    setTimeLeftSec(20);
    setProgressPercent(100);

    // Reset scores for fresh game
    const resetScores: Record<string, number> = {};
    playersRef.current.forEach(p => { resetScores[p.id] = 0; });
    setScores(resetScores);

    broadcastEvent({
      action: 'GAME_START',
      phase: 'GAMEPLAY',
      round: 1,
      maxRounds,
      challenge: generated[0],
      scores: resetScores,
    });
  }, [broadcastEvent, maxRounds]);

  // Advance to Next Round or Final Podium
  const handleNextRound = useCallback(() => {
    sound.playClick();
    if (roundRef.current >= maxRounds) {
      setPhase('MATCH_OVER');
      broadcastEvent({
        action: 'ROUND_WINNER',
        phase: 'MATCH_OVER',
        scores: scoresRef.current,
      });
      return;
    }

    const nextR = roundRef.current + 1;
    const nextChallenge = challengesRef.current[nextR - 1];

    setRound(nextR);
    setCurrentChallenge(nextChallenge);
    setPhase('GAMEPLAY');
    setRoundWinner(null);
    setIsTimeout(false);
    setTimeLeftSec(20);
    setProgressPercent(100);
    setAdvanceCountdown(null);

    broadcastEvent({
      action: 'NEW_ROUND',
      phase: 'GAMEPLAY',
      round: nextR,
      maxRounds,
      challenge: nextChallenge,
      scores: scoresRef.current,
    });
  }, [broadcastEvent, maxRounds]);

  // Process a guess from a contestant
  const handleProcessGuess = useCallback((playerId: string, playerName: string, guessText: string) => {
    if (phaseRef.current !== 'GAMEPLAY') return;
    const challenge = currentChallengeRef.current;
    if (!challenge) return;

    const normGuess = normalizeArabicFootball(guessText);
    if (!normGuess) return;

    // Check if guess matches any valid answer
    const isCorrect = challenge.validAnswers.some(ans => {
      const normAns = normalizeArabicFootball(ans);
      return normAns === normGuess || normAns.includes(normGuess) || normGuess.includes(normAns);
    });

    if (isCorrect) {
      // Instant round freeze & win
      sound.playVictory();
      setPhase('ROUND_REVEAL');
      setRoundWinner({ id: playerId, name: playerName, guessText });
      setIsTimeout(false);

      // Award +1 pt
      const newScores = {
        ...scoresRef.current,
        [playerId]: (scoresRef.current[playerId] || 0) + 1,
      };
      setScores(newScores);

      // Update player scores list
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, score: (p.score || 0) + 1 } : p));

      broadcastEvent({
        action: 'ROUND_WINNER',
        phase: 'ROUND_REVEAL',
        round: roundRef.current,
        winnerPlayerId: playerId,
        winnerPlayerName: playerName,
        guessText,
        challenge,
        scores: newScores,
      });

      // Auto advance after 3 seconds
      setAdvanceCountdown(3);
      let count = 3;
      const cdTimer = setInterval(() => {
        count--;
        setAdvanceCountdown(count);
        if (count <= 0) {
          clearInterval(cdTimer);
          handleNextRound();
        }
      }, 1000);
    } else {
      // Wrong guess: lockout wrong contestant for 5s
      sound.playIncorrect();
      broadcastEvent({
        action: 'WRONG_GUESS',
        playerId,
        playerName,
        guessText,
      });
    }
  }, [broadcastEvent, handleNextRound]);

  // 20-Second round timer loop
  useEffect(() => {
    if (phase !== 'GAMEPLAY') return;

    const startTime = Date.now();
    const TICK = 100;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingMs = Math.max(0, ROUND_DURATION_MS - elapsed);
      const remainingSec = Math.ceil(remainingMs / 1000);
      const pct = (remainingMs / ROUND_DURATION_MS) * 100;

      setTimeLeftSec(remainingSec);
      setProgressPercent(pct);

      if (remainingMs <= 0) {
        clearInterval(timer);
        // Round timed out!
        sound.playWhistle();
        setPhase('ROUND_REVEAL');
        setIsTimeout(true);
        setRoundWinner(null);

        broadcastEvent({
          action: 'ROUND_TIMEOUT',
          phase: 'ROUND_REVEAL',
          round: roundRef.current,
          challenge: currentChallengeRef.current || undefined,
        });

        // Auto advance after 3 seconds
        setAdvanceCountdown(3);
        let count = 3;
        const cdTimer = setInterval(() => {
          count--;
          setAdvanceCountdown(count);
          if (count <= 0) {
            clearInterval(cdTimer);
            handleNextRound();
          }
        }, 1000);
      }
    }, TICK);

    return () => clearInterval(timer);
  }, [phase, round, broadcastEvent, handleNextRound]);

  // Setup Realtime Presence & Broadcast
  useEffect(() => {
    if (!roomCode) return;

    const channelId = `mutuallink:${roomCode}`;

    const existingChannel = supabase.getChannels().find(
      ch => ch.topic === `realtime:${channelId}` || ch.topic === channelId
    );
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    const channel = supabase.channel(channelId, {
      config: {
        broadcast: { self: true },
        presence: { key: 'host_tv' },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const rawEntries = Object.values(state).flat() as any[];
        const map = new Map<string, MutualLinkPlayer>();

        rawEntries.forEach(entry => {
          if (entry.id && entry.id !== 'host_tv' && !map.has(entry.id)) {
            map.set(entry.id, {
              id: entry.id,
              name: entry.name || 'لاعب',
              avatar: entry.avatar || '⚽',
              score: scoresRef.current[entry.id] || 0,
            });
          }
        });

        const activeList = Array.from(map.values());
        setPlayers(activeList);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        sound.playPlayerJoin();
        newPresences.forEach((entry: any) => {
          if (entry.id && entry.id !== 'host_tv') {
            setPlayers(prev => {
              if (prev.some(p => p.id === entry.id)) return prev;
              return [...prev, {
                id: entry.id,
                name: entry.name || 'لاعب',
                avatar: entry.avatar || '⚽',
                score: scoresRef.current[entry.id] || 0,
              }];
            });
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((entry: any) => {
          if (entry.id) {
            setPlayers(prev => prev.filter(p => p.id !== entry.id));
          }
        });
      })
      .on('broadcast', { event: 'mutual_link_event' }, ({ payload }) => {
        if (!payload) return;
        const ev = payload as MutualLinkEventPayload;

        if (ev.action === 'SUBMIT_GUESS' && ev.playerId && ev.guessText) {
          handleProcessGuess(ev.playerId, ev.playerName || 'لاعب', ev.guessText);
        } else if (ev.action === 'RESET_LOBBY') {
          setPhase('LOBBY');
          setRound(1);
          setRoundWinner(null);
          setIsTimeout(false);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[MutualLinkTV] Subscribed to realtime channel:', channelId);
          channel.track({
            id: 'host_tv',
            name: 'شاشة العرض',
            role: 'tv',
            joinedAt: Date.now(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, handleProcessGuess]);

  // Join URL for Mobile Contenders
  const joinUrl = `${window.location.origin}/room/${roomCode}/football/mutual-link`;

  // Sorted leaderboard
  const sortedPlayers = [...players].sort((a, b) => {
    const sA = scores[a.id] || 0;
    const sB = scores[b.id] || 0;
    return sB - sA;
  });

  return (
    <div
      className="min-h-screen w-full bg-[#E5E0D5] text-[#2C2A29] flex flex-col font-sans select-none overflow-x-hidden relative"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(44, 42, 41, 0.05) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
      dir="rtl"
    >
      {/* Top Header */}
      <MutualLinkTopBar
        roomCode={roomCode}
        phase={phase}
        round={round}
        maxRounds={maxRounds}
        timeLeft={phase === 'GAMEPLAY' ? timeLeftSec : undefined}
        onExit={() => setPhase('LOBBY')}
        onEndRoom={handleTerminateRoom}
      />

      {/* Progress Bar (20s Countdown) */}
      {phase === 'GAMEPLAY' && (
        <div className="w-full h-2.5 bg-[#D5CFC5] border-b-2 border-[#2C2A29] overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ease-linear ${
              progressPercent > 30 ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Main Content Arena */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* =======================================================
            STATE 1: LOBBY
            ======================================================= */}
        {phase === 'LOBBY' && (
          <div className="flex flex-col items-center justify-center w-full max-w-4xl space-y-8 animate-fade-in">
            {/* Header Title Banner */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 bg-[#8A9A5B] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] px-4 py-1.5 rounded-xl font-black text-sm">
                <LinkIcon size={16} />
                <span>حلقة الوصل الكروية</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-[#2C2A29] tracking-tight">
                اكتشف الرابط السري بين الأساطير والأندية!
              </h2>
              <p className="text-[#5C4033] font-bold text-base md:text-lg">
                امسح الرمز بالجوال لتنضم للتحدي المباشر السريع ⚡
              </p>
            </div>

            {/* QR Card & Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              {/* QR Code Container */}
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                <div className="bg-white p-4 rounded-xl border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] mb-4">
                  <QRCodeSVG
                    value={joinUrl}
                    size={190}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-black text-[#5C4033] uppercase">كود الغرفة السري</span>
                  <div className="font-mono text-3xl font-black tracking-widest text-[#2C2A29]">
                    {roomCode}
                  </div>
                </div>
              </div>

              {/* Joined Players Roster */}
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b-2 border-[#2C2A29] pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Users size={20} className="text-[#8A9A5B]" />
                      <h3 className="font-black text-lg text-[#2C2A29]">المتنافسون الجاهزون</h3>
                    </div>
                    <span className="bg-[#E5E0D5] border border-[#2C2A29] font-black text-sm px-2.5 py-0.5 rounded-lg">
                      {players.length} متسابق
                    </span>
                  </div>

                  {players.length === 0 ? (
                    <div className="py-12 text-center text-[#5C4033] font-bold text-sm">
                      بانتظار مسح الرمز وانضمام المتسابقين...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1">
                      {players.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 bg-[#E5E0D5] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] px-3 py-2 rounded-xl"
                        >
                          <span className="text-xl">{p.avatar || '⚽'}</span>
                          <span className="font-black text-sm text-[#2C2A29] truncate">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Big Start Game Button */}
                <button
                  onClick={handleStartGame}
                  className="w-full mt-6 bg-[#8A9A5B] hover:bg-[#78884E] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none py-3.5 px-6 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Play size={20} className="fill-[#F7F4EC]" />
                  <span>انطلق - ابدأ التحدي (5 جولات)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            STATE 2 & 3: GAMEPLAY & ROUND REVEAL
            ======================================================= */}
        {(phase === 'GAMEPLAY' || phase === 'ROUND_REVEAL') && currentChallenge && (
          <div className="flex flex-col items-center justify-between w-full h-full max-w-6xl space-y-6">
            {/* Top Prompt Banner */}
            <div className="text-center space-y-1">
              <span className="inline-block bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] px-4 py-1 rounded-xl text-xs font-black text-[#5C4033]">
                {currentChallenge.type === 'CLUB_TO_CLUB'
                  ? 'تحدي نادي ضد نادي 🛡️'
                  : 'تحدي لاعب ضد لاعب 🏃‍♂️'}
              </span>
              <h2 className="text-2xl md:text-4xl font-black text-[#2C2A29] tracking-tight">
                {currentChallenge.type === 'CLUB_TO_CLUB'
                  ? 'من هو اللاعب الذي لعب للناديين معاً؟'
                  : 'ما هو النادي أو المنتخب المشترك بين النجمين؟'}
              </h2>
            </div>

            {/* The Brutalist Link Arena (Entity A <== [ ؟ ] ==> Entity B) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center w-full py-4 relative">
              {/* Entity A Card (Left) */}
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 hover:shadow-[6px_6px_0px_#2C2A29] transition-all">
                <div className="w-36 h-36 md:w-44 md:h-44 bg-[#E5E0D5] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl overflow-hidden flex items-center justify-center p-2 relative">
                  <img
                    src={currentChallenge.entityA.image}
                    alt={currentChallenge.entityA.name}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="w-full h-full object-contain filter drop-shadow"
                    onError={(e) => {
                      // Fallback placeholder
                      (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%238A9A5B"/><text x="50" y="60" font-size="40" text-anchor="middle" fill="%23F7F4EC">⚽</text></svg>`;
                    }}
                  />
                </div>
                <h3 className="text-xl md:text-2xl font-black text-[#2C2A29]">
                  {currentChallenge.entityA.name}
                </h3>
              </div>

              {/* Center Bridge: Animated Question Box [ ؟ ] or Revealed Card */}
              <div className="flex flex-col items-center justify-center py-4 relative">
                {/* Connecting lines for brutalist bridge */}
                <div className="hidden md:block absolute w-full h-1 bg-[#2C2A29] top-1/2 -z-0" />

                {phase === 'GAMEPLAY' ? (
                  // Glowing Question Box
                  <div className="w-40 h-40 md:w-48 md:h-48 bg-[#8A9A5B] border-4 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-3xl flex flex-col items-center justify-center text-center p-4 z-10 animate-bounce duration-1000">
                    <span className="text-6xl md:text-7xl font-black text-[#F7F4EC] select-none filter drop-shadow">
                      ؟
                    </span>
                    <span className="mt-2 text-xs font-black text-[#F7F4EC] bg-[#2C2A29] px-2.5 py-0.5 rounded-lg">
                      حلقة الوصل
                    </span>
                  </div>
                ) : (
                  // Revealed Answer Card (Flipped)
                  <div className="w-44 h-52 md:w-52 md:h-60 bg-[#F7F4EC] border-4 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-3xl flex flex-col items-center justify-center text-center p-4 z-10 animate-scale-up">
                    <div className="w-24 h-24 md:w-28 md:h-28 bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-2xl overflow-hidden p-1 mb-2">
                      <img
                        src={currentChallenge.revealItem.image}
                        alt={currentChallenge.revealItem.name}
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="text-xs font-bold text-[#8A9A5B]">حلقة الوصل هي</span>
                    <h4 className="text-lg md:text-xl font-black text-[#2C2A29] leading-tight">
                      {currentChallenge.revealItem.name}
                    </h4>
                    {currentChallenge.revealItem.subtitle && (
                      <p className="text-[11px] font-bold text-[#5C4033] mt-1">
                        {currentChallenge.revealItem.subtitle}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Entity B Card (Right) */}
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 hover:shadow-[6px_6px_0px_#2C2A29] transition-all">
                <div className="w-36 h-36 md:w-44 md:h-44 bg-[#E5E0D5] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl overflow-hidden flex items-center justify-center p-2 relative">
                  <img
                    src={currentChallenge.entityB.image}
                    alt={currentChallenge.entityB.name}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="w-full h-full object-contain filter drop-shadow"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%238A9A5B"/><text x="50" y="60" font-size="40" text-anchor="middle" fill="%23F7F4EC">⚽</text></svg>`;
                    }}
                  />
                </div>
                <h3 className="text-xl md:text-2xl font-black text-[#2C2A29]">
                  {currentChallenge.entityB.name}
                </h3>
              </div>
            </div>

            {/* Celebration or Timeout Banner */}
            {phase === 'ROUND_REVEAL' && (
              <div className="w-full max-w-2xl animate-fade-in">
                {roundWinner ? (
                  <div className="bg-[#8A9A5B] text-[#F7F4EC] border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={32} className="text-[#F7F4EC]" />
                      <div>
                        <h4 className="font-black text-xl md:text-2xl">
                          {roundWinner.name} جاب حلقة الوصل! (+1 pt)
                        </h4>
                        <p className="text-xs md:text-sm font-bold opacity-90">
                          الإجابة: {roundWinner.guessText}
                        </p>
                      </div>
                    </div>
                    {advanceCountdown !== null && (
                      <span className="text-xs font-black bg-[#2C2A29] text-[#F7F4EC] px-3 py-1 rounded-xl">
                        الجولة التالية خلال {advanceCountdown}ث
                      </span>
                    )}
                  </div>
                ) : isTimeout ? (
                  <div className="bg-[#C68B59] text-[#F7F4EC] border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle size={32} className="text-[#F7F4EC]" />
                      <div>
                        <h4 className="font-black text-xl md:text-2xl">
                          انتهى الوقت! لم يجب أحد في الوقت المحدد
                        </h4>
                        <p className="text-xs md:text-sm font-bold opacity-90">
                          حلقة الوصل كانت: {currentChallenge.revealItem.name}
                        </p>
                      </div>
                    </div>
                    {advanceCountdown !== null && (
                      <span className="text-xs font-black bg-[#2C2A29] text-[#F7F4EC] px-3 py-1 rounded-xl">
                        الجولة التالية خلال {advanceCountdown}ث
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Bottom Contestants Strip */}
            <div className="w-full bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl p-3 flex items-center justify-between overflow-x-auto">
              <div className="flex items-center gap-2 text-xs font-black text-[#5C4033] px-2 shrink-0">
                <Trophy size={16} className="text-[#8A9A5B]" />
                <span>النتائج:</span>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto py-1">
                {sortedPlayers.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] shrink-0 ${
                      roundWinner?.id === p.id ? 'bg-[#8A9A5B] text-white animate-pulse' : 'bg-[#E5E0D5] text-[#2C2A29]'
                    }`}
                  >
                    <span>{p.avatar || '⚽'}</span>
                    <span className="font-black text-xs md:text-sm">{p.name}</span>
                    <span className="bg-[#2C2A29] text-[#F7F4EC] px-2 py-0.5 rounded-lg text-xs font-black font-mono">
                      {scores[p.id] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            STATE 4: MATCH OVER (FINAL PODIUM)
            ======================================================= */}
        {phase === 'MATCH_OVER' && (
          <div className="flex flex-col items-center justify-center w-full max-w-4xl space-y-8 animate-fade-in text-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 bg-[#8A9A5B] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] px-4 py-1.5 rounded-xl font-black text-sm">
                <Sparkles size={16} />
                <span>نهاية التحدي (5 جولات)</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-[#2C2A29]">
                🎉 حفل تتويج ملك حلقة الوصل!
              </h2>
            </div>

            {/* Podium Display */}
            <div className="grid grid-cols-3 gap-4 items-end w-full max-w-2xl py-6">
              {/* 2nd Place */}
              {sortedPlayers[1] ? (
                <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4 flex flex-col items-center h-48 justify-end">
                  <span className="text-2xl mb-1">{sortedPlayers[1].avatar || '⚽'}</span>
                  <span className="text-xl font-black text-[#5C4033]">🥈 المركز 2</span>
                  <h4 className="font-black text-base text-[#2C2A29] truncate max-w-full">
                    {sortedPlayers[1].name}
                  </h4>
                  <span className="bg-[#E5E0D5] border border-[#2C2A29] px-3 py-0.5 rounded-lg font-black text-sm mt-2">
                    {scores[sortedPlayers[1].id] || 0} نقاط
                  </span>
                </div>
              ) : (
                <div className="h-48" />
              )}

              {/* 1st Place (Champion) */}
              {sortedPlayers[0] ? (
                <div className="bg-[#8A9A5B] text-[#F7F4EC] border-3 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-2xl p-6 flex flex-col items-center h-60 justify-end transform -translate-y-4">
                  <span className="text-4xl mb-2">{sortedPlayers[0].avatar || '👑'}</span>
                  <span className="text-2xl font-black">🥇 البطل</span>
                  <h4 className="font-black text-xl truncate max-w-full">
                    {sortedPlayers[0].name}
                  </h4>
                  <span className="bg-[#2C2A29] text-[#F7F4EC] px-4 py-1 rounded-xl font-black text-base mt-2 font-mono">
                    {scores[sortedPlayers[0].id] || 0} نقاط
                  </span>
                </div>
              ) : (
                <div className="h-60" />
              )}

              {/* 3rd Place */}
              {sortedPlayers[2] ? (
                <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4 flex flex-col items-center h-40 justify-end">
                  <span className="text-2xl mb-1">{sortedPlayers[2].avatar || '⚽'}</span>
                  <span className="text-lg font-black text-[#5C4033]">🥉 المركز 3</span>
                  <h4 className="font-black text-sm text-[#2C2A29] truncate max-w-full">
                    {sortedPlayers[2].name}
                  </h4>
                  <span className="bg-[#E5E0D5] border border-[#2C2A29] px-3 py-0.5 rounded-lg font-black text-sm mt-2">
                    {scores[sortedPlayers[2].id] || 0} نقاط
                  </span>
                </div>
              ) : (
                <div className="h-40" />
              )}
            </div>

            {/* Actions: Play Again or Back to Lobby */}
            <div className="flex gap-4">
              <button
                onClick={handleStartGame}
                className="bg-[#8A9A5B] hover:bg-[#78884E] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] px-6 py-3 rounded-xl font-black text-base flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw size={18} />
                <span>لعب تحدي جديد (5 جولات)</span>
              </button>
              <button
                onClick={() => setPhase('LOBBY')}
                className="bg-[#C68B59] hover:bg-[#B57A48] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] px-6 py-3 rounded-xl font-black text-base flex items-center gap-2 cursor-pointer"
              >
                <span>العودة للوبي</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
