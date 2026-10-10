import { FullscreenButton } from '../../components/common/FullscreenButton';
import { GeoTopNavControls } from '../../components/common/GeoTopNavControls';
import { GeographyGameLobby } from '../../components/common/GeographyGameLobby';
import { CopyCodeButton } from '../../components/common/CopyCodeButton';
import { LobbyRuleBox } from '../../components/common/LobbyRuleBox';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Sliders,
  Trophy,
  RotateCcw,
  Check,
  Clock,
  Users,
  Sparkles,
  HelpCircle,
  Award,
  Crown,
  LogOut,
  ArrowRight
} from 'lucide-react';
import { useRoom, roomBus, cleanRoomCode } from '../../lib/roomBus';
import { FlagComponents, flagsDataset } from '../../data/flags';
import { calculateColorCloseness } from '../../lib/colorMath';
import { QRCodeView } from '../../components/common/QRCodeView';
import { sound } from '../../lib/audio';

// Rolling percentage counter component
const RollingPercentage: React.FC<{ target: number; active: boolean }> = ({ target, active }) => {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!active) {
      setVal(0);
      return;
    }
    let current = 0;
    const step = Math.max(1, Math.floor(target / 18));
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      setVal(current);
      sound.playTick();
    }, 45);

    return () => clearInterval(timer);
  }, [active, target]);

  return <span className="font-mono font-black">{val}٪</span>;
};

