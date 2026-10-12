import React, { FC } from 'react';
import { ArrowRight, LogOut, Clock, Trophy } from 'lucide-react';
import { sound } from '../../../../lib/audio';

interface DraftTopBarProps {
  title?: string;
  round?: number;
  totalRounds?: number;
  timeLeft?: number;
  onExit?: () => void;
  onEndRoom?: () => void;
}

export const DraftTopBar: FC<DraftTopBarProps> = ({
  title = 'كوّن فريقك 5',
  round,
  totalRounds = 5,
  timeLeft,
  onExit,
  onEndRoom,
}) => {
  return (
    <header className="w-full bg-[#E5E0D5] border-b-2 border-[#2C2A29] px-4 md:px-8 py-3 flex items-center justify-between z-10 shadow-sm select-none">
      {/* Title & Brand */}
      <div className="flex items-center gap-3">
        {onExit && (
          <button
            onClick={() => {
              sound.playClick();
              onExit();
            }}
            className="p-1.5 rounded-lg border-2 border-[#2C2A29] bg-[#F7F4EC] hover:bg-white text-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
            title="رجوع"
          >
            <ArrowRight size={18} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[1px_1px_0px_#2C2A29] flex items-center justify-center text-[#F7F4EC] font-black text-sm">
            5
          </div>
          <div>
            <h1 className="font-black text-base md:text-lg text-[#2C2A29] leading-tight">
              {title}
            </h1>
            <span className="text-[10px] font-bold text-[#5C4033] block">
              درافت سري وتقييم تكتيكي بالذكاء الاصطناعي
            </span>
          </div>
        </div>
      </div>

      {/* Round & Timer Badges */}
      <div className="flex items-center gap-3">
        {round !== undefined && (
          <div className="flex items-center gap-1.5 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] px-3 py-1 rounded-xl font-black text-xs md:text-sm text-[#2C2A29]">
            <Trophy size={14} className="text-[#8A9A5B]" />
            <span>الجولة {round} من {totalRounds}</span>
          </div>
        )}

        {timeLeft !== undefined && (
          <div
            className={`flex items-center gap-1.5 border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] px-3 py-1 rounded-xl font-mono font-black text-xs md:text-sm ${
              timeLeft <= 7
                ? 'bg-[#C68B59] text-[#F7F4EC] animate-pulse'
                : 'bg-[#F7F4EC] text-[#2C2A29]'
            }`}
          >
            <Clock size={14} />
            <span>{timeLeft}ث</span>
          </div>
        )}

        {onEndRoom && (
          <button
            onClick={() => {
              if (window.confirm('هل تريد إنهاء الغرفة نهائياً؟')) {
                sound.playClick();
                onEndRoom();
              }
            }}
            className="flex items-center gap-1 bg-[#C68B59] hover:bg-[#B57A48] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] px-3 py-1 rounded-xl font-black text-xs cursor-pointer transition-all"
            title="إنهاء الغرفة"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">إنهاء</span>
          </button>
        )}
      </div>
    </header>
  );
};
