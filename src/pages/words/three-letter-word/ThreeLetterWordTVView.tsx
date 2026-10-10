import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Play, ArrowRight, UserCheck, Clock, Award, Layers, AlertCircle, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ThreeLetterTopBar } from './components/ThreeLetterTopBar';
import { ThreeLetterBoardSlot } from './components/ThreeLetterBoardSlot';
import {
  ThreeLetterPhase,
  ThreeLetterCardItem,
  BoardSlotState,
  ThreeLetterPlayer,
  TurnEventNotification
} from './types';
import {
  generateInitialBoard,
  validateWordPlacement
} from './utils/threeLetterDictionary';
import { sound } from '../../../lib/audio';

export const ThreeLetterWordTVView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // State
  const [phase, setPhase] = useState<ThreeLetterPhase>('LOBBY');
  const [players, setPlayers] = useState<ThreeLetterPlayer[]>([]);
  const [board, setBoard] = useState<[BoardSlotState, BoardSlotState, BoardSlotState]>(() => generateInitialBoard());
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);
  const [turnNumber, setTurnNumber] = useState<number>(1);
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(7); // 7s for turn 1, 5s afterwards
  const [maxTurnTime, setMaxTurnTime] = useState<number>(7);
  const [lastNotification, setLastNotification] = useState<TurnEventNotification | null>(null);
  const [winner, setWinner] = useState<ThreeLetterPlayer | null>(null);

  // Lobby start countdown
  const [lobbyStartCountdown, setLobbyStartCountdown] = useState<number | null>(null);

  // Refs singleton
  const channelRef = useRef<RealtimeChannel | null>(null);
  const boardRef = useRef(board);
  const playersRef = useRef(players);
  const activeIndexRef = useRef(activePlayerIndex);
  const turnNumberRef = useRef(turnNumber);

  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { activeIndexRef.current = activePlayerIndex; }, [activePlayerIndex]);
  useEffect(() => { turnNumberRef.current = turnNumber; }, [turnNumber]);

  // Broadcast Full State Helper
  const broadcastSync = useCallback((
    targetPhase: ThreeLetterPhase,
    targetBoard: [BoardSlotState, BoardSlotState, BoardSlotState],
    targetPlayers: ThreeLetterPlayer[],
    targetActiveIndex: number,
    targetTurnNumber: number,
    notification?: TurnEventNotification | null
  ) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'THREE_LETTER_STATE_SYNC',
      payload: {
        phase: targetPhase,
        board: targetBoard,
        players: targetPlayers,
        activePlayerId: targetPlayers[targetActiveIndex]?.id || null,
        activePlayerIndex: targetActiveIndex,
        turnNumber: targetTurnNumber,
        notification: notification || null
      }
    });
  }, []);

  // 1. Setup Supabase Realtime Channel
  useEffect(() => {
    const normalizedCode = roomCode.trim().toUpperCase();
    if (!normalizedCode) return;

    const channel = supabase.channel(`three_letter:${normalizedCode}`, {
      config: { broadcast: { self: true }, presence: { key: 'tv_screen' } }
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const active: ThreeLetterPlayer[] = [];
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          presences.forEach((p) => {
            if (p.playerId && p.playerName) {
              active.push({
                id: p.playerId,
                name: p.playerName,
                cardsCount: p.cardsCount ?? 8,
                isReady: !!p.isReady
              });
            }
          });
        });

        // Deduplicate
        const uniqueMap = new Map<string, ThreeLetterPlayer>();
        active.forEach((p) => {
          const existing = playersRef.current.find((pl) => pl.id === p.id);
          uniqueMap.set(p.id, {
            ...p,
            cardsCount: existing ? existing.cardsCount : 8
          });
        });
        const updatedList = Array.from(uniqueMap.values());
        setPlayers(updatedList);
      })
      .on('broadcast', { event: 'PLAYER_READY_TOGGLE' }, ({ payload }) => {
        const { playerId, isReady } = payload;
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, isReady } : p))
        );
      })
      .on('broadcast', { event: 'PLAY_CARD_ATTEMPT' }, ({ payload }) => {
        handlePlayerAttempt(payload);
      })
      .on('broadcast', { event: 'DRAW_PASS_TURN' }, ({ payload }) => {
        handlePlayerPass(payload?.playerId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode]);

  // Handle Player's Single Attempt Move
  const handlePlayerAttempt = (payload: { playerId: string; slotIndex: 0 | 1 | 2; card: ThreeLetterCardItem }) => {
    const { playerId, slotIndex, card } = payload;
    const currentActive = playersRef.current[activeIndexRef.current];

    if (!currentActive || currentActive.id !== playerId) return;

    const validation = validateWordPlacement(boardRef.current, slotIndex, card.letter);

    if (validation.isValid) {
      // Valid Word Played!
      sound.playCorrect();

      const oldSlot = boardRef.current[slotIndex];
      const newSlot: BoardSlotState = {
        positionIndex: slotIndex,
        topCard: card,
        stackHistory: [...oldSlot.stackHistory, oldSlot.topCard]
      };

      const newBoard: [BoardSlotState, BoardSlotState, BoardSlotState] = [...boardRef.current] as [BoardSlotState, BoardSlotState, BoardSlotState];
      newBoard[slotIndex] = newSlot;
      setBoard(newBoard);

      // Decrement card count
      const updatedPlayers = playersRef.current.map((p) => {
        if (p.id === playerId) {
          return { ...p, cardsCount: Math.max(0, p.cardsCount - 1) };
        }
        return p;
      });

      const playerAfterMove = updatedPlayers.find((p) => p.id === playerId);

      const notif: TurnEventNotification = {
        playerId,
        playerName: currentActive.name,
        prevLetter: oldSlot.topCard.letter,
        newLetter: card.letter,
        resultingWord: validation.resultingWord,
        type: 'VALID_MOVE',
        timestamp: Date.now()
      };
      setLastNotification(notif);

      // Sudden Death Victory Check: 0 cards
      if (playerAfterMove && playerAfterMove.cardsCount === 0) {
        sound.playVictory();
        setWinner(playerAfterMove);
        setPhase('ROUND_WIN');
        setPlayers(updatedPlayers);
        broadcastSync('ROUND_WIN', newBoard, updatedPlayers, activeIndexRef.current, turnNumberRef.current, notif);
        return;
      }

      // Next Player Turn
      const nextTurnNum = turnNumberRef.current + 1;
      const nextIndex = (activeIndexRef.current + 1) % updatedPlayers.length;
      setTurnNumber(nextTurnNum);
      setActivePlayerIndex(nextIndex);
      setPlayers(updatedPlayers);
      const nextTime = 5; // strictly 5s for subsequent turns
      setMaxTurnTime(nextTime);
      setTurnTimeLeft(nextTime);

      broadcastSync('GAMEPLAY', newBoard, updatedPlayers, nextIndex, nextTurnNum, notif);
    } else {
      // Invalid Word / Banned Form Played -> Penalty + Turn Ends Immediately
      sound.playIncorrect();

      // Add 1 penalty card
      const updatedPlayers = playersRef.current.map((p) => {
        if (p.id === playerId) {
          return { ...p, cardsCount: p.cardsCount + 1 };
        }
        return p;
      });

      const notif: TurnEventNotification = {
        playerId,
        playerName: currentActive.name,
        newLetter: card.letter,
        resultingWord: validation.resultingWord,
        type: 'INVALID_PENALTY',
        timestamp: Date.now()
      };
      setLastNotification(notif);

      // Advance turn immediately
      const nextTurnNum = turnNumberRef.current + 1;
      const nextIndex = (activeIndexRef.current + 1) % updatedPlayers.length;
      setTurnNumber(nextTurnNum);
      setActivePlayerIndex(nextIndex);
      setPlayers(updatedPlayers);
      const nextTime = 5;
      setMaxTurnTime(nextTime);
      setTurnTimeLeft(nextTime);

      broadcastSync('GAMEPLAY', boardRef.current, updatedPlayers, nextIndex, nextTurnNum, notif);
    }
  };

  // Handle Player Pass / Draw
  const handlePlayerPass = (playerId: string) => {
    const currentActive = playersRef.current[activeIndexRef.current];
    if (!currentActive || currentActive.id !== playerId) return;

    sound.playClick();

    // Add 1 card to player
    const updatedPlayers = playersRef.current.map((p) => {
      if (p.id === playerId) {
        return { ...p, cardsCount: p.cardsCount + 1 };
      }
      return p;
    });

    const notif: TurnEventNotification = {
      playerId,
      playerName: currentActive.name,
      type: 'DRAW_PASS',
      timestamp: Date.now()
    };
    setLastNotification(notif);

    const nextTurnNum = turnNumberRef.current + 1;
    const nextIndex = (activeIndexRef.current + 1) % updatedPlayers.length;
    setTurnNumber(nextTurnNum);
    setActivePlayerIndex(nextIndex);
    setPlayers(updatedPlayers);
    const nextTime = 5;
    setMaxTurnTime(nextTime);
    setTurnTimeLeft(nextTime);

    broadcastSync('GAMEPLAY', boardRef.current, updatedPlayers, nextIndex, nextTurnNum, notif);
  };

  // Handle Timeout (Auto-draw and pass)
  const handleTurnTimeout = useCallback(() => {
    if (phase !== 'GAMEPLAY') return;
    const currentActive = playersRef.current[activeIndexRef.current];
    if (!currentActive) return;

    sound.playTimeout();

    const updatedPlayers = playersRef.current.map((p, idx) => {
      if (idx === activeIndexRef.current) {
        return { ...p, cardsCount: p.cardsCount + 1 };
      }
      return p;
    });

    const notif: TurnEventNotification = {
      playerId: currentActive.id,
      playerName: currentActive.name,
      type: 'TIMEOUT',
      timestamp: Date.now()
    };
    setLastNotification(notif);

    const nextTurnNum = turnNumberRef.current + 1;
    const nextIndex = (activeIndexRef.current + 1) % updatedPlayers.length;
    setTurnNumber(nextTurnNum);
    setActivePlayerIndex(nextIndex);
    setPlayers(updatedPlayers);
    const nextTime = 5;
    setMaxTurnTime(nextTime);
    setTurnTimeLeft(nextTime);

    broadcastSync('GAMEPLAY', boardRef.current, updatedPlayers, nextIndex, nextTurnNum, notif);
  }, [phase, broadcastSync]);

  // Turn Timer Interval (strictly 7s on turn 1, 5s on subsequent turns)
  useEffect(() => {
    if (phase !== 'GAMEPLAY') return;

    const interval = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) {
          handleTurnTimeout();
          return 5;
        }
        if (prev <= 3) {
          sound.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, activePlayerIndex, turnNumber, handleTurnTimeout]);

  // Lobby Auto-Start Countdown (>= 2 ready players)
  const readyCount = useMemo(() => players.filter((p) => p.isReady).length, [players]);

  useEffect(() => {
    if (phase !== 'LOBBY') {
      setLobbyStartCountdown(null);
      return;
    }

    if (readyCount >= 2 && readyCount === players.length && players.length >= 2) {
      if (lobbyStartCountdown === null) setLobbyStartCountdown(3);
    } else {
      setLobbyStartCountdown(null);
    }
  }, [readyCount, players.length, phase, lobbyStartCountdown]);

  useEffect(() => {
    if (lobbyStartCountdown === null || lobbyStartCountdown <= 0) return;
    sound.playTick();
    const timer = setTimeout(() => {
      if (lobbyStartCountdown === 1) {
        startGame();
      } else {
        setLobbyStartCountdown(lobbyStartCountdown - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [lobbyStartCountdown]);

  // Start Game
  const startGame = () => {
    sound.playRoundStart();
    const initialBoard = generateInitialBoard();
    const initialPlayers = players.map((p) => ({ ...p, cardsCount: 8 }));
    setBoard(initialBoard);
    setPlayers(initialPlayers);
    setPhase('GAMEPLAY');
    setActivePlayerIndex(0);
    setTurnNumber(1);
    setMaxTurnTime(7); // 7s on turn 1
    setTurnTimeLeft(7);
    setWinner(null);
    setLastNotification(null);

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'GAME_STARTED',
        payload: {
          board: initialBoard,
          players: initialPlayers,
          activePlayerId: initialPlayers[0]?.id || null,
          activePlayerIndex: 0,
          turnNumber: 1
        }
      });
    }
  };

  // Kick Player in Lobby
  const handleKickPlayer = (playerId: string) => {
    sound.playKick();
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'KICK_PLAYER',
        payload: { playerId }
      });
    }
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
  };

  // Terminate Game
  const handleTerminateGame = () => {
    sound.playClick();
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'GAME_TERMINATED',
        payload: {}
      });
    }
    setPhase('LOBBY');
  };

  const activePlayer = players[activePlayerIndex];
  const timerPercentage = (turnTimeLeft / maxTurnTime) * 100;

  return (
    <div className="min-h-screen bg-[#E5E0D5] flex flex-col font-sans select-none overflow-hidden relative" dir="rtl">
      {/* Background static dot texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40 z-0"
        style={{
          backgroundImage: 'radial-gradient(#2C2A29 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* Top Bar (No red buttons, Ochre only) */}
      <div className="relative z-20">
        <ThreeLetterTopBar
          roomCode={roomCode}
          phase={phase}
          onTerminate={handleTerminateGame}
        />
      </div>

      <main className="flex-1 flex flex-col items-center justify-between p-4 md:p-6 relative z-10 max-w-7xl mx-auto w-full">
        {/* ================= 1. LOBBY PHASE ================= */}
        {phase === 'LOBBY' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center gap-6 my-auto">
            {/* Header Banner */}
            <div className="text-center">
              <span className="text-xs md:text-sm font-black text-[#5C4033] bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1 rounded-xl shadow-[2px_2px_0px_#2C2A29] inline-block mb-2">
                لعبة كروت وتكديس سريعة
              </span>
              <h2 className="text-3xl md:text-5xl font-black text-[#2C2A29] tracking-tight">
                كلمة ثلاثية
              </h2>
            </div>

            {/* Split Grid: QR Code + Players List + Rules */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
              {/* Box 1: QR Code & Room Code */}
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-black text-[#5C4033] mb-3">امسح الكود أو ادخل الرمز للمشاركة</span>
                <div className="bg-white p-3 rounded-xl border-2 border-[#2C2A29] shadow-sm mb-3">
                  <QRCodeSVG
                    value={`${window.location.origin}/room/${roomCode}/join`}
                    size={140}
                    level="M"
                  />
                </div>
                <div className="text-2xl font-black font-mono tracking-widest text-[#2C2A29] bg-[#E5E0D5] px-4 py-1 rounded-xl border border-[#2C2A29]">
                  {roomCode}
                </div>
              </div>

              {/* Box 2: Players Ring / Ready Status */}
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-black text-[#2C2A29]">اللاعبون المتصلون</span>
                    <span className="text-xs font-black bg-[#8A9A5B] text-white px-2.5 py-0.5 rounded-lg border border-[#2C2A29]">
                      {players.length} لاعبين
                    </span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {players.length === 0 ? (
                      <div className="text-xs text-[#5C4033] text-center py-8 font-bold">
                        بانتظار انضمام اللاعبين عبر الجوال...
                      </div>
                    ) : (
                      players.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2.5 rounded-xl border-2 border-[#2C2A29] bg-[#E5E0D5] text-xs font-black"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">👤</span>
                            <span className="text-[#2C2A29]">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                                p.isReady
                                  ? 'bg-[#8A9A5B] text-white border-[#2C2A29]'
                                  : 'bg-[#F7F4EC] text-[#5C4033] border-[#2C2A29]'
                              }`}
                            >
                              {p.isReady ? 'جاهز ✓' : 'ينتظر'}
                            </span>
                            <button
                              onClick={() => handleKickPlayer(p.id)}
                              className="text-xs text-[#C68B59] hover:text-[#2C2A29] font-black px-1"
                              title="استبعاد اللاعب"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Auto-Start Banner / Manual Start Button */}
                <div className="mt-4 pt-3 border-t border-[#2C2A29]/15">
                  {lobbyStartCountdown !== null ? (
                    <div className="w-full bg-[#8A9A5B] text-white font-black text-center py-3 rounded-xl border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29]">
                      يبدأ اللعب خلال {lobbyStartCountdown} ثوانٍ...
                    </div>
                  ) : (
                    <button
                      disabled={players.length < 2}
                      onClick={startGame}
                      className={`w-full py-3 rounded-xl font-black text-sm border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        players.length >= 2
                          ? 'bg-[#8A9A5B] text-white hover:bg-[#2C2A29]'
                          : 'bg-[#E5E0D5] text-[#2C2A29]/40 border-[#2C2A29]/40 shadow-none cursor-not-allowed'
                      }`}
                    >
                      <Play size={16} />
                      <span>بدء المباراة ({players.length >= 2 ? 'جاهز' : 'يلزم لاعبان فأكثر'})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Box 3: Game Rules Guide */}
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-5 flex flex-col text-right">
                <span className="text-sm font-black text-[#2C2A29] mb-3">طريقة لعب كلمة ثلاثية:</span>
                <ul className="space-y-2 text-xs font-bold text-[#5C4033] leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-[#8A9A5B] font-black">1.</span>
                    <span>كلمة ثلاثية بالساحة ومع كل لاعب 8 كروت ملونة.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#8A9A5B] font-black">2.</span>
                    <span>في دورك، معك 5 ثوانٍ تسحب حرف من يدك وتنزله فوق أي كرت بالساحة.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#8A9A5B] font-black">3.</span>
                    <span>لك محاولة واحدة فقط؛ إذا الكلمة خطأ ينتهي دورك وتسحب كرت عقوبة!</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#8A9A5B] font-black">4.</span>
                    <span>الكلمات المقبولة: أسماء وأفعال فقط (ممنوع الحروف وأدوات الاستفهام).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#8A9A5B] font-black">5.</span>
                    <span>أول لاعب يخلّص كروته الثمانية يفوز باللعبة فوراً وبدون نقاط.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ================= 2. GAMEPLAY PHASE ================= */}
        {phase === 'GAMEPLAY' && (
          <div className="w-full flex-1 flex flex-col justify-between items-center gap-6 my-auto">
            {/* Top Center Lightning Timer & Active Turn Header */}
            <div className="w-full max-w-xl flex flex-col items-center gap-2">
              <div className="w-full flex justify-between items-center px-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#5C4033]">الدور عند:</span>
                  <span className="text-sm md:text-base font-black text-white bg-[#8A9A5B] border-2 border-[#2C2A29] px-3.5 py-1 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                    {activePlayer?.name || 'اللاعب'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Clock size={16} className={turnTimeLeft <= 2 ? 'text-[#C86D51]' : 'text-[#5C4033]'} />
                  <span className={`text-xl font-black font-mono ${turnTimeLeft <= 2 ? 'text-[#C86D51]' : 'text-[#2C2A29]'}`}>
                    0:{turnTimeLeft < 10 ? `0${turnTimeLeft}` : turnTimeLeft}
                  </span>
                </div>
              </div>

              {/* Draining Timer Progress Bar */}
              <div className="w-full h-3 bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-full overflow-hidden shadow-[2px_2px_0px_#2C2A29]">
                <div
                  className={`h-full transition-all duration-1000 ease-linear ${
                    turnTimeLeft <= 2 ? 'bg-[#C86D51]' : 'bg-[#8A9A5B]'
                  }`}
                  style={{ width: `${Math.max(0, timerPercentage)}%` }}
                />
              </div>
            </div>

            {/* Notification Toast (Move result or penalty) */}
            {lastNotification && (
              <div
                className={`text-xs md:text-sm font-black px-4 py-2 rounded-xl border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] ${
                  lastNotification.type === 'VALID_MOVE'
                    ? 'bg-[#8A9A5B] text-white'
                    : lastNotification.type === 'INVALID_PENALTY'
                    ? 'bg-[#C86D51] text-white'
                    : 'bg-[#C68B59] text-white'
                }`}
              >
                {lastNotification.type === 'VALID_MOVE' && (
                  <span>✓ {lastNotification.playerName} بدّل حرف ({lastNotification.prevLetter} ← {lastNotification.newLetter}) وكوّن كلمة ({lastNotification.resultingWord})</span>
                )}
                {lastNotification.type === 'INVALID_PENALTY' && (
                  <span>✗ {lastNotification.playerName} حاول بكلمة ({lastNotification.resultingWord}) غير مقبولة وتسحب كرت عقوبة!</span>
                )}
                {lastNotification.type === 'DRAW_PASS' && (
                  <span>↻ {lastNotification.playerName} سحب كرتاً وتخطى دوره</span>
                )}
                {lastNotification.type === 'TIMEOUT' && (
                  <span>⌛ انتهى وقت {lastNotification.playerName} وسحب كرت عقوبة</span>
                )}
              </div>
            )}

            {/* Centered Clean Arena (STRICTLY the 3 physical stacked cards - Zero redundant text labels) */}
            <div className="flex justify-center items-center gap-6 md:gap-12 py-4">
              {board.map((slot, idx) => (
                <div key={idx} className="transition-transform duration-200">
                  <ThreeLetterBoardSlot
                    slot={slot}
                    size="xl"
                  />
                </div>
              ))}
            </div>

            {/* Bottom Players Arena Ring */}
            <div className="w-full bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-4 shadow-[4px_4px_0px_#2C2A29] max-w-5xl">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-black text-[#5C4033]">اللاعبون والكروت المتبقية:</span>
                <span className="text-[10px] font-bold text-[#8A9A5B] bg-[#E5E0D5] px-2 py-0.5 rounded-lg border border-[#2C2A29]">
                  أول من يصل إلى 0 يفوز
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {players.map((p, idx) => {
                  const isActive = idx === activePlayerIndex;
                  return (
                    <div
                      key={p.id}
                      className={`flex flex-col items-center p-2.5 rounded-xl border-2 border-[#2C2A29] transition-all ${
                        isActive
                          ? 'bg-[#8A9A5B] text-white shadow-[3px_3px_0px_#2C2A29] scale-105'
                          : 'bg-[#E5E0D5] text-[#2C2A29]'
                      }`}
                    >
                      <span className="font-black text-xs md:text-sm truncate w-full text-center">
                        {p.name}
                      </span>
                      <span
                        className={`text-xs font-bold mt-1 px-2 py-0.5 rounded-md border ${
                          isActive
                            ? 'bg-white text-[#2C2A29] border-[#2C2A29]'
                            : 'bg-[#F7F4EC] text-[#5C4033] border-[#2C2A29]'
                        }`}
                      >
                        {p.cardsCount} {p.cardsCount === 1 ? 'كرت' : 'كروت'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= 3. ROUND WIN / PODIUM PHASE ================= */}
        {(phase === 'ROUND_WIN' || phase === 'PODIUM') && (
          <div className="w-full flex-1 flex flex-col items-center justify-center text-center gap-6 my-auto max-w-xl">
            <div className="w-24 h-24 rounded-3xl bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] flex items-center justify-center text-white text-5xl">
              🏆
            </div>

            <div>
              <span className="text-xs font-black text-[#5C4033] bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                نهاية المباراة
              </span>
              <h2 className="text-3xl md:text-5xl font-black text-[#2C2A29] mt-3">
                {winner?.name} بطل الكلمة الثلاثية!
              </h2>
              <p className="text-sm md:text-base font-bold text-[#8A9A5B] mt-2">
                تخلّص من جميع كروته بنجاح وأنهى المباراة!
              </p>
            </div>

            {/* Final Standings (Ordered by remaining cards - No points!) */}
            <div className="w-full bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-5 shadow-[4px_4px_0px_#2C2A29]">
              <span className="text-xs font-black text-[#5C4033] block mb-3 text-right">الترتيب النهائي للكروت:</span>
              <div className="space-y-2">
                {players
                  .slice()
                  .sort((a, b) => a.cardsCount - b.cardsCount)
                  .map((p, idx) => (
                    <div
                      key={p.id}
                      className={`flex justify-between items-center p-3 rounded-xl border-2 border-[#2C2A29] ${
                        p.cardsCount === 0
                          ? 'bg-[#8A9A5B] text-white shadow-[2px_2px_0px_#2C2A29]'
                          : 'bg-[#E5E0D5] text-[#2C2A29]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-sm">#{idx + 1}</span>
                        <span className="font-black text-sm md:text-base">{p.name}</span>
                      </div>
                      <span className="text-xs md:text-sm font-bold">
                        {p.cardsCount === 0 ? 'الفائز باللقب' : `${p.cardsCount} كروت متبقية`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <button
              onClick={handleTerminateGame}
              className="w-full bg-[#C68B59] text-white py-4 rounded-2xl font-black text-lg border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] hover:bg-[#2C2A29] transition-all cursor-pointer"
            >
              العودة للوبي الرئيسي
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
