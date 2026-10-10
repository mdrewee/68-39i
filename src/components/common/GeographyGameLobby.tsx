import React, { useState, useEffect } from 'react';
import { GeoTopNavControls } from './GeoTopNavControls';
import { LobbyRuleBox } from './LobbyRuleBox';
import { ShareRoomButton } from './ShareRoomButton';
import { QRCodeView } from './QRCodeView';
import { Play, Users, LogOut, X } from 'lucide-react';
import { sound } from '../../lib/audio';

export interface GeographyGameLobbyProps {
  gameTitle: string;
  gameCategory?: string;
  icon: React.ReactNode;
  ruleSummary: string;
  roomCode: string;
  players: Array<{ id: string; name: string; isReady?: boolean }>;
  onStartGame: () => void;
  onExitGame: () => void;
  onKickPlayer?: (playerId: string, playerName: string) => void;
  customSlot?: React.ReactNode;
  statusMessage?: string;
  canStart?: boolean;
}

export const GeographyGameLobby: React.FC<GeographyGameLobbyProps> = ({
  gameTitle,
  gameCategory = 'فئة الجغرافيا • ٥ جولات',
  icon,
  ruleSummary,
  roomCode,
  players,
  onStartGame,
  onExitGame,
  onKickPlayer,
  customSlot,
  statusMessage,
  canStart,
}) => {
  const cleanCode = (roomCode || '').toUpperCase().replace(/^ROOM_/, '');
  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/join?code=${cleanCode}`
      : `/join?code=${cleanCode}`;

  // Deduplicate strictly by unique player ID
  const cleanPlayers = React.useMemo(() => {
    const map = new Map<string, typeof players[0]>();
    players.forEach((p) => {
      if (!p || !p.id || p.id === 'host_tv') return;
      if (map.has(p.id)) {
        const existing = map.get(p.id)!;
        map.set(p.id, {
          ...existing,
          ...p,
          isReady: Boolean(existing.isReady || p.isReady),
        });
      } else {
        map.set(p.id, { ...p, isReady: Boolean(p.isReady) });
      }
    });
    return Array.from(map.values());
  }, [players]);

  // Allow starting game if at least 1 player is in the lobby
  const isEnoughPlayers = cleanPlayers.length >= 1;
  const isStartEnabled = canStart !== undefined ? canStart : isEnoughPlayers;

  // Hands-Free Auto Start when all players (minimum 2) are strictly ready
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const autoStartTimerRef = React.useRef<any>(null);

  // Strict Validation Rule: players >= 2 AND every player strictly isReady === true
  const allPlayersReady =
    cleanPlayers.length >= 2 &&
    cleanPlayers.every((p) => p.isReady === true);

  useEffect(() => {
    // If condition evaluates to false, immediately cancel and clear any existing countdown timer
    if (!allPlayersReady) {
      if (autoStartTimerRef.current) {
        clearInterval(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
      setAutoCountdown(null);
      return;
    }

    setAutoCountdown(3);
    autoStartTimerRef.current = setInterval(() => {
      setAutoCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (autoStartTimerRef.current) {
            clearInterval(autoStartTimerRef.current);
            autoStartTimerRef.current = null;
          }
          onStartGame();
          return null;
        }
        sound.playTick();
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (autoStartTimerRef.current) {
        clearInterval(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
    };
  }, [allPlayersReady]);

  const handleStart = () => {
    if (!isStartEnabled) return;
    sound.playClick();
    onStartGame();
  };

  return (
    <div
      dir="rtl"
      className="h-screen w-screen h-[100dvh] overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] text-[#2C2A29] flex flex-col justify-between p-4 md:p-6 select-none"
    >
      {/* 1. Header with Ochre Orange Pill Icon & Universal Controls */}
      <header className="flex items-center justify-between border-b-2 border-[#2C2A29]/20 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#C68B59] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] duration-150 ease-out hover:-translate-y-1 flex items-center justify-center text-white">
            {icon}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black font-display text-[#000000] leading-tight">
              {gameTitle}
            </h1>
            <p className="text-xs font-bold text-[#5C4033]">{gameCategory}</p>
          </div>
        </div>

        {/* Universal Top Nav Controls with Room Code visible and "إنهاء اللعبة" action */}
        <GeoTopNavControls
          roomCode={cleanCode}
          onExit={onExitGame}
          exitActionType="end_game"
          exitLabel="إنهاء اللعبة"
          showRoomCode={true}
          showFullscreen={true}
        />
      </header>

      {/* 2. Main Content Body */}
      <main className="flex-1 flex flex-col items-center justify-center my-2 max-w-4xl mx-auto w-full gap-3 min-h-0 overflow-y-auto">
        {/* Hero Card: QR & Big Room Code in Off-White 3D Frame */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-around gap-6 p-4 bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl shadow-[4px_4px_0px_#2C2A29]">
          <div className="flex flex-col items-center gap-1">
            <QRCodeView value={joinUrl} size={110} />
            <span className="text-[10px] font-bold text-[#5C4033]">امسح الكاميرا للانضمام</span>
          </div>

          <div className="flex flex-col items-center sm:items-start text-center sm:text-right gap-2">
            <span className="text-xs font-black text-[#C68B59] uppercase tracking-wider">
              رمز الدخول السريع
            </span>
            <div className="text-4xl sm:text-5xl font-black font-mono tracking-widest text-[#000000] bg-[#EDE7D9] px-6 py-1.5 rounded-xl border-2 border-[#2C2A29] shadow-inner">
              {cleanCode}
            </div>
            <p className="text-xs font-bold text-[#5C4033]">
              ادخل من جوالك على الموقع واكتب الرمز أعلاه
            </p>
          </div>

          <div className="w-full sm:w-48">
            <ShareRoomButton roomCode={cleanCode} />
          </div>
        </div>

        {/* Custom Slot (e.g. Landmark Scope Selector) */}
        {customSlot}

        {/* Single Unified 3D Rule Box */}
        <LobbyRuleBox summary={ruleSummary} />

        {/* Status Message */}
        {statusMessage && (
          <div className="text-xs font-bold text-[#000000] bg-[#F7F4EC] px-4 py-1.5 rounded-xl border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29]">
            {statusMessage}
          </div>
        )}

        {/* Connected Players Grid */}
        <div className="w-full max-w-2xl bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-3.5 shadow-[4px_4px_0px_#2C2A29]">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#2C2A29]/15">
            <span className="text-xs font-bold text-[#000000] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#C68B59]" />
              <span>المتسابقون المتصلون ({cleanPlayers.length})</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {cleanPlayers.length === 0 ? (
              <span className="text-xs text-[#5C4033] py-2 text-center w-full font-bold">
                بانتظار انضمام المتسابقين من جوالاتهم...
              </span>
            ) : (
              cleanPlayers.map((p) => (
                <div
                  key={p.id}
                  className={`px-3 py-1.5 rounded-xl border-2 text-xs font-black flex items-center justify-between gap-2 shadow-[2px_2px_0px_#2C2A29] transition-all ${
                    p.isReady
                      ? 'bg-[#8A9A5B]/20 border-[#8A9A5B] text-[#000000]'
                      : 'bg-[#EDE7D9] border-[#2C2A29] text-[#2C2A29]/70'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        p.isReady ? 'bg-[#8A9A5B]' : 'bg-[#C68B59] animate-pulse'
                      }`}
                    />
                    <span className="truncate">{p.name}</span>
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                        p.isReady
                          ? 'bg-[#8A9A5B] text-white'
                          : 'bg-[#2C2A29]/10 text-[#5C4033]'
                      }`}
                    >
                      {p.isReady ? '✓ جاهز' : 'ينتظر...'}
                    </span>
                  </div>

                  {/* Host Kick Button */}
                  {onKickPlayer && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onKickPlayer(p.id, p.name);
                      }}
                      className="p-1 rounded-lg bg-red-100 text-red-700 border border-[#2C2A29] hover:bg-red-600 hover:text-white transition-all shadow-[1px_1px_0px_#2C2A29] active:translate-y-0.5 shrink-0 cursor-pointer mr-1"
                      title={`طرد ${p.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* 3. Bottom Action Bar with Center Start Button (Zero duplicate exit button) */}
      <footer className="w-full max-w-md mx-auto flex flex-col items-center gap-1.5 pt-2 shrink-0">
        <button
          type="button"
          onClick={handleStart}
          disabled={!isStartEnabled}
          className={`w-full py-3.5 px-8 rounded-xl font-black text-xl flex items-center justify-center gap-2.5 transition-all duration-150 ease-out ${
            isStartEnabled
              ? 'bg-[#8A9A5B] hover:bg-[#2C2A29] text-white hover:text-[#E5E0D5] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] hover:-translate-y-1 active:translate-y-0.5 active:shadow-[2px_2px_0px_#2C2A29] cursor-pointer'
              : 'bg-stone-400 opacity-60 cursor-not-allowed shadow-none border-2 border-stone-600 text-stone-700'
          }`}
        >
          <Play className="w-5 h-5 fill-current" />
          <span>ابدأ اللعبة</span>
        </button>
        {!isStartEnabled && (
          <span className="text-xs font-bold text-[#5C4033] bg-[#F7F4EC] px-3 py-0.5 rounded-full border border-[#2C2A29]/20 shadow-sm">
            يلزم انضمام لاعب على الأقل للبدء
          </span>
        )}
      </footer>

      {/* Auto-Start Countdown Overlay */}
      {autoCountdown !== null && (
        <div className="fixed inset-0 z-50 bg-[#2C2A29]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#F7F4EC] border-4 border-[#2C2A29] rounded-3xl p-8 max-w-sm w-full text-center shadow-[8px_8px_0px_#2C2A29] flex flex-col items-center gap-4">
            <span className="text-sm font-black text-[#8A9A5B] bg-[#8A9A5B]/15 px-4 py-1 rounded-full border border-[#8A9A5B]/30">
              جميع المتسابقين جاهزون!
            </span>
            <div className="w-24 h-24 rounded-full bg-[#8A9A5B] border-4 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] flex items-center justify-center text-white text-5xl font-black font-mono">
              {autoCountdown}
            </div>
            <h2 className="text-2xl font-black text-[#000000] font-display">
              تنطلق اللعبة تلقائياً...
            </h2>
            <p className="text-xs font-bold text-[#5C4033]">
              استعدوا للتحدي على الشاشة الكبيرة!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
