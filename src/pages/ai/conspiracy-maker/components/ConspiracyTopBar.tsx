import React, { useState } from 'react';
import { Copy, Check, Maximize2, Minimize2, LogOut } from 'lucide-react';
import { ConspiracyPhase } from '../types';

interface ConspiracyTopBarProps {
  roomCode: string;
  phase: ConspiracyPhase;
  currentRound?: number;
  maxRounds?: number;
  onTerminateSession: () => void;
  onReturnToLobby?: () => void;
}

export const ConspiracyTopBar: React.FC<ConspiracyTopBarProps> = ({
  roomCode,
  phase,
  currentRound = 1,
  maxRounds = 3,
  onTerminateSession,
  onReturnToLobby
}) => {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div className="w-full bg-[#F7F4EC] border-b-2 border-[#2C2A29] px-4 py-3 flex items-center justify-between shadow-sm select-none z-50">
      {/* Right side: Game Title & Round Badge */}
      <div className="flex items-center gap-3">
        <div className="bg-[#8A9A5B] text-white px-3 py-1 rounded-xl text-sm font-extrabold border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29]">
          صانع المؤامرة
        </div>
        {phase !== 'LOBBY' && phase !== 'PODIUM' && (
          <div className="bg-[#E5E0D5] text-[#2C2A29] px-3 py-1 rounded-xl text-xs font-bold border-2 border-[#2C2A29]">
            الجولة {currentRound} من {maxRounds}
          </div>
        )}
      </div>

      {/* Center: Room Code */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-[#2C2A29]/70">رمز الغرفة:</span>
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1.5 bg-[#E5E0D5] hover:bg-[#d8d3c7] text-[#2C2A29] px-3 py-1 rounded-xl font-mono font-black text-sm border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#2C2A29]"
          title="انقر لنسخ رمز الغرفة"
        >
          <span>{roomCode}</span>
          {copied ? <Check className="w-3.5 h-3.5 text-[#8A9A5B]" /> : <Copy className="w-3.5 h-3.5 opacity-70" />}
        </button>
      </div>

      {/* Left side: Controls */}
      <div className="flex items-center gap-2">
        {phase !== 'LOBBY' && onReturnToLobby && (
          <button
            onClick={onReturnToLobby}
            className="bg-[#C68B59] hover:bg-[#b57a48] text-white px-3 py-1.5 rounded-xl text-xs font-bold border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#2C2A29]"
          >
            العودة للوبي
          </button>
        )}

        <button
          onClick={toggleFullscreen}
          className="p-1.5 bg-[#E5E0D5] hover:bg-[#d8d3c7] text-[#2C2A29] rounded-xl border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] transition-transform active:translate-x-[1px] active:translate-y-[1px]"
          title="ملء الشاشة"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        <button
          onClick={onTerminateSession}
          className="flex items-center gap-1 bg-[#C68B59] hover:bg-[#b57a48] text-white px-3 py-1.5 rounded-xl text-xs font-bold border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#2C2A29]"
          title="إنهاء الجلسة وإغلاق الغرفة للجميع"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>إنهاء الجلسة</span>
        </button>
      </div>
    </div>
  );
};
