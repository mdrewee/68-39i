import React from 'react';
import { ThreeLetterCardItem } from '../types';

interface ThreeLetterCardProps {
  card: ThreeLetterCardItem;
  isSelected?: boolean;
  isHoverable?: boolean;
  isDragging?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  size?: 'mobile' | 'board' | 'tv' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  style?: React.CSSProperties;
}

export const ThreeLetterCard: React.FC<ThreeLetterCardProps> = ({
  card,
  isSelected = false,
  isHoverable = false,
  isDragging = false,
  onClick,
  onDragStart,
  size = 'mobile',
  className = '',
  style
}) => {
  const sizeClasses = {
    mobile: 'w-[76px] sm:w-[84px] h-[116px] sm:h-[128px]',
    board: 'w-24 sm:w-28 h-36 sm:h-40',
    tv: 'w-32 md:w-36 h-48 md:h-52',
    sm: 'w-[76px] sm:w-[84px] h-[116px] sm:h-[128px]',
    md: 'w-24 sm:w-28 h-36 sm:h-40',
    lg: 'w-28 sm:w-32 h-40 sm:h-44',
    xl: 'w-32 md:w-36 h-48 md:h-52'
  }[size];

  const bgColor = card.colorBg || '#C86D51';

  return (
    <div
      onClick={onClick}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      style={{ backgroundColor: bgColor, ...style }}
      className={`relative select-none rounded-2xl border-2 border-[#2C2A29] flex flex-col justify-between p-2 cursor-pointer transition-all duration-200 ease-out ${sizeClasses} ${
        isSelected
          ? '-translate-y-6 shadow-[5px_5px_0px_#2C2A29] ring-2 ring-[#2C2A29] z-30 scale-105'
          : isHoverable
          ? 'hover:-translate-y-5 hover:shadow-[5px_5px_0px_#2C2A29] shadow-[3px_3px_0px_#2C2A29]'
          : 'shadow-[3px_3px_0px_#2C2A29]'
      } ${isDragging ? 'opacity-50 scale-95' : ''} ${className}`}
      dir="rtl"
    >
      {/* Subtle inner card border for a premium playing card finish */}
      <div className="absolute inset-1 border border-black/15 rounded-xl pointer-events-none" />

      {/* Top-Right Index: Prominent bold letter ONLY (NO numbers, NO '1') */}
      <div className="flex justify-start items-start leading-none z-10">
        <span className="text-base sm:text-lg md:text-xl font-black text-[#2C2A29] font-mono select-none">
          {card.letter}
        </span>
      </div>

      {/* Center Giant Hero Letter */}
      <div className="flex-1 flex items-center justify-center leading-none z-10 my-auto">
        <span className="text-4xl sm:text-5xl md:text-6xl font-black text-[#2C2A29] tracking-tight drop-shadow-sm select-none">
          {card.letter}
        </span>
      </div>

      {/* Bottom Corner: CLEAN (Empty, no bottom letter or numbers) */}
      <div className="h-2" />
    </div>
  );
};