export const FlagTVView: React.FC = () => {
  const params = useParams();
  const roomCode = (params.code || params.roomId || params.id || '').trim().toUpperCase() || 'TAQ1';
  const roomId = roomCode;

  useEffect(() => {
    console.log(`[DEBUG Mount] Room: "${roomCode}" | Component: "FlagTVView" | Path: "${window.location.pathname}"`);
    if (!roomCode) {
      console.error('[RoomCode Error]: roomCode is empty or undefined on mount!');
    }
  }, [roomCode]);
  const navigate = useNavigate();
  const { room } = useRoom(roomId);

  // Reveal step tracker:
  // -1: Reveal original flag
  // 0 .. N-1: Reveal each player one by one
  // N: All players revealed -> winner highlighted -> celebration pause (3s) -> advance to ROUND_INTERMISSION
  const [revealStep, setRevealStep] = useState<number>(-1);
  const [showWinnerHighlight, setShowWinnerHighlight] = useState(false);

  

  const flagState = room?.flagState;
  const playersList = useMemo(() => {
    if (!flagState?.players) return [];
    const map = new Map<string, any>();
    Object.values(flagState.players).forEach((p: any) => {
      if (!p || !p.name || p.id === 'host_tv') return;
      const key = p.name.trim().toLowerCase();
      if (map.has(key)) {
        const prev = map.get(key);
        map.set(key, { ...prev, ...p, isReady: Boolean(prev.isReady || p.isReady) });
      } else {
        map.set(key, p);
      }
    });
    return Array.from(map.values());
  }, [flagState?.players]);

  // Current flag dataset item with null safety
  const currentFlagData = useMemo(() => {
    if (!flagState?.currentFlagId) return flagsDataset[0];
    const found = flagsDataset.find((f) => f.id === flagState.currentFlagId);
    return found || flagsDataset[0];
  }, [flagState?.currentFlagId]);

  const FlagComponent = useMemo(() => {
    if (!currentFlagData || !FlagComponents[currentFlagData.id]) {
      return FlagComponents['sa'] || FlagComponents['qatar'] || (() => null);
    }
    return FlagComponents[currentFlagData.id];
  }, [currentFlagData]);

  // Single Source of Truth (SSOT) Refs & Readiness tracking on TV
  const activePlayersRef = useRef(playersList);
  const currentRoundRef = useRef(flagState?.currentRound || 1);
  const readyPlayerIdsRef = useRef<Set<string>>(new Set());
  const isTransitioningRef = useRef(false);

  const [readyPlayerIds, setReadyPlayerIds] = useState<Set<string>>(new Set());

  // Keep refs updated synchronously on every render
  activePlayersRef.current = playersList;
  currentRoundRef.current = flagState?.currentRound || 1;
  readyPlayerIdsRef.current = readyPlayerIds;

  // Register TV screen as the authoritative host for this room
  useEffect(() => {
    const unregister = roomBus.registerHost(roomId);
    return () => unregister();
  }, [roomId]);

  // Reset ready set when game state or round changes
  useEffect(() => {
    if (flagState?.gameState === 'ROUND_INTERMISSION') {
      isTransitioningRef.current = false;
      const initial = new Set<string>();
      if (flagState.roundReadyPlayers) {
        Object.keys(flagState.roundReadyPlayers).forEach((k) => {
          if (flagState.roundReadyPlayers[k]) initial.add(k);
        });
      }
      setReadyPlayerIds(initial);
      readyPlayerIdsRef.current = initial;
    } else {
      isTransitioningRef.current = false;
      setReadyPlayerIds(new Set());
      readyPlayerIdsRef.current = new Set();
    }
  }, [flagState?.gameState, flagState?.currentRound]);

  // Listen for authoritative PLAYER_ROUND_READY events
  useEffect(() => {
    const unsub = roomBus.on('PLAYER_ROUND_READY', (payload) => {
      const cleanCode = roomId.toUpperCase().replace(/^ROOM_/, '');
      if (payload.roomCode !== cleanCode) return;

      const { playerId } = payload.data || {};
      if (!playerId) return;

      setReadyPlayerIds((prev) => {
        const next = new Set(prev);
        next.add(playerId);
        readyPlayerIdsRef.current = next;

        const totalConnected = activePlayersRef.current.length;
        if (
          !isTransitioningRef.current &&
          totalConnected > 0 &&
          next.size >= totalConnected &&
          flagState?.gameState === 'ROUND_INTERMISSION'
        ) {
          isTransitioningRef.current = true;
          const nextRound = currentRoundRef.current + 1;
          setTimeout(() => {
            roomBus.tvStartNextRound(roomId, nextRound);
            setReadyPlayerIds(new Set());
            readyPlayerIdsRef.current = new Set();
          }, 350);
        }

        return next;
      });
    });

    return () => unsub();
  }, [roomId, flagState?.gameState]);

  // Listen for real-time player color guess submissions on TV
  useEffect(() => {
    const unsub = roomBus.on('PLAYER_SUBMISSION', (payload) => {
      const cleanCode = roomId.toUpperCase().replace(/^ROOM_/, '');
      const incoming = (payload.roomCode || '').toUpperCase().replace(/^ROOM_/, '');
      if (incoming === cleanCode) {
        const data = payload.data || payload;
        const hex = typeof data?.answer === 'string' ? data.answer : (data?.answer?.hex || data?.hex);
        const pid = data?.playerId;
        if (hex && pid) {
          const score = calculateColorCloseness(hex, currentFlagData.targetHex);
          roomBus.submitFlagGuess(roomId, pid, hex, score);
        }
      }
    });
    return () => unsub();
  }, [roomId, currentFlagData.targetHex]);

  // Also monitor flagState.roundReadyPlayers for synced room updates
  useEffect(() => {
    if (flagState?.gameState !== 'ROUND_INTERMISSION' || isTransitioningRef.current) return;

    const readyMap = flagState?.roundReadyPlayers || {};
    const readyIds = Object.keys(readyMap).filter((k) => readyMap[k]);
    if (readyIds.length === 0) return;

    setReadyPlayerIds((prev) => {
      let hasNew = false;
      const next = new Set(prev);
      readyIds.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          hasNew = true;
        }
      });
      if (!hasNew) return prev;

      readyPlayerIdsRef.current = next;
      const totalConnected = activePlayersRef.current.length;
      if (
        !isTransitioningRef.current &&
        totalConnected > 0 &&
        next.size >= totalConnected
      ) {
        isTransitioningRef.current = true;
        const nextRound = currentRoundRef.current + 1;
        setTimeout(() => {
          roomBus.tvStartNextRound(roomId, nextRound);
          setReadyPlayerIds(new Set());
          readyPlayerIdsRef.current = new Set();
        }, 350);
      }
      return next;
    });
  }, [flagState?.roundReadyPlayers, flagState?.gameState, roomId]);

  // Highest accuracy for current round
  const highestAccuracy = useMemo(() => {
    if (!playersList.length) return 0;
    return Math.max(...playersList.map((p) => p.currentAccuracy ?? 0));
  }, [playersList]);

  // Game reveal sequencer
  useEffect(() => {
    if (flagState?.gameState === 'REVEALING') {
      setShowWinnerHighlight(false);
      setRevealStep(-1);

      const totalPlayers = playersList.length;
      let currentStep = -1;

      // 1.5 seconds per step
      const stepInterval = setInterval(() => {
        currentStep++;
        setRevealStep(currentStep);

        if (currentStep >= totalPlayers) {
          clearInterval(stepInterval);
          // Highlight winner(s)
          setShowWinnerHighlight(true);
          sound.playBuzzer();

          // Celebration pause for exactly 3 seconds, then advance to ROUND_INTERMISSION (or GAME_OVER after round 5)
          const pauseTimer = setTimeout(() => {
            roomBus.advanceFlagRound(roomId);
          }, 3000);

          return () => clearTimeout(pauseTimer);
        }
      }, 1500);

      return () => clearInterval(stepInterval);
    } else {
      setRevealStep(-1);
      setShowWinnerHighlight(false);
    }
  }, [flagState?.gameState, playersList.length, roomId]);

  if (!room || !flagState) {
    return (
      <div className="min-h-screen bg-[#E5E0D5] flex items-center justify-center font-display text-2xl font-bold text-[#24221E]">
        جاري تحميل اللعبة...
      </div>
    );
  }

  // End Game Session handler
  const handleEndGame = () => {
    if (window.confirm('هل أنت متأكد من إنهاء اللعبة لجميع الأجهزة والعودة للرئيسية؟')) {
      roomBus.endGame(roomId);
      navigate('/');
    }
  };

  const handleKickPlayer = async (targetPlayerId: string, playerName: string) => {
    const confirmKick = window.confirm(`هل أنت متأكد من طرد اللاعب "${playerName}"؟`);
    if (!confirmKick) return;

    roomBus.kickPlayer(roomId, targetPlayerId);

    const clean = cleanRoomCode(roomId);
    const channel = roomBus.getSupabaseChannel(roomId);
    if (channel && channel.send) {
      try {
        await channel.send({
          type: 'broadcast',
          event: 'PLAYER_KICKED',
          payload: { playerId: targetPlayerId }
        });
      } catch (e) {
        console.warn('kick broadcast error:', e);
      }
    }
  };

  const handleStartGame = () => {
    sound.playClick();
    if (playersList.length === 1) {
      roomBus.addMockPlayer(roomId);
    }
    setTimeout(() => {
      roomBus.tvStartNextRound(roomId, 1);
    }, 100);
  };

  // --- Universal Header for TV Screens with "إنهاء اللعبة" Button ---
    const renderTVHeader = (badgeText: string, titleText: string) => (
    <header className="flex items-center justify-between border-b-2 border-[#2C2A29]/20 pb-4 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[#C68B59] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] duration-150 ease-out hover:-translate-y-1 flex items-center justify-center text-white">
          <Sliders className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black font-display text-[#000000]">{titleText}</h1>
          <p className="text-sm font-semibold text-[#5C4033]">{badgeText}</p>
        </div>
      </div>

      {/* Strictly HIDE room code during active gameplay on TV screen */}
      <GeoTopNavControls
        roomCode={room.code}
        showRoomCode={false}
        showFullscreen={true}
        exitActionType="return_lobby"
        exitLabel="العودة للوبي"
        onReturnToLobby={() => roomBus.resetFlagToLobby(room.code)}
      />
    </header>
  );

  // --- 1. LOBBY VIEW (Standardized GeographyGameLobby) ---
  if (flagState.gameState === 'LOBBY') {
    return (
      <GeographyGameLobby
        gameTitle="لون العلم"
        gameCategory="فئة الجغرافيا • ٥ جولات"
        icon={<Sliders className="w-7 h-7 text-white" />}
        ruleSummary="اختر درجات الألوان المناسبة لمساحات العلم بدقة عبر أشرطة التمرير. الفائز هو صاحب أعلى نسبة مطابقة للألوان الأصلية!"
        roomCode={room.code}
        players={playersList}
        onStartGame={handleStartGame}
        onExitGame={handleEndGame}
        onKickPlayer={handleKickPlayer}
        canStart={playersList.length >= 1}
      />
    );
  }

  // --- 2. GUESSING PHASE (25s TIMER) ---
  if (flagState.gameState === 'PLAYING') {
    const answeredCount = playersList.filter((p) => p.currentGuessHex !== null).length;

    return (
      <div className="h-screen w-screen h-[100dvh] overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] text-[#2C2A29] flex flex-col justify-between p-4 md:p-6 select-none selection:bg-[#8A9A5B] selection:text-white" dir="rtl">
        {renderTVHeader(`الجولة ${flagState.currentRound} من ${flagState.totalRounds}`, currentFlagData.name)}

        <main className="flex-1 flex flex-col items-center justify-center my-4">
          <div className="flex items-center gap-4 mb-3">
            <span className="text-base font-black text-[#24221E] bg-[#F7F4EC] px-5 py-1.5 rounded-full border-2 border-[#4A463D]/30 shadow-sm">
              {currentFlagData.name}
            </span>

            {/* 25s Countdown Badge */}
            <div className="flex items-center gap-2 px-4 py-1.5 bg-[#C68B59] text-white border-2 border-[#2C2A29] rounded-xl shadow-[3px_3px_0px_#2C2A29]">
              <Clock className="w-5 h-5 text-[#C68B59]" />
              <span className="text-2xl font-black font-mono text-[#24221E]">{flagState.countdown}s</span>
            </div>
          </div>

          {/* 3D Tactile Frame for Flag */}
          <div className="relative w-full max-w-2xl aspect-[16/10] bg-[#F7F4EC] border-8 border-[#4A463D] rounded-3xl p-3 shadow-[inset_0_4px_8px_rgba(255,255,255,0.8),0_12px_0_#38342C,0_18px_24px_rgba(0,0,0,0.2)] flex items-center justify-center overflow-hidden">
            <div className="w-full h-full rounded-xl overflow-hidden border-2 border-[#4A463D]/40 shadow-inner">
              <FlagComponent fillColor="#B0AAA0" showQuestionMark={true} className="w-full h-full object-fill" />
            </div>
          </div>

          {/* Answered progress chips */}
          <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-2xl">
            <div className="text-xs font-bold text-[#4A463D] self-center ml-2">
              أجابوا ({answeredCount} من {playersList.length}):
            </div>
            {playersList.map((p) => (
              <span
                key={p.id}
                className={`text-xs font-bold px-3 py-1 rounded-xl border-2 transition-all ${
                  p.currentGuessHex !== null
                    ? 'bg-[#8A9A5B] text-white border-[#4A463D] shadow-[0_2px_0_#38342C]'
                    : 'bg-[#EDE7D9] text-[#4A463D] border-[#4A463D]/40'
                }`}
              >
                {p.name} {p.currentGuessHex !== null ? '✓' : '...'}
              </span>
            ))}
          </div>
        </main>

        <footer className="text-center text-xs text-[#4A463D] font-semibold border-t-2 border-[#4A463D]/20 pt-3">
          حرك المؤشرات في جوالك لاختيار درجة اللون واضغط "خلصت"
        </footer>
      </div>
    );
  }

  // --- 3. REVEALING & SCORING PHASE ---
  if (flagState.gameState === 'REVEALING') {
    const renderPlayerCard = (p: typeof playersList[0], idx: number) => {
      const isRevealed = revealStep >= idx;
      const isWinner = showWinnerHighlight && (p.currentAccuracy ?? 0) === highestAccuracy && highestAccuracy > 0;

      return (
        <div
          key={p.id}
          className={`w-60 sm:w-64 bg-[#F7F4EC] rounded-2xl border-4 transition-all duration-500 overflow-hidden flex flex-col ${
            isWinner
              ? 'border-[#8A9A5B] shadow-[0_0_0_4px_#8A9A5B,0_10px_0_#8A9A5B]'
              : 'border-[#4A463D] shadow-[0_6px_0_#4A463D]'
          }`}
        >
          {/* Flag Preview Area */}
          <div className="w-full aspect-[16/10] bg-[#EDE7D9] border-b-2 border-[#4A463D] relative overflow-hidden flex items-center justify-center">
            {isRevealed ? (
              <FlagComponent fillColor={p.currentGuessHex || '#B0AAA0'} className="w-full h-full object-fill" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-1 text-[#4A463D]/60 select-none">
                <HelpCircle className="w-8 h-8" />
                <span className="text-xs font-bold">مغلق</span>
              </div>
            )}

            {isWinner && (
              <div className="absolute top-2 right-2 bg-[#8A9A5B] text-white px-2 py-0.5 rounded-md text-[11px] font-black border border-[#4A463D] flex items-center gap-1 shadow-sm">
                <Crown className="w-3 h-3" />
                <span>الأقرب!</span>
              </div>
            )}
          </div>

          {/* Player Info & Percentage */}
          <div className="p-2.5 flex items-center justify-between bg-[#F7F4EC]">
            <div>
              <h4 className="font-bold text-sm text-[#24221E] truncate max-w-[120px]">{p.name}</h4>
              <span className="text-xs text-[#4A463D] font-semibold">{p.score} pt</span>
            </div>

            <div className="text-lg font-black text-[#8A9A5B]">
              <RollingPercentage target={p.currentAccuracy ?? 0} active={isRevealed} />
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="min-h-screen bg-[#E5E0D5] text-[#24221E] flex flex-col justify-between p-6 selection:bg-[#8A9A5B] selection:text-white" dir="rtl">
        {renderTVHeader(`كشف نتائج الجولة ${flagState.currentRound}`, currentFlagData.name)}

        <main className="flex-1 flex flex-col items-center justify-center my-3 gap-5 w-full max-w-6xl mx-auto">
          {/* Top Center: Authentic Original Flag */}
          <div className="flex flex-col items-center">
            <div className="text-xs font-black text-[#4A463D] mb-1 bg-[#F7F4EC] px-3 py-0.5 rounded-full border border-[#4A463D]/30">
              اللون الأصلي الرسمي (١٠٠٪)
            </div>
            <div className="w-56 aspect-[16/10] bg-[#F7F4EC] border-4 border-[#4A463D] rounded-2xl overflow-hidden shadow-[0_5px_0_#4A463D]">
              <FlagComponent fillColor={currentFlagData.targetHex} className="w-full h-full object-fill" />
            </div>
          </div>

          {/* Dynamic Responsive Layout */}
          {playersList.length === 2 && (
            <div className="flex flex-row justify-center gap-8 w-full">
              {playersList.map((p, idx) => renderPlayerCard(p, idx))}
            </div>
          )}

          {playersList.length === 3 && (
            <div className="flex flex-row justify-center gap-6 w-full">
              {playersList.map((p, idx) => renderPlayerCard(p, idx))}
            </div>
          )}

          {playersList.length === 4 && (
            <div className="grid grid-cols-2 gap-6 justify-items-center max-w-2xl w-full">
              {playersList.map((p, idx) => renderPlayerCard(p, idx))}
            </div>
          )}

          {playersList.length === 5 && (
            <div className="flex flex-col gap-4 items-center w-full">
              <div className="flex justify-center gap-6 w-full">
                {playersList.slice(0, 3).map((p, idx) => renderPlayerCard(p, idx))}
              </div>
              <div className="flex justify-center gap-6 w-full">
                {playersList.slice(3, 5).map((p, idx) => renderPlayerCard(p, idx + 3))}
              </div>
            </div>
          )}

          {playersList.length >= 6 && (
            <div className="flex flex-wrap justify-center gap-4 w-full">
              {playersList.map((p, idx) => renderPlayerCard(p, idx))}
            </div>
          )}
        </main>

        <footer className="text-center text-xs text-[#4A463D] font-semibold border-t-2 border-[#4A463D]/20 pt-2">
          كشف نتائج المتسابقين
        </footer>
      </div>
    );
  }

  // --- 4. ROUND_INTERMISSION PHASE (Waiting for players to click "أنا جاهز للجولة القادمة") ---
  if (flagState.gameState === 'ROUND_INTERMISSION') {
    const readyMap = flagState.roundReadyPlayers || {};
    const isPlayerReady = (pid: string) => Boolean(readyMap[pid]) || readyPlayerIds.has(pid);
    const readyCount = playersList.filter((p) => isPlayerReady(p.id)).length;

    return (
      <div className="h-screen w-screen h-[100dvh] overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] text-[#2C2A29] flex flex-col justify-between p-4 md:p-6 select-none selection:bg-[#8A9A5B] selection:text-white" dir="rtl">
        {renderTVHeader(`نهاية الجولة ${flagState.currentRound} من ${flagState.totalRounds}`, 'استعد للجولة القادمة!')}

        <main className="flex-1 flex flex-col items-center justify-center my-6 max-w-3xl mx-auto w-full text-center">
          {/* Status Badge */}
          <div className="p-6 bg-[#F7F4EC] border-4 border-[#4A463D] rounded-3xl shadow-[0_8px_0_#38342C] w-full flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#C68B59] border-2 border-[#4A463D] flex items-center justify-center text-white shadow-sm">
              <Clock className="w-8 h-8" />
            </div>

            <h2 className="text-3xl font-black font-display text-[#24221E]">
              الجولة القادمة: الجولة {flagState.currentRound + 1}
            </h2>

            <p className="text-base font-bold text-[#4A463D]">
              اضغط <span className="text-[#8A9A5B] font-black">"أنا جاهز للجولة القادمة"</span> من جوالك لمتابعة التنافس
            </p>

            {/* Live Readiness Indicator */}
            <div className="px-6 py-2.5 rounded-2xl bg-[#F7F4EC] border-2 border-[#4A463D] text-lg font-black text-[#8A9A5B] shadow-inner">
              جاهز: {readyCount} من {playersList.length} متسابقين
            </div>

            {/* Manual Skip Button for Host (Never gets stuck) */}
            <button
              onClick={() => {
                sound.playClick();
                isTransitioningRef.current = true;
                const nextRound = currentRoundRef.current + 1;
                roomBus.tvStartNextRound(roomId, nextRound);
                setReadyPlayerIds(new Set());
                readyPlayerIdsRef.current = new Set();
              }}
              className="px-5 py-2 bg-[#8A9A5B] hover:bg-[#7D8D50] text-white text-xs font-black rounded-xl border-2 border-[#4A463D] shadow-[0_3px_0_#38342C] flex items-center gap-2 active:translate-y-0.5 transition-all"
            >
              <span>بدء الجولة القادمة فوراً (تخطي الانتظار)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* List of Players Readiness */}
          <div className="mt-8 flex flex-wrap gap-3 justify-center w-full">
            {playersList.map((p) => {
              const isReady = isPlayerReady(p.id);
              return (
                <div
                  key={p.id}
                  className={`px-4 py-2 rounded-xl border-2 font-bold text-sm flex items-center gap-2 ${
                    isReady
                      ? 'bg-[#8A9A5B] text-white border-[#4A463D] shadow-[0_3px_0_#38342C]'
                      : 'bg-[#EDE7D9] text-[#4A463D] border-[#4A463D]/40'
                  }`}
                >
                  <span>{p.name}</span>
                  {isReady ? <Check className="w-4 h-4" /> : <span className="text-xs">...</span>}
                </div>
              );
            })}
          </div>
        </main>

        <footer className="text-center text-xs text-[#4A463D] font-semibold border-t-2 border-[#4A463D]/20 pt-3">
          ستبدأ الجولة التالية تلقائياً فور جاهزية جميع المتسابقين
        </footer>
      </div>
    );
  }

  // --- 5. GAME OVER & PODIUM VIEW ---
  if (flagState.gameState === 'GAME_OVER') {
    const sorted = [...playersList].sort((a, b) => b.score - a.score);
    const winner = sorted[0];

    return (
      <div className="h-screen w-screen h-[100dvh] overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] text-[#2C2A29] flex flex-col justify-between p-4 md:p-6 select-none selection:bg-[#8A9A5B] selection:text-white" dir="rtl">
        {renderTVHeader('نهاية اللعبة!', 'النتائج النهائية')}

        {/* Podium Area */}
        <main className="flex-1 flex flex-col items-center justify-center my-6 max-w-4xl mx-auto w-full">
          {winner && (
            <div className="text-center mb-8">
              <span className="text-xs font-bold text-[#C68B59] uppercase tracking-wider block mb-1">بطل اللعبة</span>
              <h2 className="text-5xl font-black font-display text-[#24221E] flex items-center justify-center gap-3">
                <Crown className="w-10 h-10 text-[#C68B59]" />
                <span>{winner.name}</span>
              </h2>
              <p className="text-lg font-bold text-[#8A9A5B] mt-1">{winner.score} pt من ٥ جولات</p>
            </div>
          )}

          {/* 3D Physical Podium */}
          <div className="flex items-end justify-center gap-4 sm:gap-6 w-full max-w-2xl h-80 pt-8">
            {/* 2nd Place */}
            {sorted[1] && (
              <div className="flex-1 flex flex-col items-center">
                <div className="text-center mb-2">
                  <span className="text-xs font-bold text-[#4A463D]">المركز الثاني</span>
                  <h4 className="font-black text-base truncate max-w-[120px]">{sorted[1].name}</h4>
                  <span className="text-xs font-bold text-[#8A9A5B]">{sorted[1].score} pt</span>
                </div>
                <div className="w-full h-44 bg-[#C68B59] border-4 border-[#4A463D] rounded-t-2xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_6px_0_#38342C] flex items-center justify-center text-3xl font-black text-white font-mono">
                  ٢
                </div>
              </div>
            )}

            {/* 1st Place (Center & Highest) */}
            {sorted[0] && (
              <div className="flex-1 flex flex-col items-center">
                <div className="text-center mb-2">
                  <Crown className="w-6 h-6 text-[#C68B59] mx-auto mb-0.5" />
                  <span className="text-xs font-black text-[#8A9A5B]">المركز الأول</span>
                  <h4 className="font-black text-lg truncate max-w-[140px] text-[#24221E]">{sorted[0].name}</h4>
                  <span className="text-sm font-black text-[#8A9A5B]">{sorted[0].score} pt</span>
                </div>
                <div className="w-full h-60 bg-[#8A9A5B] border-4 border-[#4A463D] rounded-t-2xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.5),0_6px_0_#38342C] flex items-center justify-center text-4xl font-black text-white font-mono">
                  ١
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {sorted[2] && (
              <div className="flex-1 flex flex-col items-center">
                <div className="text-center mb-2">
                  <span className="text-xs font-bold text-[#4A463D]">المركز الثالث</span>
                  <h4 className="font-black text-base truncate max-w-[120px]">{sorted[2].name}</h4>
                  <span className="text-xs font-bold text-[#8A9A5B]">{sorted[2].score} pt</span>
                </div>
                <div className="w-full h-32 bg-[#EDE7D9] border-4 border-[#4A463D] rounded-t-2xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_6px_0_#38342C] flex items-center justify-center text-3xl font-black text-[#4A463D] font-mono">
                  ٣
                </div>
              </div>
            )}
          </div>

          <div className="mt-8">
            <button
              onClick={() => {
                sound.playClick();
                roomBus.resetFlagToLobby(roomId);
              }}
              className="px-8 py-3 bg-[#8A9A5B] text-white font-black text-base border-3 border-[#4A463D] rounded-2xl shadow-[0_4px_0_#38342C] flex items-center gap-2 hover:bg-[#7D8D50] active:translate-y-0.5"
            >
              <RotateCcw className="w-5 h-5" />
              <span>العودة للوبي</span>
            </button>
          </div>
        </main>

        <footer className="text-center text-xs text-[#4A463D] font-semibold border-t-2 border-[#4A463D]/20 pt-3">
          اضغط "العودة للوبي" لبدء جلسة جديدة بنفس المتسابقين
        </footer>
      </div>
    );
  }

  return null;
};
