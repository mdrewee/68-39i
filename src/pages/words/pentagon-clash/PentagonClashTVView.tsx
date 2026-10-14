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
  ChevronLeft,
  Hexagon,
  Award,
  Zap,
  Flame
} from 'lucide-react';
import { useRoom, roomBus, cleanRoomCode } from '../../../lib/roomBus';
import { sound } from '../../../lib/audio';
import { GeographyGameLobby } from '../../../components/common/GeographyGameLobby';
import { FullscreenButton } from '../../../components/common/FullscreenButton';
import { GeoTopNavControls } from '../../../components/common/GeoTopNavControls';
import { normalizeArabic } from '../../../utils/arabicDictionary';
import {
  PentagonSeed,
  generateDynamicPentagonRound,
  calculatePentagonWordScore,
  getPentagonPoints
} from './pentagonGenerator';

type PentagonPhase = 'LOBBY' | 'PLAYING' | 'ROUND_SUMMARY' | 'GAME_OVER';

const ROUND_DURATION = 60; // Strictly 60s countdown

interface ClaimedWordItem {
  word: string;
  playerId: string;
  playerName: string;
  points: number;
  claimedAt: number;
}

export const PentagonClashTVView: React.FC = () => {
  const params = useParams();
  const rawCode = (params.code || params.roomId || params.id || '').trim().toUpperCase() || 'TAQ1';
  const roomId = cleanRoomCode(rawCode);
  const navigate = useNavigate();

  const { room } = useRoom(roomId);
  const activeRoom = room || roomBus.getRoom(roomId) || roomBus.createRoom(roomId);

  const players = useMemo(() => {
    return (activeRoom.players || []).filter(p => p && p.id && p.id !== 'host_tv');
  }, [activeRoom.players]);

  // Game states
  const [phase, setPhase] = useState<PentagonPhase>('LOBBY');
  const [currentRound, setCurrentRound] = useState(1);
  const previousLetterSetsRef = useRef<Set<string>>(new Set());
  const [activeSeed, setActiveSeed] = useState<PentagonSeed>(() =>
    generateDynamicPentagonRound(1, previousLetterSetsRef.current)
  );

  // Timer: strictly 60 seconds
  const [timeLeft, setTimeLeft] = useState<number>(ROUND_DURATION);

  // Mutex Lock Engine: Claimed words registry
  const [claimedWords, setClaimedWords] = useState<Record<string, ClaimedWordItem>>({});
  const claimedWordsRef = useRef<Set<string>>(new Set());
  
  // Recent activity ticker
  const [tickerItems, setTickerItems] = useState<string[]>([]);

  // Cumulative scores: playerId -> total score
  const [cumulativeScores, setCumulativeScores] = useState<Record<string, number>>({});

  // Kick player
  const handleKickPlayer = useCallback((playerId: string, playerName: string) => {
    if (window.confirm(`هل أنت متأكد من طرد اللاعب "${playerName}"؟`)) {
      sound.playClick();
      roomBus.kickPlayer(roomId, playerId);
    }
  }, [roomId]);

  // Unified TopBar Exit Action: Global Ejection in Lobby
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

  // Unified TopBar Action: Return to Lobby in Active Game
  const handleReturnToLobby = useCallback(() => {
    sound.playClick();
    setPhase('LOBBY');
    setTimeLeft(ROUND_DURATION);
    setClaimedWords({});
    claimedWordsRef.current.clear();
    roomBus.emit('RETURN_TO_LOBBY', roomId, {});
    const ch = (roomBus as any).getChannel?.(roomId);
    if (ch) {
      try {
        ch.send({ type: 'broadcast', event: 'RETURN_TO_LOBBY', payload: {} });
      } catch {}
    }
  }, [roomId]);

  // Start round
  const handleStartRound = () => {
    sound.playRoundStart();
    const seed = generateDynamicPentagonRound(currentRound, previousLetterSetsRef.current);
    setActiveSeed(seed);

    setClaimedWords({});
    claimedWordsRef.current.clear();
    setTickerItems([]);
    setTimeLeft(ROUND_DURATION);
    setPhase('PLAYING');

    const payload = {
      round: currentRound,
      centerLetter: seed.centerLetter,
      outerLetters: seed.outerLetters,
      totalDuration: ROUND_DURATION
    };

    roomBus.emit('ROUND_STARTED', roomId, payload);
    const ch = (roomBus as any).getChannel?.(roomId);
    if (ch) {
      try {
        ch.send({ type: 'broadcast', event: 'ROUND_STARTED', payload });
      } catch {}
    }
  };

  // Timer countdown: strictly 60 seconds
  useEffect(() => {
    if (phase !== 'PLAYING') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          sound.playBuzzerHit();
          setPhase('ROUND_SUMMARY');

          const payload = {
            round: currentRound,
            claimedCount: Object.keys(claimedWordsRef.current).length
          };
          roomBus.emit('PENTAGON_ROUND_ENDED', roomId, payload);
          const ch = (roomBus as any).getChannel?.(roomId);
          if (ch) {
            try {
              ch.send({ type: 'broadcast', event: 'PENTAGON_ROUND_ENDED', payload });
            } catch {}
          }
          return 0;
        }
        if (prev === 11) {
          sound.playTimerWarning();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, currentRound, roomId]);

  // Listen to CLAIM_WORD from mobile (Single Submission Mutex Lock)
  useEffect(() => {
    const unsubClaim = roomBus.on('CLAIM_WORD', (evt) => {
      if (phase !== 'PLAYING') return;

      const payload = (evt as any)?.data || (evt as any)?.payload || evt;
      if (!payload || !payload.playerId || !payload.word) return;

      const cleanWord = normalizeArabic(payload.word);

      // STRICT MUTEX GUARD: Drop duplicate event immediately
      if (claimedWordsRef.current.has(cleanWord)) {
        return;
      }

      // Mark claimed locally
      claimedWordsRef.current.add(cleanWord);

      // Calculate score
      const allLetters = [activeSeed.centerLetter, ...activeSeed.outerLetters];
      const points = calculatePentagonWordScore(cleanWord, allLetters);

      const claimItem: ClaimedWordItem = {
        word: cleanWord,
        playerId: payload.playerId,
        playerName: payload.playerName || 'متسابق',
        points,
        claimedAt: Date.now()
      };

      setClaimedWords(prev => ({ ...prev, [cleanWord]: claimItem }));
      setCumulativeScores(prev => ({
        ...prev,
        [payload.playerId]: (prev[payload.playerId] || 0) + points
      }));

      // Add to ticker
      setTickerItems(prev => [
        `${payload.playerName} خطف "${cleanWord}" (+${points} pt)`,
        ...prev.slice(0, 5)
      ]);

      sound.playSuccess();

      // Broadcast WORD_CLAIMED
      const claimPayload = {
        word: cleanWord,
        playerId: payload.playerId,
        playerName: payload.playerName,
        points
      };
      roomBus.emit('WORD_CLAIMED', roomId, claimPayload);
      const ch = (roomBus as any).getChannel?.(roomId);
      if (ch) {
        try {
          ch.send({ type: 'broadcast', event: 'WORD_CLAIMED', payload: claimPayload });
        } catch {}
      }
    });

    return () => {
      unsubClaim();
    };
  }, [phase, activeSeed, roomId]);

  // Next Round
  const handleNextRound = () => {
    sound.playClick();
    if (currentRound >= 3) {
      setPhase('GAME_OVER');
    } else {
      setCurrentRound(prev => prev + 1);
      setPhase('LOBBY');
    }
  };

  // SVG Pentagon coordinates
  const pentagonOuterPoints = useMemo(() => {
    return getPentagonPoints(200, 200, 140, 0);
  }, []);

  // Leaderboard ranking
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const scoreA = cumulativeScores[a.id] || 0;
      const scoreB = cumulativeScores[b.id] || 0;
      return scoreB - scoreA;
    });
  }, [players, cumulativeScores]);

  // Lobby Phase
  if (phase === 'LOBBY') {
    return (
      <div className="w-full h-[100dvh] flex flex-col bg-[#E5E0D5] select-none p-4 md:p-6 overflow-hidden" dir="rtl">
        <div className="flex items-center justify-between pb-4 border-b-2 border-[#2C2A29] mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl text-white">
              <Hexagon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-[#000000]">خلية الخماسيات • الجولة {currentRound}</h1>
              <p className="text-xs text-[#5C4033] font-bold">تحدي خطف الكلمات اللحظي المباشر (60 ثانية)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <GeoTopNavControls
              roomCode={roomId}
              exitActionType="end_game"
              exitLabel="إنهاء اللعبة"
              onExit={handleTerminateGame}
              showRoomCode={true}
            />
            <FullscreenButton />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          <div className="lg:col-span-8 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-block bg-[#8A9A5B] text-white border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl text-xs font-black shadow-[2px_2px_0px_#2C2A29]">
                قواعد المنافسة
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-[#000000]">
                من يخطف الكلمة أولاً يحصل على نقاطها وتُقفل أمام الجميع!
              </h2>
              <ul className="space-y-2 text-sm md:text-base font-bold text-[#2C2A29]">
                <li className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8A9A5B]" />
                  يجب أن تتكون الكلمة من 3 إلى 6 أحرف.
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C68B59]" />
                  شرط إلزامي: احتواء الكلمة على الحرف المركزي في الخلية.
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8A9A5B]" />
                  توزيع النقاط: 3 أحرف = 1 pt، 4 أحرف = 2 pt، 5 أحرف = 4 pt، الكلمة الشاملة (6 أحرف) = 8 pt.
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2C2A29]" />
                  مدة الجولة: 60 ثانية سريعة ومثيرة!
                </li>
              </ul>
            </div>

            <div className="pt-6 border-t-2 border-[#2C2A29] flex items-center justify-between">
              <div className="text-sm font-bold text-[#5C4033]">
                اللاعبون في الغرفة: <span className="font-black text-[#000000]">{players.length}</span>
              </div>
              <button
                onClick={handleStartRound}
                disabled={players.length === 0}
                className="px-8 py-4 bg-[#8A9A5B] hover:bg-[#2C2A29] text-white hover:text-[#E5E0D5] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-xl font-black text-lg transition-all hover:-translate-y-1 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Play className="w-6 h-6" />
                <span>بدء الجولة ({ROUND_DURATION} ثانية)</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-5 flex flex-col min-h-0">
            <h3 className="font-black text-base text-[#000000] border-b-2 border-[#2C2A29] pb-3 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#8A9A5B]" />
              <span>المتسابقون المتصلون</span>
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {players.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                  <span className="font-black text-sm text-[#000000]">{p.name}</span>
                  <button
                    onClick={() => handleKickPlayer(p.id, p.name)}
                    className="text-xs text-red-600 hover:text-red-800 font-bold px-2 py-1 rounded bg-white/50 border border-red-300"
                  >
                    طرد
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Playing Phase
  if (phase === 'PLAYING') {
    return (
      <div className="w-full h-[100dvh] flex flex-col bg-[#E5E0D5] select-none p-4 md:p-6 overflow-hidden" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-[#2C2A29] mb-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl text-white">
              <Hexagon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-[#000000]">خلية الخماسيات • الجولة {currentRound}</h1>
              <p className="text-xs text-[#5C4033] font-bold">الكلمات المخطوفة حتى الآن: {Object.keys(claimedWords).length}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* 60s Countdown Timer */}
            <div className={`flex items-center gap-2 px-5 py-2.5 border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl font-black text-xl ${
              timeLeft <= 10 ? 'bg-[#C86D51] text-white' : 'bg-[#F7F4EC] text-[#2C2A29]'
            }`}>
              <Clock className="w-6 h-6" />
              <span>{timeLeft} ثانية</span>
            </div>

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

        {/* Game Arena */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          {/* Center Arena: Pentagon Visualizer */}
          <div className="lg:col-span-7 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 flex flex-col items-center justify-center relative">
            <div className="absolute top-4 right-4 bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] px-3 py-1 rounded-xl text-xs font-black">
              الحرف المركزي إلزامي!
            </div>

            {/* SVG Pentagon */}
            <div className="relative w-[340px] h-[340px] flex items-center justify-center">
              {/* Outer 5 Letter Nodes */}
              {activeSeed.outerLetters.map((letter, idx) => {
                const angle = (-Math.PI / 2) + (idx * 2 * Math.PI) / 5;
                const r = 115;
                const x = 170 + r * Math.cos(angle);
                const y = 170 + r * Math.sin(angle);

                return (
                  <div
                    key={idx}
                    style={{
                      left: `${x - 40}px`,
                      top: `${y - 40}px`,
                      clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)'
                    }}
                    className="absolute w-[80px] h-[80px] bg-[#E5E0D5] border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] flex items-center justify-center text-3xl font-black text-[#000000] select-none"
                  >
                    {letter}
                  </div>
                );
              })}

              {/* Central Pentagon Cell */}
              <div
                style={{
                  clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)'
                }}
                className="w-[100px] h-[100px] bg-[#C68B59] border-4 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] flex items-center justify-center text-5xl font-black text-white z-10"
              >
                {activeSeed.centerLetter}
              </div>
            </div>

            {/* Ticker of recently claimed words */}
            <div className="w-full mt-4 bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-xl p-2.5 min-h-[44px] flex items-center justify-center">
              {tickerItems.length > 0 ? (
                <span className="text-sm font-black text-[#8A9A5B]">
                  {tickerItems[0]}
                </span>
              ) : (
                <span className="text-xs font-bold text-[#5C4033]">بانتظار خطف الكلمات الأولى من اللاعبين...</span>
              )}
            </div>
          </div>

          {/* Right Arena: Live Claimed Words & Scores */}
          <div className="lg:col-span-5 flex flex-col gap-4 min-h-0">
            {/* Live Word Steal Board */}
            <div className="flex-1 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4 flex flex-col min-h-0">
              <h3 className="font-black text-base text-[#000000] border-b-2 border-[#2C2A29] pb-2 mb-3 flex items-center justify-between">
                <span>سجل الكلمات المخطوفة</span>
                <span className="text-xs text-[#8A9A5B] font-black">{Object.keys(claimedWords).length} كلمة</span>
              </h3>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {Object.values(claimedWords).length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs font-bold text-[#5C4033]">
                    لم يتم تسجيل كلمات حتى الآن
                  </div>
                ) : (
                  Object.values(claimedWords)
                    .sort((a, b) => b.claimedAt - a.claimedAt)
                    .map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2.5 bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-xl shadow-[2px_2px_0px_#2C2A29]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base text-[#000000]">{item.word}</span>
                          <span className="text-xs text-[#5C4033] font-bold">({item.playerName})</span>
                        </div>
                        <span className="bg-[#8A9A5B] text-white border border-[#2C2A29] px-2 py-0.5 rounded-lg text-xs font-black">
                          +{item.points} pt
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Mini Leaderboard */}
            <div className="h-[140px] bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4 flex flex-col">
              <h4 className="text-xs font-black text-[#5C4033] mb-2">ترتيب النقاط الحالي</h4>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {sortedPlayers.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between text-xs font-black text-[#2C2A29]">
                    <span>#{idx + 1} {p.name}</span>
                    <span className="text-[#8A9A5B]">{cumulativeScores[p.id] || 0} pt</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Summary / Game Over Phase
  return (
    <div className="w-full h-[100dvh] flex flex-col bg-[#E5E0D5] select-none p-4 md:p-6 overflow-hidden" dir="rtl">
      <div className="flex items-center justify-between pb-4 border-b-2 border-[#2C2A29] mb-4">
        <h1 className="text-2xl font-black text-[#000000]">
          {phase === 'GAME_OVER' ? 'نهاية المباراة • الترتيب النهائي' : `نتائج الجولة ${currentRound}`}
        </h1>
        <div className="flex items-center gap-3">
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

      <div className="flex-1 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 flex flex-col justify-between max-w-4xl mx-auto w-full">
        <div>
          <h2 className="text-xl font-black text-[#000000] mb-4">لوحة الصدارة</h2>
          <div className="space-y-3">
            {sortedPlayers.map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center justify-between p-4 border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl ${
                  idx === 0 ? 'bg-[#C68B59] text-white font-black' : 'bg-[#E5E0D5] text-[#2C2A29] font-bold'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">#{idx + 1}</span>
                  <span className="text-lg">{p.name}</span>
                </div>
                <span className="text-xl font-black">{cumulativeScores[p.id] || 0} pt</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t-2 border-[#2C2A29] flex justify-end">
          <button
            onClick={handleNextRound}
            className="px-8 py-3.5 bg-[#8A9A5B] hover:bg-[#2C2A29] text-white hover:text-[#E5E0D5] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-xl font-black text-lg transition-all"
          >
            {currentRound >= 3 ? 'إنهاء وحساب الفائز' : 'الانتقال للجولة التالية'}
          </button>
        </div>
      </div>
    </div>
  );
};
