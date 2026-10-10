import React from 'react';
import { ThreeLetterCardItem } from '../types';

interface ThreeLetterCardProps {
  card: ThreeLetterCardItem;
  isSelected?: boolean;
  isHoverable?: boolean;
  isDragging?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
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
  size = 'md',
  className = '',
  style
}) => {
  const sizeClasses = {
    sm: 'w-14 h-20 text-2xl',
    md: 'w-20 h-28 text-3xl',
    lg: 'w-28 h-40 text-5xl',
    xl: 'w-36 h-52 text-6xl'
  }[size];

  const cornerSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm font-black',
    lg: 'text-lg font-black',
    xl: 'text-xl font-black'
  }[size];

  return (
    <div
      onClick={onClick}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      style={{
        backgroundColor: card.colorBg || '#C86D51',
        ...style
      }}
      className={`relative select-none rounded-xl border-2 border-[#2C2A29] flex flex-col justify-between p-2 cursor-pointer transition-all duration-150 ease-out ${sizeClasses} ${
        isSelected
          ? '-translate-y-5 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] ring-2 ring-white z-30 scale-105'
          : isHoverable
          ? 'hover:-translate-y-4 hover:shadow-[5px_5px_0px_#2C2A29] shadow-[3px_3px_0px_#2C2A29]'
          : 'shadow-[3px_3px_0px_#2C2A29]'
      } ${isDragging ? 'opacity-50 scale-95' : ''} ${className}`}
      dir="rtl"
    >
      {/* Top-Right Corner ONLY: Bold Arabic Letter (NO point numbers) */}
      <div className="flex justify-between items-start leading-none px-0.5">
        <span className={`font-black text-[#2C2A29] ${cornerSizeClasses}`}>
          {card.letter}
        </span>
        <span />
      </div>

      {/* Center Giant Hero Letter */}
      <div className="flex-1 flex items-center justify-center font-black text-[#2C2A29] leading-none my-auto drop-shadow-sm">
        {card.letter}
      </div>

      {/* Bottom Corner: Clean & Empty */}
      <div className="h-2" />
    </div>
  );
};
