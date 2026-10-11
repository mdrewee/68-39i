import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Play, Users, Trophy, Sparkles, RotateCcw, X, ShieldAlert } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { FootballBingoTopBar } from './components/FootballBingoTopBar';
import { BingoTile } from './components/BingoTile';
import {
  FootballBingoPhase,
  FootballBingoPlayer,
  FootballBingoEventPayload,
} from './types';
import {
  ActiveFootballer,
  PlayerBingoTile,
  FOOTBALLERS_BINGO_MASTER,
} from '../../../data/footballBingoData';
import { sound } from '../../../lib/audio';

export const FootballBingoTVView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // Core Game State
  const [phase, setPhase] = useState<FootballBingoPhase>('LOBBY');
  const [round, setRound] = useState<number>(1);
  const maxRounds = 3;
  const [players, setPlayers] = useState<FootballBingoPlayer[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({}); // playerId -> rounds won
  const [activePlayer, setActivePlayer] = useState<ActiveFootballer | null>(null);
  const [roundWinner, setRoundWinner] = useState<{
    id: string;
    name: string;
    round: number;
    board?: PlayerBingoTile[];
    winningIndices?: number[];
  } | null>(null);

  // 5-Second Roulette timer & progress
  const [progressPercent, setProgressPercent] = useState<number>(100);
  const [lobbyCountdown, setLobbyCountdown] = useState<number | null>(null);

  // Unused players pool per round to prevent duplicates
  const unusedPlayersRef = useRef<ActiveFootballer[]>([...FOOTBALLERS_BINGO_MASTER]);
  const activePlayerRef = useRef<ActiveFootballer | null>(null);
  const phaseRef = useRef<FootballBingoPhase>(phase);
  const playersRef = useRef<FootballBingoPlayer[]>(players);
  const roundRef = useRef<number>(round);
  const scoresRef = useRef<Record<string, number>>(scores);

  useEffect(() => { activePlayerRef.current = activePlayer; }, [activePlayer]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { scoresRef.current = scores; }, [scores]);

  // Realtime channel
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Pick next unused footballer randomly
  const pickNextFootballer = useCallback((): ActiveFootballer => {
    if (unusedPlayersRef.current.length === 0) {
      unusedPlayersRef.current = [...FOOTBALLERS_BINGO_MASTER].sort(() => 0.5 - Math.random());
    }
    const idx = Math.floor(Math.random() * unusedPlayersRef.current.length);
    const chosen = unusedPlayersRef.current.splice(idx, 1)[0];
    return chosen;
  }, []);

  // Broadcast to all connected clients
  const broadcastEvent = useCallback((payload: FootballBingoEventPayload) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'bingo_event',
      payload,
    });
  }, []);

  // Kick player from lobby
  const handleKickPlayer = (playerId: string) => {
    sound.playClick();
    setPlayers(prev => prev.filter(p => p.id !== playerId));
  };

  // Terminate Room entirely
  const handleTerminateRoom = useCallback(() => {
    sound.playClick();
    broadcastEvent({
      action: 'ROOM_TERMINATED',
    });
    sessionStorage.removeItem('bingo_player_id');
    sessionStorage.removeItem('bingo_room');
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    navigate('/');
  }, [broadcastEvent, navigate]);

  // Start match from Lobby
  const handleStartGame = useCallback(() => {
    sound.playWhistle();
    unusedPlayersRef.current = [...FOOTBALLERS_BINGO_MASTER].sort(() => 0.5 - Math.random());
    const firstFootballer = pickNextFootballer();

    setActivePlayer(firstFootballer);
    setPhase('GAMEPLAY');
    setProgressPercent(100);

    broadcastEvent({
      action: 'GAME_START',
      phase: 'GAMEPLAY',
      round: roundRef.current,
      maxRounds,
      player: firstFootballer,
    });
  }, [broadcastEvent, pickNextFootballer]);

  // Next Round flow
  const handleNextRound = () => {
    sound.playClick();
    if (round >= maxRounds) {
      setPhase('MATCH_OVER');
      return;
    }
    const nextR = round + 1;
    setRound(nextR);
    setRoundWinner(null);
    unusedPlayersRef.current = [...FOOTBALLERS_BINGO_MASTER].sort(() => 0.5 - Math.random());
    const nextFootballer = pickNextFootballer();

    setActivePlayer(nextFootballer);
    setPhase('GAMEPLAY');
    setProgressPercent(100);

    // Reset claimed counts for all players
    setPlayers(prev => prev.map(p => ({ ...p, claimedCount: 0 })));

    broadcastEvent({
      action: 'NEXT_ROUND',
      phase: 'GAMEPLAY',
      round: nextR,
      maxRounds,
      player: nextFootballer,
    });
  };

  // Return to Lobby
  const handleResetToLobby = () => {
    sound.playClick();
    setPhase('LOBBY');
    setRound(1);
    setRoundWinner(null);
    setScores({});
    setPlayers(prev => prev.map(p => ({ ...p, claimedCount: 0, score: 0 })));

    broadcastEvent({
      action: 'RESET_LOBBY',
      phase: 'LOBBY',
    });
  };

  // 5-Second Roulette Interval on TV during GAMEPLAY
  useEffect(() => {
    if (phase !== 'GAMEPLAY') return;

    const DURATION = 5000;
    const UPDATE_TICK = 50;
    let startTime = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, DURATION - elapsed);
      const pct = (remaining / DURATION) * 100;
      setProgressPercent(pct);

      if (elapsed >= DURATION) {
        // Cycle to next footballer
        const nextHero = pickNextFootballer();
        setActivePlayer(nextHero);
        startTime = Date.now();
        setProgressPercent(100);
        sound.playTick();

        broadcastEvent({
          action: 'NEW_PLAYER',
          player: nextHero,
        });
      }
    }, UPDATE_TICK);

    return () => clearInterval(timer);
  }, [phase, broadcastEvent, pickNextFootballer]);

  // Setup Realtime Presence & Broadcast
  useEffect(() => {
    if (!roomCode) return;

    // Dedicated channel ID for Football Bingo to prevent topic collision with parent TVScreenView
    const channelId = `bingo:${roomCode}`;

    // Remove any existing subscription on this topic
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
        const map = new Map<string, FootballBingoPlayer>();

        rawEntries.forEach(entry => {
          if (entry.id && entry.id !== 'host_tv') {
            const existing = playersRef.current.find(p => p.id === entry.id);
            map.set(entry.id, {
              id: entry.id,
              name: entry.name || 'لاعب',
              isReady: Boolean(entry.isReady),
              claimedCount: existing?.claimedCount || 0,
              score: scoresRef.current[entry.id] || 0,
            });
          }
        });

        const activeList = Array.from(map.values());
        setPlayers(activeList);

        // Lobby auto countdown check: if >= 2 players and all ready
        if (phaseRef.current === 'LOBBY' && activeList.length >= 2 && activeList.every(p => p.isReady)) {
          setLobbyCountdown(3);
        } else {
          setLobbyCountdown(null);
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('[FootballBingo TV] Player joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('[FootballBingo TV] Player left:', leftPresences);
      })
      .on('broadcast', { event: 'bingo_event' }, ({ payload }: { payload: FootballBingoEventPayload }) => {
        if (!payload) return;

        // If room terminated by host
        if (payload.action === 'ROOM_TERMINATED') {
          sessionStorage.removeItem('bingo_player_id');
          sessionStorage.removeItem('bingo_room');
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
          }
          alert('تم إنهاء الجلسة بواسطة المضيف');
          window.location.href = '/';
        }

        // Player ready update in lobby
        if (payload.action === 'PLAYER_READY_UPDATE' && payload.playerId) {
          setPlayers(prev =>
            prev.map(p => (p.id === payload.playerId ? { ...p, isReady: Boolean(payload.isReady) } : p))
          );
        }

        // Real-time progress update from mobile
        if (payload.action === 'PLAYER_PROGRESS' && payload.playerId) {
          setPlayers(prev =>
            prev.map(p =>
              p.id === payload.playerId ? { ...p, claimedCount: payload.claimedCount || 0 } : p
            )
          );
        }

        // BINGO CLAIM from mobile!
        if (payload.action === 'BINGO_CLAIM') {
          sound.playWhistle();
          setTimeout(() => sound.playVictory(), 200);

          const winnerId = payload.winnerId || payload.winner?.id || '';
          const winnerName = payload.winnerName || payload.winner?.name || 'لاعب';
          const r = payload.round || roundRef.current;
          const board = payload.board;
          const winningIndices = payload.winningIndices || [];

          const w = {
            id: winnerId,
            name: winnerName,
            round: r,
            board,
            winningIndices,
          };

          setRoundWinner(w);
          setPhase('ROUND_WIN');

          if (winnerId) {
            setScores(prev => {
              const next = { ...prev, [winnerId]: (prev[winnerId] || 0) + 1 };
              scoresRef.current = next;
              return next;
            });
          }

          // Broadcast round win lock to all players
          broadcastEvent({
            action: 'BINGO_CLAIM',
            phase: 'ROUND_WIN',
            winnerId,
            winnerName,
            winner: { id: winnerId, name: winnerName, round: r },
            board,
            winningIndices,
            scores: scoresRef.current,
          });
        }

        // Mobile requested next round
        if (payload.action === 'NEXT_ROUND' && phaseRef.current === 'ROUND_WIN') {
          handleNextRound();
        }
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          console.log('[FootballBingo TV] Subscribed successfully to', channelId);
          channel.track({ id: 'host_tv', name: 'شاشة العرض' });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, broadcastEvent]);

  // Lobby auto-countdown ticker
  useEffect(() => {
    if (lobbyCountdown === null) return;
    if (lobbyCountdown <= 0) {
      setLobbyCountdown(null);
      handleStartGame();
      return;
    }

    const t = setTimeout(() => {
      sound.playTick();
      setLobbyCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(t);
  }, [lobbyCountdown, handleStartGame]);

  const joinUrl = `${window.location.origin}/room/${roomCode}/football/football-bingo`;

  return (
    <div
      className="w-full h-[100dvh] flex flex-col bg-[#E5E0D5] text-[#2C2A29] overflow-hidden select-none"
      dir="rtl"
      style={{
        backgroundImage: 'radial-gradient(rgba(44, 42, 41, 0.04) 1.5px, transparent 1.5px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Top Bar */}
      <FootballBingoTopBar
        roomCode={roomCode}
        phase={phase}
        onExit={handleResetToLobby}
        onEndRoom={handleTerminateRoom}
      />

      {/* Main Content Arena */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden">
        {/* ============================================================== */}
        {/* 1. LOBBY PHASE                                                 */}
        {/* ============================================================== */}
        {phase === 'LOBBY' && (
          <div className="w-full max-w-5xl flex flex-col lg:flex-row items-stretch justify-center gap-6 my-auto">
            {/* Right Card: QR Code & Code */}
            <div className="flex-1 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-2xl p-6 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-bold text-[#8A9A5B] uppercase tracking-wider mb-2">
                انضم الآن بالجوال
              </span>

              <div className="p-3 bg-white border-2 border-[#2C2A29] rounded-xl shadow-[3px_3px_0px_#2C2A29] mb-4">
                <QRCodeSVG value={joinUrl} size={140} level="M" />
              </div>

              <div className="text-xs text-[#5C4033] mb-2 font-bold">
                أو اكتب كود الغرفة:
              </div>

              <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] px-6 py-2 rounded-xl font-mono text-2xl md:text-3xl font-black text-[#2C2A29] tracking-widest mb-4">
                {roomCode}
              </div>

              {/* Ready / Start Action */}
              {lobbyCountdown !== null ? (
                <div className="w-full bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] py-3 rounded-xl font-black text-xl text-center">
                  الانطلاق خلال {lobbyCountdown}...
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartGame}
                  disabled={players.length === 0}
                  className="w-full bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] py-3 rounded-xl font-black text-lg hover:bg-[#2C2A29] active:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  ابدأ اللعبة ({players.length} لاعبين)
                </button>
              )}
            </div>

            {/* Left Card: Rules & Joined Players */}
            <div className="flex-1 flex flex-col gap-4">
              {/* Rules Guide Card */}
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-2xl p-5">
                <h3 className="text-lg font-black text-[#2C2A29] mb-3 border-b-2 border-[#2C2A29]/10 pb-2">
                  طريقة لعب بينقو الكروي
                </h3>
                <ol className="space-y-2 text-xs md:text-sm font-bold text-[#5C4033] leading-relaxed list-decimal list-inside">
                  <li>كل لاعب يستلم لوحة 16 مربع بصري خاصة فيه بالجوال.</li>
                  <li>التلفزيون يكشف لاعب عشوائي كل 5 ثوانٍ مع عداد خاطف.</li>
                  <li>طابق اللاعب مع المربع الصح (نادي، علم، مدرب، كأس، رقم، مركز).</li>
                  <li>لك ضغطة وحدة فقط لكل لاعب.. إذا أخطأت يتقفل دورك للّاعب التالي!</li>
                  <li>أول من يقفل خط (أفقي، عمودي، قطري) أو الـ 4 زوايا يكبس [بينقو!].</li>
                </ol>
              </div>

              {/* Connected Players List */}
              <div className="flex-1 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-2xl p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3 border-b-2 border-[#2C2A29]/10 pb-2">
                  <span className="text-sm font-black text-[#2C2A29] flex items-center gap-2">
                    <Users size={16} /> اللاعبون في الغرفة ({players.length})
                  </span>
                  <span className="text-xs font-bold text-[#8A8580]">
                    بانتظار الجميع...
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto max-h-48 flex flex-wrap gap-2 content-start">
                  {players.length === 0 ? (
                    <div className="w-full h-24 flex items-center justify-center text-xs text-[#8A8580] font-bold">
                      امسح الباركود للانضمام إلى اللعبة
                    </div>
                  ) : (
                    players.map(p => (
                      <div
                        key={p.id}
                        className="bg-[#E5E0D5] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs md:text-sm font-black"
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${p.isReady ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'}`} />
                        <span>{p.name}</span>
                        <button
                          type="button"
                          onClick={() => handleKickPlayer(p.id)}
                          className="hover:text-red-700 transition-colors p-0.5"
                          title="طرد اللاعب"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. GAMEPLAY PHASE                                              */}
        {/* ============================================================== */}
        {phase === 'GAMEPLAY' && activePlayer && (
          <div className="w-full max-w-4xl flex flex-col items-center justify-between h-full py-2">
            {/* Round Badge Header */}
            <div className="flex items-center justify-center w-full px-4 mb-2">
              <span className="bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] px-4 py-1.5 rounded-xl font-black text-sm md:text-base">
                الجولة {round} من {maxRounds}
              </span>
            </div>

            {/* 5-Second Rapid Lightning Countdown Progress Bar */}
            <div className="w-full max-w-xl bg-[#2C2A29]/15 h-3.5 rounded-full overflow-hidden border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] mb-4">
              <div
                className="h-full bg-[#C68B59] transition-all duration-75 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Center Hero Card: Active Footballer (Strictly Blind: Photo + Name Only) */}
            <div className="relative w-full max-w-md bg-[#F7F4EC] border-4 border-[#2C2A29] shadow-[8px_8px_0px_#2C2A29] rounded-3xl p-6 flex flex-col items-center text-center">
              {/* High-Res Player Portrait */}
              <div className="relative w-52 h-52 md:w-60 md:h-60 rounded-2xl overflow-hidden border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] bg-[#E5E0D5] mb-4">
                <img
                  src={activePlayer.photo}
                  alt={activePlayer.name}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  loading="eager"
                  className="w-full h-full object-cover"
                  onError={e => {
                    const target = e.currentTarget;
                    if (!target.src.includes('wsrv.nl')) {
                      target.src = `https://wsrv.nl/?url=${encodeURIComponent(activePlayer.photo)}&w=300&output=webp`;
                    }
                  }}
                />
              </div>

              {/* Player Name */}
              <h2 className="text-3xl md:text-5xl font-black text-[#2C2A29] tracking-tight">
                {activePlayer.name}
              </h2>
            </div>

            {/* Live Players Arena Trackers */}
            <div className="w-full mt-6">
              <div className="text-center text-xs font-bold text-[#8A8580] mb-2">
                تقدم اللاعبين المباشر في لوحاتهم (16 مربع):
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 max-w-3xl mx-auto">
                {players.map(p => (
                  <div
                    key={p.id}
                    className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs md:text-sm font-extrabold"
                  >
                    <span className="text-[#2C2A29]">{p.name}:</span>
                    <span className="text-[#8A9A5B] font-black">{p.claimedCount || 0} / 16</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. ROUND WIN CELEBRATION & SHOWCASE WINNER BOARD               */}
        {/* ============================================================== */}
        {phase === 'ROUND_WIN' && roundWinner && (
          <div className="w-full max-w-3xl bg-[#F7F4EC] border-4 border-[#2C2A29] shadow-[8px_8px_0px_#2C2A29] rounded-3xl p-6 md:p-8 flex flex-col items-center text-center my-auto overflow-y-auto max-h-[92vh]">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-[#C68B59] text-white rounded-full flex items-center justify-center border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29]">
                <Trophy size={28} />
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-[#2C2A29]">
                {roundWinner.name} بطل الجولة!
              </h2>
            </div>

            <p className="text-xs md:text-sm font-bold text-[#5C4033] mb-4">
              لوحة الفائز المطابقة (المربعات المحددة بالأخضر حققت البينقو):
            </p>

            {/* Winner's 4x4 Board Showcase */}
            {roundWinner.board && roundWinner.board.length === 16 ? (
              <div className="grid grid-cols-4 gap-2 w-full max-w-sm sm:max-w-md mb-6 p-2 bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-2xl shadow-[3px_3px_0px_#2C2A29]">
                {roundWinner.board.map((tile, idx) => {
                  const isWinningTile = (roundWinner.winningIndices || []).includes(idx);
                  return (
                    <BingoTile
                      key={tile.index ?? idx}
                      tile={tile}
                      disabled={true}
                      isWinningTile={isWinningTile}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="w-full max-w-md py-4 text-center text-sm font-bold text-[#8A8580] mb-4">
                نجح في تقفيل خط كامل وصرخ بينقو في الجولة {round}!
              </div>
            )}

            {/* Next Round Action Button */}
            <button
              type="button"
              onClick={handleNextRound}
              className="bg-[#8A9A5B] text-white px-8 py-3.5 rounded-xl font-black text-lg border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] hover:bg-[#2C2A29] active:translate-y-0.5 transition-all cursor-pointer"
            >
              {round < maxRounds ? 'جاهز للجولة التالية' : 'عرض التتويج النهائي'}
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. MATCH OVER PODIUM                                           */}
        {/* ============================================================== */}
        {phase === 'MATCH_OVER' && (
          <div className="w-full max-w-2xl bg-[#F7F4EC] border-4 border-[#2C2A29] shadow-[8px_8px_0px_#2C2A29] rounded-3xl p-8 flex flex-col items-center text-center my-auto">
            <div className="w-20 h-20 bg-[#8A9A5B] text-white rounded-full flex items-center justify-center border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] mb-4">
              <Sparkles size={42} />
            </div>

            <h2 className="text-3xl md:text-5xl font-black text-[#2C2A29] mb-2">
              نهاية منافسة بينقو الكروي!
            </h2>

            <p className="text-sm md:text-base font-bold text-[#5C4033] mb-6">
              نتائج الجولات الثلاث الحاسمة:
            </p>

            {/* Leaderboard Chips */}
            <div className="w-full space-y-2 mb-6">
              {[...players]
                .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
                .map((p, rank) => (
                  <div
                    key={p.id}
                    className="bg-[#E5E0D5] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] p-3 rounded-xl flex items-center justify-between text-base font-black"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-[#2C2A29] text-white flex items-center justify-center text-xs font-mono">
                        {rank + 1}
                      </span>
                      <span>{p.name}</span>
                    </div>
                    <span className="text-[#8A9A5B] font-black">
                      {scores[p.id] || 0} جولات فوز
                    </span>
                  </div>
                ))}
            </div>

            {/* Reset / Return to Lobby */}
            <button
              type="button"
              onClick={handleResetToLobby}
              className="w-full bg-[#C68B59] text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] py-3.5 rounded-xl font-black text-lg hover:bg-[#2C2A29] active:translate-y-0.5 transition-all cursor-pointer"
            >
              العودة للوبي واللعب من جديد
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
