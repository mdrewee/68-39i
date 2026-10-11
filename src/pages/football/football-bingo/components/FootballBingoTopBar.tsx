import React, { useState, FC } from 'react';
import { Copy, Check, Maximize2, Minimize2, LogOut } from 'lucide-react';
import { sound } from '../../../../lib/audio';

export interface FootballBingoTopBarProps {
  roomCode: string;
  phase: string;
  onExit?: () => void;
  onEndRoom?: () => void;
}

export const FootballBingoTopBar: FC<FootballBingoTopBarProps> = ({
  roomCode,
  phase,
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

  const handleExitClick = () => {
    sound.playClick();
    if (phase === 'LOBBY') {
      if (onEndRoom) {
        onEndRoom();
      } else {
        window.location.href = '/';
      }
    } else {
      if (onExit) {
        onExit();
      } else {
        window.location.href = '/';
      }
    }
  };

  const isLobby = phase === 'LOBBY';

  return (
    <header className="w-full bg-[#E5E0D5] border-b-2 border-[#2C2A29] px-4 py-3 flex justify-between items-center z-30 select-none shrink-0" dir="rtl">
      {/* Title & Badge */}
      <div className="flex items-center gap-2.5">
        <h1 className="text-xl md:text-2xl font-black text-[#2C2A29] tracking-tight">
          بينقو الكروي
        </h1>
        <span className="text-xs font-black bg-[#8A9A5B] text-white border border-[#2C2A29] px-2.5 py-0.5 rounded-lg shadow-[2px_2px_0px_#2C2A29]">
          كرة قدم
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Room Code Copy Button */}
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1.5 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] px-3 py-1.5 rounded-xl text-xs md:text-sm font-black text-[#2C2A29] hover:bg-[#E5E0D5] transition-colors cursor-pointer"
          title="نسخ كود الغرفة"
        >
          {copied ? <Check size={14} className="text-[#8A9A5B]" /> : <Copy size={14} className="text-[#5C4033]" />}
          <span className="font-mono tracking-wider">{roomCode}</span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={handleToggleFullscreen}
          className="p-2 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl text-[#2C2A29] hover:bg-[#E5E0D5] transition-colors cursor-pointer"
          title={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>

        {/* Action Button: Strictly Ochre Orange #C68B59 */}
        {/* In LOBBY: Shows 'إنهاء الغرفة'. During active gameplay/victory: Shows 'العودة للوبي' */}
        <button
          onClick={handleExitClick}
          className="flex items-center gap-1.5 bg-[#C68B59] text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] px-4 py-2 rounded-xl font-bold text-xs md:text-sm hover:bg-[#2C2A29] transition-colors cursor-pointer"
        >
          <LogOut size={15} />
          <span>{isLobby ? 'إنهاء الغرفة' : 'العودة للوبي'}</span>
        </button>
      </div>
    </header>
  );
};
