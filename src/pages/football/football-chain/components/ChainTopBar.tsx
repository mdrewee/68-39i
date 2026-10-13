import React, { useState, FC } from 'react';
import { Copy, Check, Maximize2, Minimize2, LogOut, Clock } from 'lucide-react';
import { sound } from '../../../../lib/audio';

export interface ChainTopBarProps {
  roomCode: string;
  round?: number;
  totalRounds?: number;
  timeLeft?: number;
  onExit?: () => void;
  onEndRoom?: () => void;
}

export const ChainTopBar: FC<ChainTopBarProps> = ({
  roomCode,
  round = 1,
  totalRounds = 5,
  timeLeft,
  onExit,
  onEndRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleCopyCode = async () => {
    sound.playClick();
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleToggleFullscreen = () => {
    sound.playClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  return (
    <header className="w-full bg-[#E5E0D5] border-b-3 border-[#2C2A29] px-6 py-3 flex items-center justify-between shadow-sm shrink-0">
      {/* Right side: Game Title & Round Badge */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl md:text-2xl font-black text-[#2C2A29] tracking-tight">
          سِكّة اللاعبين
        </h1>
        {round !== undefined && (
          <span className="bg-[#8A9A5B] text-white border-2 border-[#2C2A29] px-3 py-0.5 rounded-xl text-xs md:text-sm font-black shadow-[2px_2px_0px_#2C2A29]">
            الجولة {round} من {totalRounds}
          </span>
        )}
      </div>

      {/* Center: Countdown Timer Display if active */}
      {timeLeft !== undefined && (
        <div className="flex items-center gap-2 bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1.5 rounded-2xl shadow-[2px_2px_0px_#2C2A29]">
          <Clock size={18} className={timeLeft <= 15 ? 'text-[#C68B59] animate-pulse' : 'text-[#2C2A29]'} />
          <span
            className={`font-mono text-lg md:text-xl font-black ${
              timeLeft <= 15 ? 'text-[#C68B59]' : 'text-[#2C2A29]'
            }`}
          >
            {timeLeft}ث
          </span>
        </div>
      )}

      {/* Left side: Controls (Room Code, Fullscreen, Exit) */}
      <div className="flex items-center gap-2">
        {/* Copy Room Code Button */}
        <button
          onClick={handleCopyCode}
          className="bg-[#F7F4EC] hover:bg-white text-[#2C2A29] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none px-3 py-1.5 rounded-xl font-black text-xs md:text-sm flex items-center gap-1.5 cursor-pointer transition-all"
        >
          {copied ? <Check size={16} className="text-[#8A9A5B]" /> : <Copy size={16} />}
          <span className="font-mono">{roomCode}</span>
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={handleToggleFullscreen}
          className="bg-[#F7F4EC] hover:bg-white text-[#2C2A29] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none p-2 rounded-xl cursor-pointer transition-all"
          title="ملء الشاشة"
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>

        {/* Exit / End Room Button */}
        <button
          onClick={() => {
            sound.playClick();
            if (onEndRoom) onEndRoom();
            else if (onExit) onExit();
            else window.location.href = '/';
          }}
          className="bg-[#F7F4EC] hover:bg-[#F2DEDE] text-[#5C4033] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none p-2 rounded-xl cursor-pointer transition-all"
          title="الخروج للرئيسية"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};
