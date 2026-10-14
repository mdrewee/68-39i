import { FullscreenButton } from '../../components/common/FullscreenButton';
import { GeoTopNavControls } from '../../components/common/GeoTopNavControls';
import { GeographyGameLobby } from '../../components/common/GeographyGameLobby';
import { CopyCodeButton } from '../../components/common/CopyCodeButton';
import { LobbyRuleBox } from '../../components/common/LobbyRuleBox';
import { GameTopBar } from '../../components/layout/GameTopBar';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Trophy,
  RotateCcw,
  Check,
  Clock,
  Users,
  Crown,
  Compass,
  Play,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { useRoom, roomBus, cleanRoomCode } from '../../lib/roomBus';
import { fetchWorldGeoJSON, calculateHitCountries } from '../../lib/trajectoryEngine';
import { TrajectoryIsolatedCanvas } from '../../components/trajectory/TrajectoryIsolatedCanvas';
import { QRCodeView } from '../../components/common/QRCodeView';
import { DemoSwitcher } from '../../components/common/DemoSwitcher';
import { useSafeCountdown } from '../../hooks/useSafeCountdown';
import { sound } from '../../lib/audio';

// Animated Rolling Distance Counter
const RollingDistance: React.FC<{ targetDistance: number; active: boolean }> = ({
  targetDistance,
  active,
}) => {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!active) {
      setVal(0);
      return;
    }
    let current = 0;
    const step = Math.max(1, Math.floor(targetDistance / 25));
    const timer = setInterval(() => {
      current += step;
      if (current >= targetDistance) {
        current = targetDistance;
        clearInterval(timer);
      }
      setVal(current);
      sound.playTick();
    }, 40);

    return () => clearInterval(timer);
  }, [active, targetDistance]);

  return <span className="font-mono font-black">{val.toLocaleString('ar-SA')} كم</span>;
};

