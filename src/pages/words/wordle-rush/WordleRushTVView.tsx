import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Trophy,
  Users,
  Play,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Crown,
  CheckCircle2,
  Clock,
  LogOut,
  ChevronLeft,
  Layers,
  Award,
  Zap,
  Power,
  XCircle
} from 'lucide-react';
import { useRoom, roomBus, cleanRoomCode } from '../../../lib/roomBus';
import { sound } from '../../../lib/audio';
import { GeographyGameLobby } from '../../../components/common/GeographyGameLobby';
import { FullscreenButton } from '../../../components/common/FullscreenButton';
import { GeoTopNavControls } from '../../../components/common/GeoTopNavControls';
import { getRandomWordleTarget } from '../../../utils/arabicDictionary';
import { TileStatus } from './wordsBank';

type WordlePhase = 'LOBBY' | 'PLAYING' | 'ROUND_SUMMARY' | 'GAME_OVER';

interface PlayerWordleProgress {
  playerId: string;
  playerName: string;
  attempts: TileStatus[][]; // Up to 6 rows of 5 statuses
  isSolved: boolean;
  earnedPoints: number;
}

export const WordleRushTVView: React.FC = () => {
  const params = useParams();
  const rawCode = (params.code || params.roomId || params.id || '').trim().toUpperCase() || 'TAQ1';
  const roomId = cleanRoomCode(rawCode);
  const navigate = useNavigate();

  const { room } = useRoom(roomId);
  const activeRoom = room || roomBus.getRoom(roomId) || roomBus.createRoom(roomId);

  const players = useMemo(() => {
    return (activeRoom.players || []).filter(p => p && p.id && p.id !== 'host_tv');
  }, [activeRoom.players]);

  // Round states
  const [phase, setPhase] = useState<WordlePhase>('LOBBY');
  const [currentRound, setCurrentRound] = useState(1);
  const [targetWord, setTargetWord] = useState<string>('');

  // Ready system: >= 2 players triggers 3s auto countdown
  const [readyPlayerIds, setReadyPlayerIds] = useState<Set<string>>(new Set());
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null);

  // Round outcome: 'WINNER' | 'ALL_LOST' | null
  const [roundOutcome, setRoundOutcome] = useState<'WINNER' | 'ALL_LOST' | null>(null);
  const [roundWinnerName, setRoundWinnerName] = useState<string>('');

  // Player progress: playerId -> progress
  const [playerProgress, setPlayerProgress] = useState<Record<string, PlayerWordleProgress>>({});
  const playerProgressRef = useRef<Record<string, PlayerWordleProgress>>({});
  playerProgressRef.current = playerProgress;

  // Cumulative scores: playerId -> total score
  const [cumulativeScores, setCumulativeScores] = useState<Record<string, number>>({});

  // Kick player
  const handleKickPlayer = useCallback((playerId: string, playerName: string) => {
    if (window.confirm(`هل أنت متأكد من طرد اللاعب "${playerName}"؟`)) {
      sound.playClick();
      roomBus.kickPlayer(roomId, playerId);
    }
  }, [roomId]);

  // Global Ejection: "إنهاء اللعبة"
  const handleReturnToLobby = useCallback(() => {
    sound.playClick();
    setPhase('LOBBY');
    setPlayerProgress({});
    setRoundOutcome(null);
    setRoundWinnerName('');
    roomBus.emit('RETURN_TO_LOBBY', roomId, {});
    const ch = (roomBus as any).getChannel?.(roomId);
    if (ch) {
      try {
        ch.send({ type: 'broadcast', event: 'RETURN_TO_LOBBY', payload: {} });
      } catch {}
    }
  }, [roomId]);

  const handleTerminateGame = useCallback(() => {
    if (window.confirm('هل أنت متأكد من إنهاء اللعبة بالكامل وإعادة الجميع للرئيسية؟')) {
      sound.playClick();
      roomBus.emit('GAME_TERMINATED', roomId, {});
      const ch = (roomBus as any).getChannel?.(roomId);
      if (ch) {
        try {
          ch.send({ type: 'broadcast', event: 'GAME_TERMINATED', payload: {} });
        } catch {}
      }
      navigate('/');
    }
  }, [roomId, navigate]);

  // Start round
  const handleStartRound = useCallback(() => {
    sound.playRoundStart();
    const word = getRandomWordleTarget();
    setTargetWord(word);
    setReadyPlayerIds(new Set());
    setAutoStartCountdown(null);
    setRoundOutcome(null);
    setRoundWinnerName('');

    // Initialize progress for all players
    const initialProgress: Record<string, PlayerWordleProgress> = {};
    players.forEach(p => {
      initialProgress[p.id] = {
        playerId: p.id,
        playerName: p.name,
        attempts: [],
        isSolved: false,
        earnedPoints: 0
      };
    });
    setPlayerProgress(initialProgress);
    playerProgressRef.current = initialProgress;

    setPhase('PLAYING');

    // Broadcast ROUND_STARTED to players
    const payload = {
      round: currentRound,
      targetWord: word,
      wordLength: 5
    };
    roomBus.emit('ROUND_STARTED', roomId, payload);
    const ch = (roomBus as any).getChannel?.(roomId);
    if (ch) {
      try {
        ch.send({ type: 'broadcast', event: 'ROUND_STARTED', payload });
      } catch {}
    }
  }, [currentRound, players, roomId]);

  // Check auto-start countdown when >= 2 players are ready
  useEffect(() => {
    if (phase !== 'LOBBY' && phase !== 'ROUND_SUMMARY') return;

    if (players.length >= 2 && readyPlayerIds.size >= 2) {
      if (autoStartCountdown === null) {
        setAutoStartCountdown(3);
      }
    } else {
      setAutoStartCountdown(null);
    }
  }, [phase, players.length, readyPlayerIds.size, autoStartCountdown]);

  // 3-second auto countdown ticker
  useEffect(() => {
    if (autoStartCountdown === null) return;
    if (autoStartCountdown <= 0) {
      handleStartRound();
      return;
    }

    sound.playTick();
    const timer = setTimeout(() => {
      setAutoStartCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [autoStartCountdown, handleStartRound]);

  // Handle Winner Termination (Instant stop on 1st player solve)
  const handleWinnerTermination = useCallback((winnerId: string, winnerName: string) => {
    sound.playVictory();
    setRoundOutcome('WINNER');
    setRoundWinnerName(winnerName);
    setPhase('ROUND_SUMMARY');

    // Award +10 pt to the winner
    setCumulativeScores(prev => ({
      ...prev,
      [winnerId]: (prev[winnerId] || 0) + 10
    }));

    // Broadcast WORDLE_ROUND_WON
    const payload = {
      winnerId,
      winnerName,
      word: targetWord,
      points: 10,
      round: currentRound
    };
    roomBus.emit('WORDLE_ROUND_WON', roomId, payload);
    const ch = (roomBus as any).getChannel?.(roomId);
    if (ch) {
      try {
        ch.send({ type: 'broadcast', event: 'WORDLE_ROUND_WON', payload });
      } catch {}
    }
  }, [targetWord, currentRound, roomId]);

  // Handle All-Loss Termination (All players exhausted 6 tries)
  const handleAllLossTermination = useCallback(() => {
    sound.playFailBuzzer();
    setRoundOutcome('ALL_LOST');
    setPhase('ROUND_SUMMARY');

    // Broadcast WORDLE_ALL_LOST
    const payload = {
      word: targetWord,
      round: currentRound
    };
    roomBus.emit('WORDLE_ALL_LOST', roomId, payload);
    const ch = (roomBus as any).getChannel?.(roomId);
    if (ch) {
      try {
        ch.send({ type: 'broadcast', event: 'WORDLE_ALL_LOST', payload });
      } catch {}
    }
  }, [targetWord, currentRound, roomId]);

  // Listen for READY, GUESS, and SOLVED events
  useEffect(() => {
    // 1. Ready toggle
    const unsubReady = roomBus.on('PLAYER_ROUND_READY', (evt) => {
      const payload = (evt as any)?.data || (evt as any)?.payload || evt;
      if (!payload?.playerId) return;

      setReadyPlayerIds(prev => {
        const next = new Set(prev);
        if (payload.isReady) next.add(payload.playerId);
        else next.delete(payload.playerId);
        return next;
      });
    });

    const unsubReadyUpdate = roomBus.on('PLAYER_READY_UPDATE', (evt) => {
      const payload = (evt as any)?.data || (evt as any)?.payload || evt;
      if (!payload?.playerId) return;

      setReadyPlayerIds(prev => {
        const next = new Set(prev);
        if (payload.isReady) next.add(payload.playerId);
        else next.delete(payload.playerId);
        return next;
      });
    });

    // 2. Guess submission (tiles only for anti-cheat)
    const unsubGuess = roomBus.on('WORDLE_GUESS', (evt) => {
      const payload = (evt as any)?.data || (evt as any)?.payload || evt;
      if (!payload || !payload.playerId || !payload.tiles) return;

      setPlayerProgress(prev => {
        const cur = prev[payload.playerId] || {
          playerId: payload.playerId,
          playerName: payload.playerName || 'متسابق',
          attempts: [],
          isSolved: false,
          earnedPoints: 0
        };

        const updatedAttempts = [...cur.attempts];
        updatedAttempts[payload.rowIndex] = payload.tiles;

        const nextState = {
          ...prev,
          [payload.playerId]: {
            ...cur,
            attempts: updatedAttempts
          }
        };
        playerProgressRef.current = nextState;

        // Check All-Loss Condition: If all players used 6 attempts and no one solved
        if (players.length > 0) {
          const allExhausted = players.every(p => {
            const prog = (nextState as Record<string, PlayerWordleProgress>)[p.id];
            return prog && prog.attempts.length >= 6 && !prog.isSolved;
          });
          if (allExhausted) {
            setTimeout(() => {
              handleAllLossTermination();
            }, 500);
          }
        }

        return nextState;
      });
    });

    // 3. First Solver Instant Win
    const unsubSolved = roomBus.on('PLAYER_SOLVED_WORDLE', (evt) => {
      const payload = (evt as any)?.data || (evt as any)?.payload || evt;
      if (!payload || !payload.playerId) return;

      // First solver terminates the game immediately!
      handleWinnerTermination(payload.playerId, payload.playerName || 'متسابق');
    });

    return () => {
      unsubReady();
      unsubReadyUpdate();
      unsubGuess();
      unsubSolved();
    };
  }, [players, handleWinnerTermination, handleAllLossTermination]);

  // Advance to next round
  const handleProceedNextRound = () => {
    sound.playClick();
    setCurrentRound(prev => prev + 1);
    handleStartRound();
  };

  // Ranked players
  const rankedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const scoreA = cumulativeScores[a.id] || 0;
      const scoreB = cumulativeScores[b.id] || 0;
      return scoreB - scoreA;
    });
  }, [players, cumulativeScores]);

  // RENDER: LOBBY
  if (phase === 'LOBBY') {
    return (
      <div className="relative">
        <GeographyGameLobby
          gameTitle="سباق ووردل"
          gameCategory="فئة الكلمات • تنافس السرعة بدون وقت"
          icon={<Layers className="w-8 h-8 text-[#C68B59]" />}
          ruleSummary="كلمة سرية من ٥ أحرف بدون عداد وقت! أول من يفك الكلمة الخماسية يفوز بالجولة فوراً (+10 pt) وتنتهي الجولة للجميع. وإذا استنفد جميع المتسابقين محاولاتهم الـ 6 يخسر الجميع. اضغط 'جاهز' لبدء العد التلقائي."
          roomCode={roomId}
          players={players.map(p => ({
            ...p,
            isReady: readyPlayerIds.has(p.id)
          }))}
          onStartGame={handleStartRound}
          onExitGame={handleTerminateGame}
          onKickPlayer={handleKickPlayer}
          canStart={players.length >= 1}
        />

        {/* Auto Start Countdown Overlay if >= 2 players ready */}
        {autoStartCountdown !== null && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-[#F7F4EC] border-4 border-[#2C2A29] shadow-[8px_8px_0px_#2C2A29] rounded-3xl p-10 text-center">
              <span className="text-sm font-black text-[#8A9A5B] block mb-2">اكتملت جاهزية المتسابقين!</span>
              <div className="text-7xl font-black text-[#C68B59] my-4">{autoStartCountdown}</div>
              <p className="text-xs font-bold text-[#5C4033]">تنطلق الجولة تلقائياً...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // RENDER: ACTIVE PLAYING (ANTI-CHEAT TILES ONLY & NO TIMER!)
  if (phase === 'PLAYING') {
    return (
      <div className="min-h-screen bg-[#E5E0D5] text-[#2C2A29] p-4 md:p-8 flex flex-col justify-between selection:bg-[#8A9A5B]">
        {/* Top Header */}
        <div className="flex items-center justify-between bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#C68B59] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-2xl flex items-center justify-center text-white">
              <Layers className="w-8 h-8" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#5C4033]">الجولة {currentRound} • كلمة من ٥ أحرف</span>
              <h2 className="text-2xl font-black text-[#000000]">سباق ووردل اللحظي (أول من يفك الكلمة يفوز!)</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTerminateGame}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] px-3.5 py-2.5 rounded-xl text-xs font-black transition-all"
            >
              <Power className="w-4 h-4" />
              <span>إنهاء اللعبة</span>
            </button>
            <GeoTopNavControls
              roomCode={roomId}
              exitActionType="end_game"
              exitLabel="إنهاء اللعبة"
              onExit={handleTerminateGame}
              showRoomCode={true}
            />
          </div>
        </div>

        {/* Anti-Cheat TV Grid for all players */}
        <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 flex-1 mb-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4 border-b-2 border-[#2C2A29] pb-3">
            <span className="text-xs font-bold text-[#5C4033]">
              * الشاشة تعرض تقدم الألوان فقط بدون الحروف لضمان النزاهة التامة
            </span>
            <h3 className="font-black text-lg text-[#000000]">لوحة تتبع محاولات المتسابقين</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {players.map(p => {
              const progress = playerProgress[p.id];
              const attempts = progress?.attempts || [];
              const isSolved = progress?.isSolved || false;

              return (
                <div
                  key={p.id}
                  className={`bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-2xl p-4 flex flex-col justify-between transition-all ${
                    isSolved ? 'shadow-[4px_4px_0px_#8A9A5B] border-[#8A9A5B]' : 'shadow-[3px_3px_0px_#2C2A29]'
                  }`}
                >
                  {/* Player Header */}
                  <div className="flex items-center justify-between mb-3 border-b border-[#2C2A29]/20 pb-2">
                    <span className={`text-xs font-black px-2 py-0.5 rounded border border-[#2C2A29] ${
                      isSolved ? 'bg-[#8A9A5B] text-white' : 'bg-white text-[#2C2A29]'
                    }`}>
                      {isSolved ? 'فائز! (+10 pt)' : `${attempts.length} / 6` }
                    </span>
                    <span className="font-black text-base text-[#000000]">{p.name}</span>
                  </div>

                  {/* 6 Rows of 5 Color Tiles (NO LETTERS SHOWN ON TV!) */}
                  <div className="flex flex-col gap-1.5 items-center my-auto py-1">
                    {[0, 1, 2, 3, 4, 5].map(rowIdx => {
                      const rowTiles = attempts[rowIdx];
                      return (
                        <div key={rowIdx} className="flex gap-1.5">
                          {[0, 1, 2, 3, 4].map(colIdx => {
                            const status = rowTiles?.[colIdx];
                            let bgClass = 'bg-[#F7F4EC] border-[#2C2A29]/40';
                            if (status === 'correct') {
                              bgClass = 'bg-[#8A9A5B] border-[#2C2A29]'; // Green
                            } else if (status === 'present') {
                              bgClass = 'bg-[#C68B59] border-[#2C2A29]'; // Orange/Yellow
                            } else if (status === 'absent') {
                              bgClass = 'bg-[#2C2A29] border-[#2C2A29]'; // Dark
                            }

                            return (
                              <div
                                key={colIdx}
                                className={`w-6 h-6 rounded-md border-2 transition-colors duration-200 ${bgClass}`}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Legend */}
        <div className="flex items-center justify-between text-xs font-bold text-[#5C4033] px-2">
          <span>* تنتهي الجولة تلقائياً فور فك أول متسابق للكلمة، أو عند استنفاد الجميع لمحاولاتهم.</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-[#8A9A5B] border border-[#2C2A29]"></span> حرف ومكان صحيح</span>
            <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-[#C68B59] border border-[#2C2A29]"></span> حرف موجود بمكان آخر</span>
            <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-[#2C2A29] border border-[#2C2A29]"></span> حرف غير موجود</span>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: ROUND SUMMARY & REVEAL
  return (
    <div className="min-h-screen bg-[#E5E0D5] text-[#2C2A29] p-4 md:p-8 flex flex-col justify-between selection:bg-[#8A9A5B]">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4 mb-6">
        <div>
          <span className="text-xs font-bold text-[#5C4033]">انتهت الجولة {currentRound} • سباق ووردل</span>
          <h2 className="text-2xl font-black text-[#000000]">
            {roundOutcome === 'WINNER' ? `الفائز بالجولة: ${roundWinnerName}!` : 'لم ينجح أحد في تخمين الكلمة'}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleProceedNextRound}
            className="bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] px-6 py-2.5 rounded-xl font-black text-sm hover:bg-[#2C2A29] hover:-translate-y-0.5 active:translate-y-0 transition-all"
          >
            الجولة التالية ◄
          </button>
          <GeoTopNavControls
            roomCode={roomId}
            exitActionType="return_lobby"
            exitLabel="العودة للوبي"
            onReturnToLobby={handleReturnToLobby}
            showRoomCode={false}
          />
          <FullscreenButton />
        </div>
      </div>

      {/* Secret Word Reveal Banner */}
      <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-8 mb-6 text-center">
        <span className="text-xs font-black text-[#5C4033] block mb-2">الكلمة السرية للجولة كانت:</span>
        <div className="flex items-center justify-center gap-3 my-4">
          {Array.from(targetWord).map((letter, idx) => (
            <div
              key={idx}
              className="w-16 h-16 bg-[#8A9A5B] text-white border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl flex items-center justify-center text-3xl font-black"
            >
              {letter}
            </div>
          ))}
        </div>
        {roundOutcome === 'WINNER' ? (
          <div className="text-base font-black text-[#8A9A5B] mt-2">
            مبروك للمتسابق {roundWinnerName} حصد 10 نقاط!
          </div>
        ) : (
          <div className="text-base font-black text-red-600 mt-2 flex items-center justify-center gap-2">
            <XCircle className="w-5 h-5" />
            <span>لم ينجح أحد في تخمين الكلمة السرية في المحاولات الـ 6!</span>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 flex-1 mb-6">
        <h3 className="font-black text-lg text-[#000000] mb-4 text-right border-b-2 border-[#2C2A29] pb-2">
          لوحة الصدارة التراكمية
        </h3>
        <div className="max-w-2xl mx-auto space-y-3">
          {rankedPlayers.map((p, rankIdx) => {
            const totalPts = cumulativeScores[p.id] || 0;

            return (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border-2 border-[#2C2A29] flex items-center justify-between ${
                  rankIdx === 0
                    ? 'bg-[#C68B59]/20 shadow-[4px_4px_0px_#2C2A29]'
                    : 'bg-[#E5E0D5] shadow-[2px_2px_0px_#2C2A29]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-black text-xl text-[#000000]">{totalPts} pt</span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-black text-lg text-[#000000]">{p.name}</span>
                  <div className={`w-10 h-10 rounded-xl border-2 border-[#2C2A29] flex items-center justify-center font-black text-base ${
                    rankIdx === 0 ? 'bg-[#C68B59] text-white' : 'bg-white text-[#2C2A29]'
                  }`}>
                    #{rankIdx + 1}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleTerminateGame}
          className="flex items-center gap-2 text-xs font-bold text-red-600 hover:text-red-800"
        >
          <LogOut className="w-4 h-4" />
          <span>إنهاء اللعبة للجميع</span>
        </button>
        <span className="text-xs font-bold text-[#5C4033]">
          لعبة المجلس تبدأ هنا • طق عصي
        </span>
      </div>
    </div>
  );
};
