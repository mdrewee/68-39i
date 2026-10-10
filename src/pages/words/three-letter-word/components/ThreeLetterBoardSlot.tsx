import React from 'react';
import { BoardSlotState } from '../types';
import { ThreeLetterCard } from './ThreeLetterCard';

interface ThreeLetterBoardSlotProps {
  slot: BoardSlotState;
  isTargetable?: boolean;
  onSlotClick?: () => void;
  onDropCard?: (slotIndex: 0 | 1 | 2) => void;
  size?: 'board' | 'tv' | 'md' | 'lg' | 'xl';
}

export const ThreeLetterBoardSlot: React.FC<ThreeLetterBoardSlotProps> = ({
  slot,
  isTargetable = false,
  onSlotClick,
  onDropCard,
  size = 'board'
}) => {
  const stackCount = Math.min(slot.stackHistory.length, 4); // Up to 4 physical depth layers

  const dimensions = {
    board: { widthPx: '104px', heightPx: '152px' },
    md: { widthPx: '104px', heightPx: '152px' },
    lg: { widthPx: '120px', heightPx: '168px' },
    xl: { widthPx: '136px', heightPx: '196px' },
    tv: { widthPx: '136px', heightPx: '196px' }
  }[size];

  const handleDragOver = (e: React.DragEvent) => {
    if (isTargetable) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isTargetable && onDropCard) {
      e.preventDefault();
      onDropCard(slot.positionIndex);
    }
  };

  return (
    <div className="flex flex-col items-center select-none">
      <div
        onClick={isTargetable ? onSlotClick : undefined}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative flex items-center justify-center p-2 rounded-2xl transition-all duration-150 ${
          isTargetable
            ? 'cursor-pointer hover:scale-105 active:scale-95 bg-[#8A9A5B]/20 border-2 border-dashed border-[#2C2A29] shadow-[0_0_15px_rgba(138,154,91,0.4)] ring-2 ring-[#8A9A5B]'
            : ''
        }`}
      >
        {/* Physical 3D stacked cards underneath */}
        {slot.stackHistory.slice(-4).map((underCard, idx) => (
          <div
            key={underCard.id + '_' + idx}
            className="absolute rounded-2xl border-2 border-[#2C2A29] pointer-events-none shadow-sm"
            style={{
              backgroundColor: underCard.colorBg || '#C86D51',
              width: dimensions.widthPx,
              height: dimensions.heightPx,
              transform: `translate(${(idx + 1) * 4}px, ${(idx + 1) * 4}px)`,
              zIndex: idx
            }}
          />
        ))}

        {/* Active Top Physical Card */}
        <div className="relative" style={{ zIndex: stackCount + 1 }}>
          <ThreeLetterCard card={slot.topCard} size={size === 'tv' || size === 'xl' ? 'tv' : 'board'} />
        </div>
      </div>
    </div>
  );
};