export const TrajectoryTVView: React.FC = () => {
  const params = useParams();
  const roomCode = (params.code || params.roomId || params.id || '').trim().toUpperCase() || 'TAQ1';
  const roomId = roomCode;

  useEffect(() => {
    console.log(`[DEBUG Mount] Room: "${roomCode}" | Component: "TrajectoryTVView" | Path: "${window.location.pathname}"`);
    if (!roomCode) {
      console.error('[RoomCode Error]: roomCode is empty or undefined on mount in TrajectoryTVView!');
    }
  }, [roomCode]);
  const navigate = useNavigate();
  const { room } = useRoom(roomId);

  

  const trajectoryState = room?.trajectoryState;
  const currentRoundData = trajectoryState?.currentRoundData;

  // Game state flags (Enforced Pre-Game Lobby)
  const isLobby =
    !trajectoryState ||
    trajectoryState.gameState === 'GAME_LOBBY' ||
    trajectoryState.gameState === 'LOBBY' ||
    trajectoryState.currentRound === 0;

  const isPlaying =
    !isLobby &&
    (trajectoryState?.gameState === 'ROUND_ACTIVE' || trajectoryState?.gameState === 'PLAYING');

  const isRevealing = !isLobby && trajectoryState?.gameState === 'REVEALING';
  const isIntermission = !isLobby && trajectoryState?.gameState === 'ROUND_INTERMISSION';
  const isGameOver = !isLobby && trajectoryState?.gameState === 'GAME_OVER';

  const [worldGeoJSON, setWorldGeoJSON] = useState<any>(null);
  const [readyPlayerIds, setReadyPlayerIds] = useState<Set<string>>(new Set());

  // Ephemeral 0.5s live reactions state
  const [reactions, setReactions] = useState<{ [playerId: string]: string }>({});
  const reactionTimeouts = useRef<{ [playerId: string]: any }>({});

  const handleReaction = (playerId: string, emoji: string) => {
    sound.playClick();
    setReactions((prev) => ({ ...prev, [playerId]: emoji }));
    if (reactionTimeouts.current[playerId]) {
      clearTimeout(reactionTimeouts.current[playerId]);
    }
    reactionTimeouts.current[playerId] = setTimeout(() => {
      setReactions((prev) => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
    }, 500); // strictly remove from DOM after 500ms (0.5 seconds)
  };

  useEffect(() => {
    const unsub = roomBus.on('PLAYER_REACTION', (payload) => {
      const cleanIncoming = (payload.roomCode || '').toUpperCase().replace(/^ROOM_/, '');
      const cleanCurrent = roomId.toUpperCase().replace(/^ROOM_/, '');
      if (cleanIncoming === cleanCurrent) {
        const { playerId, emoji } = payload.data || {};
        if (playerId && emoji) {
          handleReaction(playerId, emoji);
        }
      }
    });

    return () => unsub();
  }, [roomId]);

  // Room code copy state
  const [copiedCode, setCopiedCode] = useState(false);
  const copyRoomCode = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    sound.playClick();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Safe countdown for 30s
  const secondsRemaining = useSafeCountdown(trajectoryState?.roundEndsAt);

  // Register TV as authoritative host
  useEffect(() => {
    const unregister = roomBus.registerHost(roomId);
    return () => unregister();
  }, [roomId]);

  // Ensure room trajectoryState is initialized if not present
  useEffect(() => {
    if (room && !room.trajectoryState && roomBus.isHosting(roomId)) {
      roomBus.initTrajectoryGame(roomId);
    }
  }, [room, roomId]);

  // Load world.geojson once
  useEffect(() => {
    fetchWorldGeoJSON().then((data) => {
      if (data) setWorldGeoJSON(data);
    });
  }, []);

  // Compute hit countries whenever round data changes and pass to roomBus
  useEffect(() => {
    if (currentRoundData && worldGeoJSON && isPlaying) {
      const hits = calculateHitCountries(currentRoundData, worldGeoJSON);
      roomBus.setTrajectoryHitCountries(roomId, hits);
    }
  }, [currentRoundData?.id, worldGeoJSON, isPlaying, roomId]);

  // Active connected players list (strictly deduplicated by player id)
  const playersList = useMemo(() => {
    const list = room?.players || [];
    const tPlayers = trajectoryState?.players || {};
    const map = new Map<string, any>();
    list.forEach((p) => {
      if (!p || !p.name || p.id === 'host_tv') return;
      const tp = tPlayers[p.id];
      const key = p.id;
      const item = {
        ...p,
        isReady: Boolean(p.isReady || tp?.isReady),
        score: tp?.score ?? 0,
        hasSubmitted: tp?.hasSubmitted ?? false,
        guessedCountryAr: tp?.guessedCountryAr ?? null,
        guessedCountryEn: tp?.guessedCountryEn ?? null,
        isValidIntersect: tp?.isValidIntersect ?? false,
        entryDistanceKm: tp?.entryDistanceKm ?? null,
        rank: tp?.rank ?? null,
        currentPointsAwarded: tp?.currentPointsAwarded ?? 0,
      };
      if (map.has(key)) {
        const prev = map.get(key);
        map.set(key, { ...prev, ...item, isReady: Boolean(prev.isReady || item.isReady) });
      } else {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  }, [room?.players, trajectoryState?.players]);

  const submittedCount = useMemo(() => {
    return playersList.filter((p) => p.hasSubmitted).length;
  }, [playersList]);

  // Sorted leaderboard by total score
  const sortedLeaderboard = useMemo(() => {
    return [...playersList].sort((a, b) => b.score - a.score);
  }, [playersList]);

  // Sorted round results during revealing
  const roundResults = useMemo(() => {
    return [...playersList].sort((a, b) => {
      if (a.isValidIntersect && !b.isValidIntersect) return -1;
      if (!a.isValidIntersect && b.isValidIntersect) return 1;
      return (b.entryDistanceKm || 0) - (a.entryDistanceKm || 0);
    });
  }, [playersList]);

  // Handle advancing to next round or finishing game
  const handleNextQuestion = useCallback(() => {
    sound.playClick();
    const currentRound = trajectoryState?.currentRound || 1;
    const totalRounds = trajectoryState?.totalRounds || 5;
    if (currentRound >= totalRounds) {
      roomBus.tvStartNextTrajectoryRound(roomId, totalRounds + 1);
    } else {
      roomBus.tvStartNextTrajectoryRound(roomId, currentRound + 1);
    }
    setReadyPlayerIds(new Set());
  }, [roomId, trajectoryState?.currentRound, trajectoryState?.totalRounds]);

  // Listen to ready events and auto-advance when all players are ready
  useEffect(() => {
    const cleanCode = roomId.toUpperCase().replace(/^ROOM_/, '');
    const channel = roomBus.getSupabaseChannel(roomId);

    const handleIncomingReady = (playerId: string, isReady: boolean) => {
      if (!playerId) return;
      setReadyPlayerIds((prev) => {
        const next = new Set(prev);
        if (isReady) {
          next.add(playerId);
        } else {
          next.delete(playerId);
        }

        const active = playersList.filter((p) => p.isOnline !== false);
        if (active.length > 0 && next.size >= active.length && (isRevealing || isIntermission)) {
          setTimeout(() => {
            handleNextQuestion();
          }, 400);
        }
        return next;
      });
    };

    const unsub1 = roomBus.on('PLAYER_NEXT_READY', (payload) => {
      const incomingCode = (payload.roomCode || '').toUpperCase().replace(/^ROOM_/, '');
      if (incomingCode === cleanCode && payload.data) {
        handleIncomingReady(payload.data.playerId, payload.data.isReady ?? true);
      }
    });

    const unsub2 = roomBus.on('PLAYER_READY_UPDATE', (payload) => {
      const incomingCode = (payload.roomCode || '').toUpperCase().replace(/^ROOM_/, '');
      if (incomingCode === cleanCode && payload.data) {
        handleIncomingReady(payload.data.playerId, payload.data.isReady ?? true);
      }
    });

    const unsubNextRound = roomBus.on('PLAYER_NEXT_ROUND_READY', (payload) => {
      const incomingCode = (payload.roomCode || '').toUpperCase().replace(/^ROOM_/, '');
      if (incomingCode === cleanCode && payload.data) {
        handleIncomingReady(payload.data.playerId, payload.data.isReady ?? true);
      }
    });

    const unsub3 = roomBus.on('PLAYER_ROUND_READY', (payload) => {
      const incomingCode = (payload.roomCode || '').toUpperCase().replace(/^ROOM_/, '');
      if (incomingCode === cleanCode) {
        const { playerId, roundIndex } = payload.data || {};
        if (roundIndex === undefined || roundIndex === trajectoryState?.currentRound) {
          if (playerId) handleIncomingReady(playerId, true);
        }
      }
    });

    let channelSub: any = null;
    if (channel && channel.on) {
      try {
        channelSub = channel
          .on('broadcast', { event: 'PLAYER_NEXT_READY' }, ({ payload }: any) => {
            if (payload?.playerId) handleIncomingReady(payload.playerId, payload.isReady ?? true);
          })
          .on('broadcast', { event: 'PLAYER_NEXT_ROUND_READY' }, ({ payload }: any) => {
            if (payload?.playerId) handleIncomingReady(payload.playerId, payload.isReady ?? true);
          })
          .on('broadcast', { event: 'PLAYER_READY_UPDATE' }, ({ payload }: any) => {
            if (payload?.playerId) handleIncomingReady(payload.playerId, payload.isReady ?? true);
          });
      } catch (e) {
        console.warn('Channel broadcast subscribe error:', e);
      }
    }

    return () => {
      unsub1();
      unsub2();
      unsubNextRound();
      unsub3();
    };
  }, [roomId, isRevealing, isIntermission, playersList, trajectoryState?.currentRound, handleNextQuestion]);

  // Direct sync from roundReadyPlayers state (SSOT fallback)
  useEffect(() => {
    if (!isRevealing && !isIntermission) return;
    const readyMap = trajectoryState?.roundReadyPlayers || {};
    const readyIds = Object.keys(readyMap).filter((k) => readyMap[k]);
    if (readyIds.length === 0) return;

    setReadyPlayerIds((prev) => {
      const next = new Set(prev);
      readyIds.forEach((id) => next.add(id));
      const active = playersList.filter((p) => p.isOnline !== false);
      if (active.length > 0 && next.size >= active.length) {
        setTimeout(() => {
          handleNextQuestion();
        }, 400);
      }
      return next;
    });
  }, [isRevealing, isIntermission, trajectoryState?.roundReadyPlayers, playersList, handleNextQuestion]);

  const joinUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/join?code=${roomId}` : `/join?code=${roomId}`;

  const handleKickPlayer = useCallback(async (targetPlayerId: string, playerName: string) => {
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
  }, [roomId]);

  const handleStartGame = () => {
    sound.playClick();
    if (playersList.length === 1) {
      roomBus.addMockPlayer(roomId);
    }
    setTimeout(() => {
      roomBus.tvStartNextTrajectoryRound(roomId, 1);
    }, 100);
  };

  const handleEndGame = () => {
    if (window.confirm('هل أنت متأكد من إنهاء اللعبة لجميع الأجهزة والعودة للرئيسية؟')) {
      roomBus.endGame(roomId);
      navigate('/');
    }
  };

  const handleResetToLobby = () => {
    sound.playClick();
    roomBus.resetTrajectoryToLobby(roomId);
  };

  if (isLobby) {
    return (
      <GeographyGameLobby
        gameTitle="على مسار الخط"
        gameCategory="فئة الجغرافيا • ٥ جولات"
        icon={<Compass className="w-7 h-7 text-white" />}
        ruleSummary="انتبه لمسار السهم المنطلق من الدولة الأساسية، واختر دولة يمر فوقها السهم. كلما كانت دولتك أبعد على المسار كسبت نقاطاً أعلى!"
        roomCode={roomId}
        players={playersList}
        onStartGame={handleStartGame}
        onExitGame={handleEndGame}
        onKickPlayer={handleKickPlayer}
        canStart={playersList.length >= 1}
      />
    );
  }

  return (
    <div
      dir="rtl"
      className="h-screen w-screen h-[100dvh] overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] text-[#2C2A29] flex flex-col font-sans select-none"
    >
      {/* Top TV Bar */}
      <GameTopBar
        roomCode={roomId}
        isHost={true}
        currentRound={trajectoryState?.currentRound || 1}
        totalRounds={trajectoryState?.totalRounds || 5}
        gameTitle="على مسار الخط"
        onTerminate={handleResetToLobby}
        onExit={handleResetToLobby}
      />

      <style>{`
        @keyframes reactionPop {
          0% { transform: scale(0) translateY(4px); opacity: 0; }
          50% { transform: scale(1.35) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(-8px); opacity: 0.95; }
        }
      `}</style>

      {/* Main Body */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* ======================================================== */}
        {/* 1. MANDATORY PRE-GAME LOBBY (GAME_LOBBY)                 */}
        {/* ======================================================== */}
        {isLobby && (
          <div className="absolute inset-0 bg-grain z-30 flex flex-col items-center p-8 overflow-y-auto selection:bg-[#8A9A5B] selection:text-white">
            <main className="my-auto w-full max-w-5xl flex flex-col items-center gap-6">
              {/* Hero Card: QR + Room Code (white 3D tactile frame) */}
              <div className="w-full flex flex-col md:flex-row items-center justify-center gap-8 p-6 bg-[#F7F4EC] border-2 border-[#2C2A29]/15 rounded-3xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.7),0_8px_0_#38342C]">
                <div className="flex flex-col items-center gap-1.5">
                  <QRCodeView value={joinUrl} size={150} />
                  <span className="text-[11px] font-bold text-[#4A463D]">امسح الكاميرا للانضمام</span>
                </div>

                <div className="flex flex-col items-center md:items-start text-center md:text-right">
                  <span className="text-xs font-black text-[#8A9A5B] tracking-wider mb-1">رمز الدخول السريع</span>
                  <div className="text-6xl font-black font-mono tracking-widest text-[#24221E] bg-[#F7F4EC] px-6 py-2 rounded-2xl border-3 border-[#4A463D] shadow-inner mb-2">
                    {roomId}
                  </div>
                  <p className="text-xs font-bold text-[#4A463D]">ادخل من جوالك على الموقع واكتب الرمز أعلاه</p>
                </div>
              </div>

              {/* Rules Card */}
              <div className="w-full p-5 bg-[#F7F4EC] border-2 border-[#2C2A29]/15 rounded-3xl shadow-[0_8px_0_#38342C]">
                <h2 className="text-xl font-black font-display text-[#24221E] text-center mb-4">طريقة اللعب</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { n: '1', t: 'الخط ينطلق', d: 'سهم مستقيم ينطلق من دولة الانطلاق باتجاه ثابت.' },
                    { n: '2', t: 'اختر الأبعد', d: 'اذكر دولة يمر فوقها السهم، وكل ما كانت أبعد زادت نقاطك.' },
                    { n: '3', t: 'احذر الشطحة', d: 'إذا ما لمس السهم دولتك تاخذ صفر.' },
                  ].map((r) => (
                    <div
                      key={r.n}
                      className="p-4 rounded-2xl border-3 border-[#4A463D] bg-[#F7F4EC] shadow-[0_4px_0_#4A463D] flex flex-col items-center text-center"
                    >
                      <span className="w-9 h-9 rounded-xl border-2 border-[#4A463D] bg-[#8A9A5B] text-white font-black text-sm flex items-center justify-center mb-2">
                        {r.n}
                      </span>
                      <h4 className="font-black text-base text-[#24221E] mb-1">{r.t}</h4>
                      <p className="text-xs font-bold text-[#4A463D] leading-relaxed">{r.d}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Message */}
              <div className="text-center">
                {playersList.length === 0 ? (
                  <p className="text-base font-bold text-[#4A463D] bg-[#F7F4EC] px-6 py-2 rounded-xl border-2 border-[#4A463D]/30">
                    بانتظار انضمام المتسابقين...
                  </p>
                ) : (
                  <p className="text-base font-black text-[#8A9A5B] bg-[#8A9A5B]/15 px-6 py-2 rounded-xl border-2 border-[#8A9A5B]">
                    المتسابقون جاهزون، اضغط ابدأ اللعبة متى ما كنتم مستعدين
                  </p>
                )}
              </div>

              {/* Joined Players Grid */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-3 px-2">
                  <span className="text-sm font-bold text-[#4A463D] flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>المتسابقون ({playersList.length})</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {playersList.map((p) => (
                    <div
                      key={p.id}
                      className="relative overflow-visible p-3.5 rounded-2xl border-3 bg-[#F7F4EC] border-[#8A9A5B] shadow-[0_4px_0_#8A9A5B] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl border-2 border-[#4A463D] bg-[#8A9A5B] text-white flex items-center justify-center font-bold text-xs">
                          {p.name.charAt(0)}
                        </div>
                        <span className="font-bold text-[#24221E] text-sm truncate max-w-[100px]">{p.name}</span>
                        {reactions[p.id] && (
                          <span
                            key={reactions[p.id]}
                            className="text-2xl select-none pointer-events-none z-30 inline-block"
                            style={{ animation: 'reactionPop 0.5s ease-out forwards' }}
                          >
                            {reactions[p.id]}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-[#8A9A5B] text-white flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>جاهز</span>
                      </span>
                    </div>
                  ))}

                  {playersList.length === 0 && (
                    <div className="col-span-full py-10 text-center text-[#4A463D] font-bold bg-[#F7F4EC]/60 rounded-2xl border-2 border-dashed border-[#4A463D]/30">
                      امسح الباركود أو أدخل الرمز للانضمام للجلسة
                    </div>
                  )}
                </div>
              </div>

              {/* Start Game Button (green tactile) */}
              <button
                onClick={handleStartGame}
                disabled={playersList.length === 0}
                className={`px-12 py-4 rounded-2xl font-black text-xl flex items-center gap-3 border-3 border-[#4A463D] transition-all ${
                  playersList.length > 0
                    ? 'bg-[#8A9A5B] hover:bg-[#7D8D50] text-white shadow-[0_5px_0_#38342C] active:translate-y-1 active:shadow-[0_1px_0_#38342C] cursor-pointer'
                    : 'bg-[#DDD7C8] text-[#4A463D]/50 shadow-[0_5px_0_#4A463D]/40 cursor-not-allowed'
                }`}
              >
                <Play className="w-6 h-6 fill-current" />
                <span>ابدأ اللعبة (5 جولات)</span>
              </button>
            </main>
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. MINIMALIST COUNTRY SILHOUETTE SVG CANVAS              */}
        {/* ======================================================== */}
        <div className="flex-1 relative h-full bg-[#E5E0D5]">
          {currentRoundData && (
            <TrajectoryIsolatedCanvas
              round={currentRoundData}
              worldGeoJSON={worldGeoJSON}
              players={playersList}
              isRevealing={isRevealing}
              isIntermission={isIntermission}
            />
          )}

          {/* Ephemeral Reaction Floaters HUD on Main TV Canvas */}
          <div className="absolute top-6 left-6 z-20 flex flex-col gap-2 pointer-events-none">
            {Object.entries(reactions).map(([pId, emoji]) => {
              const p = playersList.find((pl) => pl.id === pId);
              return (
                <div
                  key={pId + '_' + emoji}
                  className="bg-[#2C2A29] text-white px-4 py-2 rounded-2xl border-2 border-[#C68B59] shadow-tactile flex items-center gap-2.5"
                  style={{
                    animation: 'reactionPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                  }}
                >
                  <span className="font-bold text-sm">{p?.name || 'متسابق'}</span>
                  <span className="text-2xl">{emoji}</span>
                </div>
              );
            })}
          </div>

          {/* Prominent Top Question Banner */}
          {!isLobby && currentRoundData && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-[#DDD8CC]/95 backdrop-blur-md border-2 border-[#2C2A29]/20 rounded-2xl px-8 py-3.5 shadow-tactile flex items-center gap-6">
              <div className="text-right">
                <span className="text-xs font-bold text-[#C68B59] block">السؤال المطلوب</span>
                <span className="text-xl font-black text-[#2C2A29]">
                  من {currentRoundData.originCountry}.. اذكر دولة يمر هذا السهم فوق أراضيها!
                </span>
              </div>
              <div className="h-8 w-px bg-[#2C2A29]/20" />
              <div className="text-right">
                <span className="text-xs font-bold text-[#2C2A29]/50 block">زاوية المسار</span>
                <span className="text-lg font-mono font-black text-[#2C2A29]">{currentRoundData.bearing}°</span>
              </div>
              <div className="h-8 w-px bg-[#2C2A29]/20" />
              <div className="text-right">
                <span className="text-xs font-bold text-[#8A9A5B] block">الإجابات المعتمدة</span>
                <span className="text-lg font-mono font-black text-[#2C2A29]">
                  {submittedCount} / {playersList.length}
                </span>
              </div>
              {isPlaying && (
                <>
                  <div className="h-8 w-px bg-[#2C2A29]/20" />
                  <div className={`px-3.5 py-1.5 rounded-xl border-2 border-[#2C2A29] font-mono font-black text-base shadow-[2px_2px_0px_#2C2A29] ${
                    secondsRemaining <= 5 ? 'bg-[#A35A5A] text-white' : 'bg-[#C68B59] text-white'
                  }`}>
                    <span>{secondsRemaining}s</span>
                  </div>
                </>
              )}
            </div>
          )}
          {/* Prominent Results Action Floating Bar over Main Map Canvas */}
          {(isRevealing || isIntermission) && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl px-6 py-3 shadow-[6px_6px_0px_#2C2A29] flex items-center gap-6">
              <div className="text-right">
                <span className="text-xs font-bold text-[#5C4033] block">
                  جاهزية المتسابقين ({readyPlayerIds.size} / {playersList.length})
                </span>
                <span className="text-sm font-black text-[#000000]">
                  {(trajectoryState?.currentRound || 1) >= (trajectoryState?.totalRounds || 5)
                    ? 'اكتملت الجولات'
                    : `جولة ${trajectoryState?.currentRound || 1} من ${trajectoryState?.totalRounds || 5}`}
                </span>
              </div>
              <button
                type="button"
                onClick={handleNextQuestion}
                className="py-3 px-8 bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-xl font-bold hover:bg-[#2C2A29] hover:text-[#E5E0D5] hover:-translate-y-1 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-2"
              >
                <span>
                  {(trajectoryState?.currentRound || 1) >= (trajectoryState?.totalRounds || 5)
                    ? 'إنهاء اللعبة والنتائج النهائية ◄'
                    : 'الانتقال للسؤال التالي ◄'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Sidebar: Leaderboard & Live Round Results */}
        <aside className="w-96 bg-[#DDD8CC] border-r-2 border-[#2C2A29]/15 flex flex-col shadow-tactile z-10 shrink-0">
          <div className="p-4 border-b-2 border-[#2C2A29]/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#C68B59]" />
              <h3 className="font-black text-[#2C2A29] text-base">
                {isRevealing || isIntermission ? 'نتائج الجولة والمراكز' : 'لوحة المتصدرين'}
              </h3>
            </div>
            <span className="text-xs font-bold text-[#2C2A29]/50">{playersList.length} لاعب</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {isRevealing || isIntermission ? (
              /* Round Results View with strict Off-white container & Olivine green cards */
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-2xl p-6 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b-2 border-[#2C2A29]/20">
                  <span className="font-black text-[#000000] text-sm font-display">ترتيب نتائج الجولة #{trajectoryState?.currentRound || 1}</span>
                  <span className="text-xs font-bold text-[#5C4033] bg-[#E5E0D5] px-2 py-0.5 rounded-md border border-[#2C2A29]/20">
                    {roundResults.length} متسابق
                  </span>
                </div>
                {roundResults.map((p, idx) => (
                  <div
                    key={p.id}
                    className="bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl p-3 flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#2C2A29] border border-white/30 text-white flex items-center justify-center font-black text-xs shadow-sm shrink-0">
                        {p.rank ? `#${p.rank}` : `#${idx + 1}`}
                      </div>
                      <div>
                        <div className="font-black text-sm text-white flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {reactions[p.id] && (
                            <span className="text-lg inline-block drop-shadow">
                              {reactions[p.id]}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-bold text-white/95">
                          {p.guessedCountryAr || 'لم يخمن'}
                          {p.isValidIntersect && p.entryDistanceKm !== null ? ` • ${p.entryDistanceKm.toLocaleString('ar-SA')} كم` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-left font-mono font-black text-sm text-white shrink-0">
                      {p.isValidIntersect && p.entryDistanceKm !== null ? (
                        <span className="bg-[#2C2A29] px-2.5 py-1 rounded-lg border border-white/20 inline-block shadow-sm">
                          +{p.currentPointsAwarded} pt
                        </span>
                      ) : (
                        <span className="text-white/80 text-xs font-bold bg-[#2C2A29]/40 px-2 py-1 rounded-lg">
                          0 pt
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* General Match Leaderboard */
              sortedLeaderboard.map((p, idx) => (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl border-2 flex items-center justify-between shadow-tactile ${
                    idx === 0
                      ? 'bg-[#C68B59]/15 border-[#C68B59]'
                      : 'bg-[#E5E0D5] border-[#2C2A29]/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-xs text-[#2C2A29]/50 w-5">#{idx + 1}</span>
                    <span className="font-bold text-sm text-[#2C2A29]">{p.name}</span>
                    {reactions[p.id] && (
                      <span
                        key={reactions[p.id]}
                        className="text-xl select-none pointer-events-none drop-shadow-md z-30 inline-block"
                        style={{
                          animation: 'reactionPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                        }}
                      >
                        {reactions[p.id]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isPlaying && p.hasSubmitted && (
                      <span className="text-[11px] bg-[#8A9A5B]/20 text-[#8A9A5B] font-bold px-2 py-0.5 rounded-full border border-[#8A9A5B]/30">
                        تم الإرسال
                      </span>
                    )}
                    <span className="font-mono font-black text-base text-[#C68B59]">{p.score}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Intermission & Results Next Round Action Bar */}
          {(isRevealing || isIntermission) && (
            <div className="p-4 border-t-2 border-[#2C2A29]/15 bg-[#E5E0D5]">
              <div className="text-xs font-bold text-[#2C2A29]/70 mb-2 flex items-center justify-between">
                <span>جاهزية المتسابقين للجولة القادمة:</span>
                <span className="font-mono font-bold text-[#C68B59]">
                  {readyPlayerIds.size} / {playersList.length}
                </span>
              </div>
              <button
                type="button"
                onClick={handleNextQuestion}
                className="w-full py-3.5 bg-[#8A9A5B] hover:bg-[#2C2A29] text-white hover:text-[#E5E0D5] rounded-xl font-black text-sm border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] transition-all cursor-pointer flex items-center justify-center gap-2 hover:-translate-y-1 active:translate-y-0.5"
              >
                <span>
                  {(trajectoryState?.currentRound || 1) >= (trajectoryState?.totalRounds || 5)
                    ? 'إنهاء اللعبة والنتائج النهائية ◄'
                    : 'الانتقال للسؤال التالي ◄'}
                </span>
              </button>
            </div>
          )}
        </aside>

        {/* FINAL PODIUM OVERLAY */}
        {isGameOver && (
          <div className="absolute inset-0 bg-[#E5E0D5]/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl w-full bg-[#DDD8CC] border-3 border-[#2C2A29]/20 rounded-3xl p-8 shadow-tactile text-center">
              <div className="w-20 h-20 rounded-2xl bg-[#C68B59] text-white flex items-center justify-center shadow-tactile mx-auto mb-4">
                <Trophy className="w-12 h-12 text-white" />
              </div>

              <h2 className="text-3xl font-black text-[#2C2A29] mb-1">منصة التتويج النهائية</h2>
              <p className="text-sm font-bold text-[#2C2A29]/60 mb-8">
                أبطال تحدي مسار الخط بعد نهاية الجولات الخمس
              </p>

              {/* Podium Top 3 */}
              <div className="flex items-end justify-center gap-4 mb-8">
                {/* 2nd Place */}
                {sortedLeaderboard[1] && (
                  <div className="flex-1 bg-[#E5E0D5] border-2 border-[#8A9A5B]/50 rounded-2xl p-4 shadow-tactile flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-[#8A9A5B] text-white font-black text-sm flex items-center justify-center mb-2">
                      2
                    </div>
                    <span className="font-black text-base text-[#2C2A29] mb-1">{sortedLeaderboard[1].name}</span>
                    <span className="font-mono font-black text-xl text-[#8A9A5B]">{sortedLeaderboard[1].score} ن</span>
                  </div>
                )}

                {/* 1st Place */}
                {sortedLeaderboard[0] && (
                  <div className="flex-1 bg-[#E5E0D5] border-3 border-[#C68B59] rounded-2xl p-6 shadow-tactile flex flex-col items-center -translate-y-4">
                    <Crown className="w-8 h-8 text-[#C68B59] mb-1" />
                    <div className="w-12 h-12 rounded-full bg-[#C68B59] text-white font-black text-lg flex items-center justify-center mb-2 shadow-tactile">
                      1
                    </div>
                    <span className="font-black text-lg text-[#2C2A29] mb-1">{sortedLeaderboard[0].name}</span>
                    <span className="font-mono font-black text-2xl text-[#C68B59]">{sortedLeaderboard[0].score} ن</span>
                  </div>
                )}

                {/* 3rd Place */}
                {sortedLeaderboard[2] && (
                  <div className="flex-1 bg-[#E5E0D5] border-2 border-[#2C2A29]/20 rounded-2xl p-4 shadow-tactile flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-[#2C2A29]/30 text-[#2C2A29] font-black text-sm flex items-center justify-center mb-2">
                      3
                    </div>
                    <span className="font-black text-base text-[#2C2A29] mb-1">{sortedLeaderboard[2].name}</span>
                    <span className="font-mono font-black text-xl text-[#2C2A29]">{sortedLeaderboard[2].score} ن</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleResetToLobby}
                className="px-8 py-3.5 bg-[#C68B59] hover:bg-[#B57A48] text-white rounded-xl font-black text-base shadow-tactile transition-colors border border-[#2C2A29]/20"
              >
                العودة إلى الردهة واللعب مجدداً
              </button>
            </div>
          </div>
        )}
      </div>

      <DemoSwitcher roomId={roomId} currentRole="tv" />
    </div>
  );
};