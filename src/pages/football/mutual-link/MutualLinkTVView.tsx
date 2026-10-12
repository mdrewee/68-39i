import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Play, Users, Trophy, RotateCcw, Link as LinkIcon, CheckCircle2, Copy, Check } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { MutualLinkTopBar } from './components/MutualLinkTopBar';
import { SafeEntityBadge } from './components/SafeEntityBadge';
import {
  MutualLinkPhase,
  MutualLinkPlayer,
  MutualLinkEventPayload,
  MutualLinkChallenge,
} from './types';
import {
  generateLiveChallengeAsync,
  validateLiveAnswer,
  normalizeArabicFootball,
} from '../../../utils/wikidataFootballService';
import { sound } from '../../../lib/audio';

export const MutualLinkTVView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // Core Game State (Strictly 10 Rounds)
  const maxRounds = 10;
  const [phase, setPhase] = useState<MutualLinkPhase>('LOBBY');
  const [round, setRound] = useState<number>(1);
  const [currentChallenge, setCurrentChallenge] = useState<MutualLinkChallenge | null>(null);

  const [players, setPlayers] = useState<MutualLinkPlayer[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({}); // playerId -> points

  // Winner of current round & multi-answer details
  const [roundWinner, setRoundWinner] = useState<{
    id: string;
    name: string;
    guessText: string;
    matchedName?: string;
    otherOptions?: string[];
  } | null>(null);
  const [isTimeout, setIsTimeout] = useState<boolean>(false);
  const [timeoutOtherOptions, setTimeoutOtherOptions] = useState<string[]>([]);

  // 20-Second round timer
  const ROUND_DURATION_MS = 20000;
  const [timeLeftSec, setTimeLeftSec] = useState<number>(20);
  const [progressPercent, setProgressPercent] = useState<number>(100);

  // Auto-advance countdown after reveal
  const [advanceCountdown, setAdvanceCountdown] = useState<number | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyCode = async () => {
    sound.playClick();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(roomCode);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = roomCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Background Pre-fetching Refs
  const nextChallengeRef = useRef<MutualLinkChallenge | null>(null);
  const usedPairsRef = useRef<Set<string>>(new Set());

  // References for live timer & state
  const phaseRef = useRef<MutualLinkPhase>(phase);
  const roundRef = useRef<number>(round);
  const currentChallengeRef = useRef<MutualLinkChallenge | null>(null);
  const playersRef = useRef<MutualLinkPlayer[]>(players);
  const scoresRef = useRef<Record<string, number>>(scores);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { roundRef.current = round; }, [round]);
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

  // 1. In LOBBY: Pre-fetch Round 1 before game starts (Zero Wait Time)
  useEffect(() => {
    if (phase === 'LOBBY' && !nextChallengeRef.current) {
      generateLiveChallengeAsync(usedPairsRef.current).then((challenge) => {
        if (challenge) {
          nextChallengeRef.current = challenge;
          console.log('[MutualLinkTV] Pre-fetched Round 1 from Wikidata:', challenge.clubA.name, 'x', challenge.clubB.name);
        }
      });
    }
  }, [phase]);

  // Host Kick Player from Lobby
  const handleKickPlayer = useCallback((targetPlayerId: string) => {
    sound.playClick();
    broadcastEvent({
      action: 'KICK_PLAYER',
      targetPlayerId,
    });
    setPlayers((prev) => prev.filter((p) => p.id !== targetPlayerId));
  }, [broadcastEvent]);

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

  // Start match from Lobby (10 rounds)
  const handleStartGame = useCallback(async () => {
    sound.playWhistle();

    let initialChallenge = nextChallengeRef.current;
    if (!initialChallenge) {
      initialChallenge = await generateLiveChallengeAsync(usedPairsRef.current);
    }
    if (!initialChallenge) {
      console.error('[MutualLinkTV] Failed to generate challenge');
      return;
    }

    nextChallengeRef.current = null; // Clear active slot

    setCurrentChallenge(initialChallenge);
    setRound(1);
    setPhase('GAMEPLAY');
    setRoundWinner(null);
    setIsTimeout(false);
    setTimeLeftSec(20);
    setProgressPercent(100);

    // Reset scores for fresh game
    const resetScores: Record<string, number> = {};
    playersRef.current.forEach((p) => { resetScores[p.id] = 0; });
    setScores(resetScores);

    broadcastEvent({
      action: 'GAME_START',
      phase: 'GAMEPLAY',
      round: 1,
      maxRounds,
      challenge: initialChallenge,
      scores: resetScores,
    });

    // CRITICAL: Immediately pre-fetch Round 2 in background while Round 1 is actively being played!
    generateLiveChallengeAsync(usedPairsRef.current).then((next) => {
      if (next) {
        nextChallengeRef.current = next;
        console.log('[MutualLinkTV] Background pre-fetched Round 2:', next.clubA.name, 'x', next.clubB.name);
      }
    });
  }, [broadcastEvent, maxRounds]);

  // Advance to Next Round or Final Podium
  const handleNextRound = useCallback(async () => {
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
    let nextChallenge = nextChallengeRef.current;
    if (!nextChallenge) {
      nextChallenge = await generateLiveChallengeAsync(usedPairsRef.current);
    }
    if (!nextChallenge) return;

    nextChallengeRef.current = null; // Clear active slot

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

    // CRITICAL: Immediately trigger background pre-fetch for next round (N + 1)
    if (nextR < maxRounds) {
      generateLiveChallengeAsync(usedPairsRef.current).then((next) => {
        if (next) {
          nextChallengeRef.current = next;
          console.log('[MutualLinkTV] Background pre-fetched Round', nextR + 1, ':', next.clubA.name, 'x', next.clubB.name);
        }
      });
    }
  }, [broadcastEvent, maxRounds]);

  // Process a guess from a contestant (Immediate Dynamic Answer Evaluation via Live Wikidata)
  const handleProcessGuess = useCallback((playerId: string, playerName: string, guessText: string) => {
    if (phaseRef.current !== 'GAMEPLAY') return;
    const challenge = currentChallengeRef.current;
    if (!challenge) return;

    const normGuess = normalizeArabicFootball(guessText);
    if (!normGuess) return;

    // Check if guess matches ANY valid player returned from the live Wikidata query
    const isCorrect =
      validateLiveAnswer(guessText, challenge.validAnswerStrings) ||
      challenge.validPlayers.some((p) => {
        const ar = normalizeArabicFootball(p.nameAr);
        const en = normalizeArabicFootball(p.nameEn);
        return ar === normGuess || en === normGuess || ar.includes(normGuess) || normGuess.includes(ar);
      });

    if (isCorrect) {
      // Find the specific matched display name
      const matchedPlayer = challenge.validPlayers.find((p) => {
        const ar = normalizeArabicFootball(p.nameAr);
        const en = normalizeArabicFootball(p.nameEn);
        return (
          ar === normGuess ||
          en === normGuess ||
          ar.includes(normGuess) ||
          normGuess.includes(ar) ||
          validateLiveAnswer(guessText, [p.nameAr, p.nameEn])
        );
      });

      const matchedOfficialName = matchedPlayer ? matchedPlayer.nameAr || matchedPlayer.nameEn : guessText;
      const matchedPhoto = matchedPlayer?.photoUrl || challenge.revealItem.image;

      // Collect all other valid options discovered by Wikidata for display
      const normMatched = normalizeArabicFootball(matchedOfficialName);
      const otherOptions = challenge.validDisplayNames.filter(
        (name) => normalizeArabicFootball(name) !== normMatched && normalizeArabicFootball(name) !== normGuess
      );

      // Instant round freeze & win
      sound.playVictory();
      setPhase('ROUND_REVEAL');
      setRoundWinner({
        id: playerId,
        name: playerName,
        guessText,
        matchedName: matchedOfficialName,
        otherOptions,
      });
      setIsTimeout(false);

      // Update revealItem dynamically to showcase the winner's guess
      setCurrentChallenge((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          revealItem: {
            name: matchedOfficialName,
            image: matchedPhoto,
            subtitle: `لعب مع ${prev.clubA.name} و ${prev.clubB.name}`,
          },
        };
      });

      // Award +1 pt
      const newScores = {
        ...scoresRef.current,
        [playerId]: (scoresRef.current[playerId] || 0) + 1,
      };
      setScores(newScores);

      // Update player scores list
      setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, score: (p.score || 0) + 1 } : p)));

      broadcastEvent({
        action: 'ROUND_WINNER',
        phase: 'ROUND_REVEAL',
        round: roundRef.current,
        winnerPlayerId: playerId,
        winnerPlayerName: playerName,
        guessText,
        matchedName: matchedOfficialName,
        otherOptions,
        challenge,
        scores: newScores,
      });

      // Auto advance after 4 seconds
      setAdvanceCountdown(4);
      let count = 4;
      const cdTimer = setInterval(() => {
        count--;
        setAdvanceCountdown(count);
        if (count <= 0) {
          clearInterval(cdTimer);
          handleNextRound();
        }
      }, 1000);
    } else {
      // Wrong guess: lockout wrong contestant for 4s
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

        const challenge = currentChallengeRef.current;
        const others = challenge
          ? challenge.validDisplayNames.filter((d) => d !== challenge.revealItem.name)
          : [];
        setTimeoutOtherOptions(others);

        broadcastEvent({
          action: 'ROUND_TIMEOUT',
          phase: 'ROUND_REVEAL',
          round: roundRef.current,
          challenge: challenge || undefined,
          otherOptions: others,
        });

        // Auto advance after 4 seconds
        setAdvanceCountdown(4);
        let count = 4;
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
      (ch) => ch.topic === `realtime:${channelId}` || ch.topic === channelId
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

        rawEntries.forEach((entry) => {
          if (entry.id && entry.id !== 'host_tv' && !map.has(entry.id)) {
            map.set(entry.id, {
              id: entry.id,
              name: entry.name || '',
              score: scoresRef.current[entry.id] || 0,
              isReady: entry.isReady || false,
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
            setPlayers((prev) => {
              if (prev.some((p) => p.id === entry.id)) return prev;
              return [
                ...prev,
                {
                  id: entry.id,
                  name: entry.name || '',
                  score: scoresRef.current[entry.id] || 0,
                  isReady: false,
                },
              ];
            });
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((entry: any) => {
          if (entry.id) {
            setPlayers((prev) => prev.filter((p) => p.id !== entry.id));
          }
        });
      })
      .on('broadcast', { event: 'mutual_link_event' }, ({ payload }) => {
        if (!payload) return;
        const ev = payload as MutualLinkEventPayload;

        if (ev.action === 'SUBMIT_GUESS' && ev.playerId && ev.guessText) {
          handleProcessGuess(ev.playerId, ev.playerName || '', ev.guessText);
        } else if (ev.action === 'PLAYER_READY' && ev.playerId) {
          setPlayers((prev) =>
            prev.map((p) => (p.id === ev.playerId ? { ...p, isReady: Boolean(ev.isReady) } : p))
          );
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
                <span>حلقة الوصل الكروية ⚡</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-[#2C2A29] tracking-tight">
                من هو اللاعب المشترك بين الناديين؟
              </h1>
              <p className="text-sm md:text-base font-bold text-[#5C4033]">
                بيانات حية مباشرة من مستودع ويكيداتا العالمي عبر التاريخ!
              </p>
            </div>

            {/* Brutalist QR & Roster Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full bg-[#F7F4EC] border-3 border-[#2C2A29] shadow-[8px_8px_0px_#2C2A29] rounded-3xl p-6 md:p-8">
              {/* QR Code Section */}
              <div className="flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-[#2C2A29] rounded-2xl bg-white space-y-4">
                <div className="bg-[#F7F4EC] p-3 rounded-2xl border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29]">
                  <QRCodeSVG
                    value={joinUrl}
                    size={200}
                    level="H"
                    includeMargin={false}
                    className="rounded-lg"
                  />
                </div>
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <span className="text-xs font-black text-[#5C4033] block">امسح الرمز للدخول بالجوال</span>
                  <button
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-2 bg-[#F7F4EC] hover:bg-[#E5E0D5] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] px-4 py-2 rounded-xl text-lg font-black font-mono text-[#2C2A29] cursor-pointer transition-all"
                    title="اضغط لنسخ كود الغرفة"
                  >
                    {copied ? <Check size={18} className="text-[#8A9A5B]" /> : <Copy size={18} className="text-[#5C4033]" />}
                    <span>{roomCode}</span>
                    <span className="text-xs font-bold text-[#5C4033] font-sans">
                      {copied ? '(تم النسخ ✓)' : '(نسخ الكود)'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Contestants Lobby List */}
              <div className="flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b-2 border-[#2C2A29]">
                    <div className="flex items-center gap-2 font-black text-lg text-[#2C2A29]">
                      <Users size={20} />
                      <span>المتسابقون ({players.length})</span>
                    </div>
                  </div>

                  {players.length === 0 ? (
                    <div className="py-12 text-center text-[#5C4033] font-bold text-sm">
                      بانتظار مسح الرمز وانضمام المتسابقين...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1 mt-3">
                      {players.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 bg-[#E5E0D5] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] px-3 py-2 rounded-xl"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {p.isReady && (
                              <span className="text-[10px] bg-[#8A9A5B] text-[#F7F4EC] px-1.5 py-0.5 rounded-md font-black shrink-0">
                                جاهز ✓
                              </span>
                            )}
                            <span className="font-black text-sm text-[#2C2A29] truncate">{p.name}</span>
                          </div>

                          {/* Host Kick Button [×] */}
                          <button
                            type="button"
                            onClick={() => handleKickPlayer(p.id)}
                            className="bg-[#C68B59] hover:bg-[#2C2A29] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 transition-colors cursor-pointer"
                            title="استبعاد المتسابق"
                          >
                            ×
                          </button>
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
                  <span>انطلق - ابدأ التحدي (10 جولات)</span>
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
                تحدي نادٍ ضد نادٍ 🛡️
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-[#2C2A29] mb-4">
                من هو اللاعب الذي لعب للناديين؟
              </h2>
            </div>

            {/* The Brutalist Link Arena (Entity A <== [ ؟ ] ==> Entity B) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center w-full py-4 relative">
              {/* Entity A Card (Left) */}
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 hover:shadow-[6px_6px_0px_#2C2A29] transition-all">
                <div className="w-36 h-36 md:w-44 md:h-44 bg-[#E5E0D5] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl overflow-hidden flex items-center justify-center p-2 relative">
                  <SafeEntityBadge
                    key={`${currentChallenge.id}_${currentChallenge.entityA.name}`}
                    id={`${currentChallenge.id}_entityA`}
                    src={currentChallenge.entityA.image}
                    alt={currentChallenge.entityA.name}
                    fallbackText={currentChallenge.entityA.name}
                    fallbackColor="#8A9A5B"
                    className="w-full h-full"
                  />
                </div>
                <h3 className="text-xl md:text-2xl font-black text-[#2C2A29]">
                  {currentChallenge.entityA.name}
                </h3>
              </div>

              {/* Center Bridge: COMPLETELY STATIC QUESTION BOX [ ؟ ] or Revealed Card */}
              <div className="flex flex-col items-center justify-center py-4 relative">
                {/* Connecting line for brutalist bridge */}
                <div className="hidden md:block absolute w-full h-1 bg-[#2C2A29] top-1/2 -z-0" />

                {phase === 'GAMEPLAY' ? (
                  // Completely Static Brutalist Card: ZERO BOUNCE OR JITTER
                  <div className="w-36 h-36 md:w-44 md:h-44 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-xl flex flex-col items-center justify-center font-black text-2xl text-[#2C2A29] z-10 select-none">
                    <span className="text-5xl md:text-6xl font-black text-[#2C2A29]">
                      ؟
                    </span>
                    <span className="mt-2 text-xs font-black text-[#5C4033] bg-[#E5E0D5] border border-[#2C2A29] px-2.5 py-0.5 rounded-lg">
                      حلقة الوصل
                    </span>
                  </div>
                ) : (
                  // Revealed Answer Card (Static crisp brutalist)
                  <div className="w-44 h-52 md:w-52 md:h-60 bg-[#F7F4EC] border-3 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-2xl flex flex-col items-center justify-center text-center p-4 z-10">
                    <div className="w-24 h-24 md:w-28 md:h-28 bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-xl overflow-hidden p-1 mb-2 flex items-center justify-center">
                      <SafeEntityBadge
                        key={`${currentChallenge.id}_reveal_${currentChallenge.revealItem.name}`}
                        id={`${currentChallenge.id}_reveal`}
                        src={currentChallenge.revealItem.image}
                        alt={currentChallenge.revealItem.name}
                        fallbackText={currentChallenge.revealItem.name}
                        fallbackColor="#8A9A5B"
                        className="w-full h-full"
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
                  <SafeEntityBadge
                    key={`${currentChallenge.id}_${currentChallenge.entityB.name}`}
                    id={`${currentChallenge.id}_entityB`}
                    src={currentChallenge.entityB.image}
                    alt={currentChallenge.entityB.name}
                    fallbackText={currentChallenge.entityB.name}
                    fallbackColor="#8A9A5B"
                    className="w-full h-full"
                  />
                </div>
                <h3 className="text-xl md:text-2xl font-black text-[#2C2A29]">
                  {currentChallenge.entityB.name}
                </h3>
              </div>
            </div>

            {/* Celebration or Timeout Banner with Multi-Answer Tag */}
            {phase === 'ROUND_REVEAL' && (
              <div className="w-full max-w-3xl animate-fade-in">
                {roundWinner ? (
                  <div className="bg-[#8A9A5B] text-[#F7F4EC] border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] p-4 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={32} className="text-[#F7F4EC] shrink-0" />
                        <div>
                          <h4 className="font-black text-xl md:text-2xl">
                            {roundWinner.name} جاب حلقة الوصل! (+1 pt)
                          </h4>
                          <p className="text-xs md:text-sm font-bold opacity-95">
                            الإجابة: <span className="underline font-black">{roundWinner.matchedName || roundWinner.guessText}</span>
                          </p>
                        </div>
                      </div>
                      {advanceCountdown !== null && (
                        <span className="text-xs font-black bg-[#2C2A29] text-[#F7F4EC] px-3 py-1 rounded-xl">
                          الجولة التالية خلال {advanceCountdown}ث
                        </span>
                      )}
                    </div>

                    {/* Small tag listing other possible valid answers discovered by Wikidata */}
                    {roundWinner.otherOptions && roundWinner.otherOptions.length > 0 && (
                      <div className="bg-[#F7F4EC] text-[#2C2A29] border border-[#2C2A29] rounded-xl px-3 py-1.5 text-xs font-bold flex flex-wrap items-center gap-1.5 shadow-[1px_1px_0px_#2C2A29]">
                        <span className="text-[#5C4033] font-black">خيارات ويكيداتا الصحيحة الأخرى:</span>
                        <span>{roundWinner.otherOptions.slice(0, 6).join('، ')}</span>
                      </div>
                    )}
                  </div>
                ) : isTimeout ? (
                  <div className="bg-[#C68B59] text-[#F7F4EC] border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] p-4 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-black text-xl">انتهى الوقت! لم يجب أحد</h4>
                        <p className="text-xs opacity-90">
                          حلقة الوصل الصحيحة: <span className="font-black underline">{currentChallenge.revealItem.name}</span>
                        </p>
                      </div>
                      {advanceCountdown !== null && (
                        <span className="text-xs font-black bg-[#2C2A29] text-[#F7F4EC] px-3 py-1 rounded-xl">
                          الجولة التالية خلال {advanceCountdown}ث
                        </span>
                      )}
                    </div>
                    {timeoutOtherOptions.length > 0 && (
                      <div className="bg-[#F7F4EC] text-[#2C2A29] border border-[#2C2A29] rounded-xl px-3 py-1.5 text-xs font-bold flex flex-wrap items-center gap-1.5 shadow-[1px_1px_0px_#2C2A29]">
                        <span className="text-[#5C4033] font-black">خيارات صحيحة أخرى:</span>
                        <span>{timeoutOtherOptions.slice(0, 6).join('، ')}</span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* =======================================================
            STATE 4: MATCH OVER (FINAL PODIUM)
            ======================================================= */}
        {phase === 'MATCH_OVER' && (
          <div className="flex flex-col items-center justify-center w-full max-w-3xl space-y-8 animate-fade-in text-center">
            <div className="w-24 h-24 bg-[#8A9A5B] border-3 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-3xl flex items-center justify-center text-5xl">
              🏆
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#8A9A5B] bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1 rounded-full shadow-[2px_2px_0px_#2C2A29]">
                انتهت الـ 10 جولات
              </span>
              <h2 className="text-4xl md:text-5xl font-black text-[#2C2A29]">
                منصة تتويج حلقة الوصل!
              </h2>
            </div>

            {/* Podium Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              {sortedPlayers.slice(0, 3).map((p, idx) => {
                const rankStyles = [
                  'bg-[#8A9A5B] text-[#F7F4EC] order-1 md:order-2 md:-translate-y-4', // 1st
                  'bg-[#F7F4EC] text-[#2C2A29] order-2 md:order-1', // 2nd
                  'bg-[#E5E0D5] text-[#2C2A29] order-3 md:order-3', // 3rd
                ];
                const medals = ['🥇 المركز الأول', '🥈 المركز الثاني', '🥉 المركز الثالث'];

                return (
                  <div
                    key={p.id}
                    className={`border-3 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-2xl p-6 flex flex-col items-center justify-center space-y-2 ${rankStyles[idx]}`}
                  >
                    <span className="text-xs font-black opacity-80">{medals[idx]}</span>
                    <h3 className="text-2xl font-black truncate max-w-full">{p.name}</h3>
                    <div className="text-3xl font-black font-mono">
                      {scores[p.id] || 0} <span className="text-sm font-bold">نقطة</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Replay / Reset Button */}
            <button
              onClick={() => {
                sound.playClick();
                setPhase('LOBBY');
                setRound(1);
                setRoundWinner(null);
                setScores({});
                broadcastEvent({ action: 'RESET_LOBBY' });
              }}
              className="mt-6 bg-[#F7F4EC] hover:bg-white text-[#2C2A29] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none py-3 px-8 rounded-xl font-black text-base flex items-center gap-2 cursor-pointer transition-all"
            >
              <RotateCcw size={18} />
              <span>العودة للغرفة</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
