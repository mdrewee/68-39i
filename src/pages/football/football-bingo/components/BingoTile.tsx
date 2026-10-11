import React, { FC } from 'react';
import { PlayerBingoTile } from '../../../../data/footballBingoData';
import { BingoIconRenderer } from './BingoIconRenderer';
import { Check } from 'lucide-react';

export interface BingoTileProps {
  tile: PlayerBingoTile;
  onTap?: () => void;
  disabled?: boolean;
  isShaking?: boolean;
  isWinningTile?: boolean;
}

export const BingoTile: FC<BingoTileProps> = ({
  tile,
  onTap,
  disabled = false,
  isShaking = false,
  isWinningTile = false,
}) => {
  const { isClaimed, claimedPlayer, definition } = tile;

  // Stamped Claimed State
  if (isClaimed && claimedPlayer) {
    return (
      <div
        className={`aspect-square w-full min-h-[75px] max-h-[95px] flex flex-col items-center justify-between p-1.5 rounded-xl border-2 ${
          isWinningTile
            ? 'border-4 border-[#8A9A5B] bg-[#8A9A5B]/30 shadow-[0_0_15px_rgba(138,154,91,0.5)]'
            : 'border-2 border-[#8A9A5B] bg-[#8A9A5B]/10 shadow-[2px_2px_0px_#8A9A5B]'
        } relative overflow-hidden transition-all select-none`}
        dir="rtl"
      >
        {/* Footballer Stamped Photo Filling The Tile */}
        <img
          src={claimedPlayer.photo}
          alt={claimedPlayer.name}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          loading="eager"
          className="w-full h-full object-cover rounded-lg absolute inset-0"
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.src.includes('wsrv.nl')) {
              target.src = `https://wsrv.nl/?url=${encodeURIComponent(claimedPlayer.photo)}&w=300&output=webp`;
            }
          }}
        />

        {/* Subtle Top & Bottom Gradient for Legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#2C2A29]/90 via-transparent to-black/30 pointer-events-none" />

        {/* Checkmark Stamp Badge */}
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#8A9A5B] text-white flex items-center justify-center border border-[#2C2A29] shadow-[1px_1px_0px_#2C2A29] z-10">
          <Check size={12} strokeWidth={3} />
        </div>

        {/* Small Bottom Overlay Badge With Footballer's Name */}
        <div className="relative z-10 w-full bg-[#2C2A29]/80 backdrop-blur-xs rounded py-0.5 px-1 text-center mt-auto">
          <span className="text-[10px] sm:text-[11px] font-black text-white block truncate leading-tight drop-shadow-sm">
            {claimedPlayer.name}
          </span>
        </div>
      </div>
    );
  }

  // Unclaimed Interactive Tile
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className={`aspect-square w-full min-h-[75px] max-h-[95px] flex flex-col items-center justify-between p-1.5 rounded-xl border-2 border-[#2C2A29] bg-[#F7F4EC] shadow-[2px_2px_0px_#2C2A29] relative overflow-hidden transition-all select-none ${
        disabled
          ? 'opacity-60 cursor-not-allowed'
          : 'hover:bg-[#E5E0D5] active:translate-y-0.5 active:shadow-[1px_1px_0px_#2C2A29] cursor-pointer'
      } ${isShaking ? 'ring-2 ring-red-500 animate-[wiggle_0.3s_ease-in-out]' : ''} ${
        isWinningTile ? 'border-4 border-[#8A9A5B] bg-[#8A9A5B]/30 shadow-[0_0_15px_rgba(138,154,91,0.5)]' : ''
      }`}
      dir="rtl"
    >
      <BingoIconRenderer definition={definition} size="md" />
    </button>
  );
};
