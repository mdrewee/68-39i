import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  FootballBingoPhase,
  FootballBingoEventPayload,
} from './types';
import {
  ActiveFootballer,
  PlayerBingoTile,
  generatePlayerBingoBoard,
  evaluateTileMatch,
  checkBingoWin,
} from '../../../data/footballBingoData';
import { BingoTile } from './components/BingoTile';
import { sound } from '../../../lib/audio';
import { Trophy, Check, Sparkles } from 'lucide-react';
import { FootballBingoTopBar } from './components/FootballBingoTopBar';

export const FootballBingoMobileView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const roomCode = (rawCode || '000000').toUpperCase();

  // Player identity from session or localStorage
  const [playerId] = useState<string>(() => {
    let id = sessionStorage.getItem('bingo_player_id');
    if (!id) {
      id = 'p_' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('bingo_player_id', id);
    }
    return id;
  });

  const [playerName, setPlayerName] = useState<string>(() => {
    return sessionStorage.getItem('player_name') || localStorage.getItem('player_name') || 'كابتن';
  });

  // Game state
  const [phase, setPhase] = useState<FootballBingoPhase>('LOBBY');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [round, setRound] = useState<number>(1);
  const [maxRounds, setMaxRounds] = useState<number>(3);
  const [currentPlayer, setCurrentPlayer] = useState<ActiveFootballer | null>(null);

  // 16-Tile Bingo Board
  const [board, setBoard] = useState<PlayerBingoTile[]>(() => generatePlayerBingoBoard());

  // Single-attempt lockout per 2-second cycle
  const [hasAttemptedCurrentPlayer, setHasAttemptedCurrentPlayer] = useState<boolean>(false);
  const [shakingTileIndex, setShakingTileIndex] = useState<number | null>(null);

  // Win claim state
  const [isBingoAvailable, setIsBingoAvailable] = useState<boolean>(false);
  const [roundWinner, setRoundWinner] = useState<{ id: string; name: string; round: number } | null>(null);

  // 2s Progress bar on mobile
  const [progressPercent, setProgressPercent] = useState<number>(100);

  // Channel ref
  const channelRef = useRef<RealtimeChannel | null>(null);
  const boardRef = useRef(board);
  const currentPlayerRef = useRef(currentPlayer);
  const hasAttemptedRef = useRef(hasAttemptedCurrentPlayer);

  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);
  useEffect(() => { hasAttemptedRef.current = hasAttemptedCurrentPlayer; }, [hasAttemptedCurrentPlayer]);

  // Broadcast helper
  const broadcast = useCallback((payload: FootballBingoEventPayload) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'bingo_event',
      payload,
    });
  }, []);

  // Ready toggle in Lobby
  const handleToggleReady = () => {
    sound.playClick();
    const next = !isReady;
    setIsReady(next);
    broadcast({
      action: 'PLAYER_READY_UPDATE',
      playerId,
      isReady: next,
    });
  };

  // Tile tap handler
  const handleTapTile = (index: number) => {
    if (phase !== 'GAMEPLAY') return;
    if (hasAttemptedCurrentPlayer) return;
    if (!currentPlayer) return;

    const targetTile = board[index];
    if (targetTile.isClaimed) return;

    // Immediately lock out further taps for this 2-second player cycle
    setHasAttemptedCurrentPlayer(true);

    const isMatch = evaluateTileMatch(currentPlayer, targetTile.definition);

    if (isMatch) {
      sound.playCorrect();
      const updatedBoard = board.map((t, idx) => {
        if (idx === index) {
          return {
            ...t,
            isClaimed: true,
            claimedPlayer: {
              id: currentPlayer.id,
              name: currentPlayer.name,
              photo: currentPlayer.photo,
            },
          };
        }
        return t;
      });

      setBoard(updatedBoard);

      // Count claimed squares
      const claimedCount = updatedBoard.filter(t => t.isClaimed).length;

      // Broadcast progress to TV scoreboard
      broadcast({
        action: 'PLAYER_PROGRESS',
        playerId,
        claimedCount,
      });

      // Check Bingo Win
      const won = checkBingoWin(updatedBoard);
      if (won) {
        sound.playVictory();
        setIsBingoAvailable(true);
      }
    } else {
      sound.playIncorrect();
      setShakingTileIndex(index);
      setTimeout(() => setShakingTileIndex(null), 400);
    }
  };

  // Claim Bingo victory
  const handleClaimBingo = () => {
    if (!isBingoAvailable) return;
    sound.playWhistle();

    broadcast({
      action: 'BINGO_CLAIM',
      winner: {
        id: playerId,
        name: playerName,
        round,
      },
    });

    setPhase('ROUND_WIN');
    setRoundWinner({
      id: playerId,
      name: playerName,
      round,
    });
  };

  // Reset 2-second progress bar smoothly
  useEffect(() => {
    if (phase !== 'GAMEPLAY') return;

    setProgressPercent(100);
    const DURATION = 2000;
    const TICK = 50;
    const start = Date.now();

    const t = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, DURATION - elapsed);
      setProgressPercent((left / DURATION) * 100);
    }, TICK);

    return () => clearInterval(t);
  }, [currentPlayer, phase]);

  // Realtime Setup
  useEffect(() => {
    if (!roomCode) return;

    // Dedicated channel ID for Football Bingo to prevent topic collision with parent PlayerMobileView
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
        presence: { key: playerId },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        // Presence sync
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('[FootballBingo Mobile] Player joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('[FootballBingo Mobile] Player left:', leftPresences);
      })
      .on('broadcast', { event: 'bingo_event' }, ({ payload }: { payload: FootballBingoEventPayload }) => {
        if (!payload) return;

        // Game Started by TV
        if (payload.action === 'GAME_START') {
          setPhase('GAMEPLAY');
          setRound(payload.round || 1);
          setMaxRounds(payload.maxRounds || 3);
          if (payload.player) {
            setCurrentPlayer(payload.player);
          }
          setHasAttemptedCurrentPlayer(false);
          setIsBingoAvailable(false);
          setRoundWinner(null);
          // Generate a fresh unique 16-tile board for the match
          setBoard(generatePlayerBingoBoard());
        }

        // New Player rotated by TV every 2 seconds
        if (payload.action === 'NEW_PLAYER' && payload.player) {
          setCurrentPlayer(payload.player);
          setHasAttemptedCurrentPlayer(false); // Reset single-attempt lockout!
          setShakingTileIndex(null);
        }

        // Bingo claimed
        if (payload.action === 'BINGO_CLAIM' && payload.winner) {
          sound.playWhistle();
          setRoundWinner(payload.winner);
          setPhase('ROUND_WIN');
        }

        // Next round started by TV
        if (payload.action === 'NEXT_ROUND') {
          setPhase('GAMEPLAY');
          setRound(payload.round || 2);
          if (payload.player) {
            setCurrentPlayer(payload.player);
          }
          setHasAttemptedCurrentPlayer(false);
          setIsBingoAvailable(false);
          setRoundWinner(null);
          // Generate fresh board for next round
          setBoard(generatePlayerBingoBoard());
        }

        // Reset to Lobby
        if (payload.action === 'RESET_LOBBY') {
          setPhase('LOBBY');
          setIsReady(false);
          setRound(1);
          setCurrentPlayer(null);
          setHasAttemptedCurrentPlayer(false);
          setIsBingoAvailable(false);
          setRoundWinner(null);
          setBoard(generatePlayerBingoBoard());
        }
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          console.log('[FootballBingo Mobile] Subscribed successfully to', channelId);
          channel.track({
            id: playerId,
            name: playerName,
            isReady,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, playerId, playerName, isReady]);

  return (
    <div
      className="w-full min-h-[100dvh] flex flex-col bg-[#E5E0D5] text-[#2C2A29] select-none"
      dir="rtl"
      style={{
        backgroundImage: 'radial-gradient(rgba(44, 42, 41, 0.04) 1.5px, transparent 1.5px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* TopBar */}
      <FootballBingoTopBar
        roomCode={roomCode}
        phase={phase}
        onEndRoom={() => (window.location.href = '/')}
      />

      <main className="flex-1 flex flex-col items-center justify-between p-3 max-w-md mx-auto w-full">
        {/* ============================================================== */}
        {/* 1. LOBBY PHASE                                                 */}
        {/* ============================================================== */}
        {phase === 'LOBBY' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center gap-5 my-auto">
            {/* Player Name Card */}
            <div className="w-full bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-5 text-center">
              <span className="text-xs font-bold text-[#8A9A5B] uppercase tracking-wider mb-1 block">
                ملفك الشخصي
              </span>
              <h2 className="text-2xl font-black text-[#2C2A29] mb-4">
                {playerName}
              </h2>

              {/* Ready Button */}
              <button
                type="button"
                onClick={handleToggleReady}
                className={`w-full py-3.5 rounded-xl font-black text-base border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] transition-all cursor-pointer ${
                  isReady
                    ? 'bg-[#8A9A5B] text-white hover:bg-[#2C2A29]'
                    : 'bg-[#C68B59] text-white hover:bg-[#2C2A29]'
                }`}
              >
                {isReady ? 'أنت جاهز ✓ (اضغط للإلغاء)' : 'جاهز للعب'}
              </button>
            </div>

            {/* Quick Mobile Tip */}
            <div className="w-full bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4 text-xs font-bold text-[#5C4033] leading-relaxed">
              <span className="font-black text-[#2C2A29] block mb-1">تعليمات الجوال:</span>
              كل ثانيتين يظهر لاعب على الشاشة، اضغط المربع اللي ينطبق عليه. لك محاولة واحدة فقط لكل لاعب.. انتبه من التخمين العشوائي!
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. GAMEPLAY PHASE                                              */}
        {/* ============================================================== */}
        {phase === 'GAMEPLAY' && currentPlayer && (
          <div className="w-full flex-1 flex flex-col items-center justify-between">
            {/* Top Header: Active Player Mini Preview & Progress Bar */}
            <div className="w-full bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl p-2.5 mb-2">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                {/* Player Mini Avatar & Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-[#2C2A29] bg-[#E5E0D5] shrink-0">
                    <img
                      src={currentPlayer.photo}
                      alt={currentPlayer.name}
                      className="w-full h-full object-cover"
                      onError={e => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="truncate">
                    <span className="font-black text-sm md:text-base text-[#2C2A29] block truncate">
                      {currentPlayer.name}
                    </span>
                    <span className="text-[10px] font-bold text-[#5C4033] block truncate">
                      {currentPlayer.nationalities.join(' • ')}
                    </span>
                  </div>
                </div>

                {/* Status Attempt Badge */}
                <span
                  className={`text-[10px] md:text-xs font-black px-2.5 py-1 rounded-lg border shrink-0 ${
                    hasAttemptedCurrentPlayer
                      ? 'bg-zinc-200 text-zinc-700 border-zinc-400'
                      : 'bg-[#8A9A5B] text-white border-[#2C2A29]'
                  }`}
                >
                  {hasAttemptedCurrentPlayer ? 'مغلق للّاعب التالي...' : 'اختر مربعاً ينطبق عليه'}
                </span>
              </div>

              {/* 2-Second Rapid Countdown Bar */}
              <div className="w-full bg-[#2C2A29]/15 h-2 rounded-full overflow-hidden border border-[#2C2A29]">
                <div
                  className="h-full bg-[#C68B59] transition-all duration-75 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* 4x4 Bingo Grid Container (Visual Icons Only) */}
            <div className="grid grid-cols-4 gap-2 w-full max-w-sm mx-auto my-auto p-1">
              {board.map((tile, idx) => (
                <BingoTile
                  key={tile.index}
                  tile={tile}
                  onTap={() => handleTapTile(idx)}
                  disabled={hasAttemptedCurrentPlayer || tile.isClaimed}
                  isShaking={shakingTileIndex === idx}
                />
              ))}
            </div>

            {/* Floating Bingo Claim Button (Revealed when win pattern matches) */}
            <div className="w-full max-w-sm pt-2 pb-1">
              {isBingoAvailable ? (
                <button
                  type="button"
                  onClick={handleClaimBingo}
                  className="w-full bg-[#C68B59] text-white py-3.5 text-xl font-black rounded-xl border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] hover:bg-[#2C2A29] active:translate-y-0.5 transition-all cursor-pointer text-center"
                >
                  بينقو! أنا الفائز
                </button>
              ) : (
                <div className="text-center text-[11px] font-bold text-[#7A7570]">
                  قفل 4 مربعات متصلة (صف، عمود، قطر، أو 4 زوايا) لإعلان الفوز!
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. ROUND WIN CELEBRATION (MOBILE)                              */}
        {/* ============================================================== */}
        {phase === 'ROUND_WIN' && roundWinner && (
          <div className="w-full max-w-sm bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 text-center my-auto">
            <div className="w-16 h-16 bg-[#C68B59] text-white rounded-full flex items-center justify-center border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] mx-auto mb-3">
              <Trophy size={32} />
            </div>

            <h3 className="text-2xl font-black text-[#2C2A29] mb-1">
              {roundWinner.id === playerId ? 'مبروك! أنت بطل البينقو!' : `${roundWinner.name} بطل البينقو!`}
            </h3>

            <p className="text-xs font-bold text-[#5C4033] mb-4">
              {roundWinner.id === playerId
                ? 'قفلت الخط وصرخت بينقو بنجاح!'
                : 'تم إعلان الفائز بالجولة.. استعد للجولة التالية من الشاشة.'}
            </p>

            <span className="text-xs font-black text-[#8A9A5B] bg-[#E5E0D5] border border-[#2C2A29] px-3 py-1.5 rounded-lg inline-block">
              الجولة {round} من {maxRounds}
            </span>
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. MATCH OVER (MOBILE)                                         */}
        {/* ============================================================== */}
        {phase === 'MATCH_OVER' && (
          <div className="w-full max-w-sm bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 text-center my-auto">
            <div className="w-16 h-16 bg-[#8A9A5B] text-white rounded-full flex items-center justify-center border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] mx-auto mb-3">
              <Sparkles size={32} />
            </div>

            <h3 className="text-2xl font-black text-[#2C2A29] mb-2">
              انتهت مباريات البينقو!
            </h3>

            <p className="text-xs font-bold text-[#5C4033] mb-4">
              شاهد منصة التتويج النهائي على شاشة التلفزيون.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
