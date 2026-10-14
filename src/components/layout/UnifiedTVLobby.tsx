import React from 'react';
import { Play, X } from 'lucide-react';
import { QRCodeView } from '../common/QRCodeView';
import { sound } from '@/lib/audio';

export interface UnifiedTVLobbyPlayer {
  id: string;
  name: string;
  isReady?: boolean;
}

export interface UnifiedTVLobbyProps {
  roomCode: string;
  gameTitle: string;
  instructions: string[];
  players: UnifiedTVLobbyPlayer[];
  onStartGame: () => void;
  onKickPlayer?: (playerId: string) => void;
  minPlayers?: number;
  categorySelector?: React.ReactNode;
  subtitle?: string;
}

export const UnifiedTVLobby: React.FC<UnifiedTVLobbyProps> = ({
  roomCode,
  gameTitle,
  instructions,
  players,
  onStartGame,
  onKickPlayer,
  minPlayers = 1,
  categorySelector,
  subtitle,
}) => {
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/join?code=${roomCode}` : '';
  const canStart = players.length >= minPlayers;

  const handleStart = () => {
    if (!canStart) return;
    sound.playRoundStart();
    onStartGame();
  };

  const handleKick = (playerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick();
    if (onKickPlayer) {
      onKickPlayer(playerId);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center justify-between gap-6 py-4 select-none" dir="rtl">
      {/* Top Grid: QR + Instructions */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full items-stretch">
        {/* Giant Code & QR Card */}
        <div className="md:col-span-5 bg-[#F7F4EC] border-2 sm:border-3 border-[#2C2A29] rounded-2xl p-6 shadow-[3px_3px_0px_#2C2A29] flex flex-col items-center justify-center text-center gap-4">
          <div className="text-center">
            <span className="text-xs font-bold text-[#2C2A29]/70 block mb-1">امسح للانضمام</span>
            <div className="border-3 border-[#2C2A29] rounded-xl overflow-hidden bg-white p-2 shadow-[2px_2px_0px_#2C2A29]">
              <QRCodeView url={joinUrl} size={150} className="border-0 shadow-none p-0 bg-white" />
            </div>
          </div>

          <div className="w-full">
            <span className="text-xs font-bold text-[#2C2A29]/70 block mb-1">رمز الغرفة</span>
            <div className="text-4xl md:text-5xl font-black font-mono tracking-widest text-[#2C2A29] bg-[#E5E0D5] border-2 sm:border-3 border-[#2C2A29] py-2 px-4 rounded-xl shadow-[3px_3px_0px_#2C2A29]">
              {roomCode}
            </div>
          </div>
        </div>

        {/* Instructions & Category Selector Card */}
        <div className="md:col-span-7 bg-[#F7F4EC] border-2 sm:border-3 border-[#2C2A29] rounded-2xl p-6 shadow-[3px_3px_0px_#2C2A29] flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-xs font-black bg-[#8A9A5B] text-white border border-[#2C2A29] px-3 py-1 rounded-lg shadow-[2px_2px_0px_#2C2A29] inline-block mb-2">
                طريقة اللعب
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-[#2C2A29]">
                {gameTitle}
              </h2>
              {subtitle && (
                <p className="text-sm font-bold text-[#2C2A29]/70 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] p-4 rounded-xl shadow-[2px_2px_0px_#2C2A29] flex flex-col gap-2">
              {instructions.slice(0, 3).map((inst, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm md:text-base font-bold text-[#2C2A29]">
                  <span className="font-black text-[#8A9A5B] shrink-0 text-lg leading-tight">•</span>
                  <span>{inst}</span>
                </div>
              ))}
            </div>

            {/* Optional Category Selector for Host */}
            {categorySelector && (
              <div className="mt-1">
                {categorySelector}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Players Roster Grid */}
      <div className="w-full bg-[#F7F4EC] border-2 sm:border-3 border-[#2C2A29] rounded-2xl p-5 shadow-[3px_3px_0px_#2C2A29] flex flex-col gap-3">
        <div className="flex items-center justify-between border-b-2 border-[#2C2A29]/20 pb-2">
          <h3 className="font-black text-lg text-[#2C2A29]">
            المتسابقون المتصلون ({players.length})
          </h3>
          <span className="text-xs font-bold text-[#2C2A29]/70">
            {canStart ? 'جاهزون للانطلاق' : `يلزم ${minPlayers} على الأقل`}
          </span>
        </div>

        <div className="min-h-[80px] flex flex-wrap gap-2.5 items-center content-start">
          {players.length === 0 ? (
            <div className="w-full text-center py-6 text-sm font-bold text-[#2C2A29]/60 italic">
              بانتظار مسح الباركود ودخول المتسابقين...
            </div>
          ) : (
            players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 bg-[#FAF8F5] border-2 border-[#2C2A29] rounded-xl px-3 py-1.5 shadow-[2px_2px_0px_#2C2A29]"
              >
                <span className="font-black text-sm text-[#2C2A29]">{p.name}</span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.5 rounded border border-[#2C2A29] ${
                    p.isReady
                      ? 'bg-[#8A9A5B] text-white'
                      : 'bg-[#E5E0D5] text-[#2C2A29]'
                  }`}
                >
                  {p.isReady ? 'جاهز' : 'في الانتظار'}
                </span>
                {onKickPlayer && (
                  <button
                    onClick={(e) => handleKick(p.id, e)}
                    type="button"
                    title="طرد اللاعب"
                    className="p-0.5 bg-[#C68B59] hover:opacity-90 text-white rounded border border-[#2C2A29] cursor-pointer"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Start Button */}
      <div className="w-full max-w-md">
        <button
          onClick={handleStart}
          disabled={!canStart}
          type="button"
          className={`w-full py-4 rounded-xl font-black text-xl border-2 sm:border-3 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] flex items-center justify-center gap-2 transition-all ${
            canStart
              ? 'bg-[#8A9A5B] hover:opacity-95 text-white cursor-pointer active:translate-y-0.5'
              : 'bg-[#D5CEBF] text-[#7A7365] opacity-80 cursor-not-allowed shadow-none'
          }`}
        >
          <Play className="w-5 h-5 fill-current" />
          <span>{canStart ? 'ابدأ اللعبة' : `بانتظار انضمام ${minPlayers} متسابقين على الأقل...`}</span>
        </button>
      </div>
    </div>
  );
};
