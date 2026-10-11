import React, { FC } from 'react';
import { PlayerBingoTile } from '../../../../data/footballBingoData';
import { BingoIconRenderer } from './BingoIconRenderer';
import { Check } from 'lucide-react';

export interface BingoTileProps {
  tile: PlayerBingoTile;
  onTap: () => void;
  disabled?: boolean;
  isShaking?: boolean;
}

export const BingoTile: FC<BingoTileProps> = ({
  tile,
  onTap,
  disabled = false,
  isShaking = false,
}) => {
  const { isClaimed, claimedPlayer, definition } = tile;

  // Stamped Claimed State
  if (isClaimed && claimedPlayer) {
    return (
      <div
        className="relative aspect-square w-full rounded-xl border-2 border-[#8A9A5B] bg-[#8A9A5B]/10 shadow-[3px_3px_0px_#8A9A5B] overflow-hidden select-none transition-transform"
        dir="rtl"
      >
        {/* Footballer Stamped Photo */}
        <img
          src={claimedPlayer.photo}
          alt={claimedPlayer.name}
          className="absolute inset-0 w-full h-full object-cover brightness-[0.92] contrast-[1.05]"
          onError={(e) => {
            // High-contrast fallback if photo fails
            (e.target as HTMLElement).style.display = 'none';
          }}
        />

        {/* Gradient Overlay for Legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#2C2A29]/90 via-transparent to-black/30" />

        {/* Checkmark Stamp Badge */}
        <div className="absolute top-1.5 right-1.5 w-5 h-5 md:w-6 md:h-6 rounded-full bg-[#8A9A5B] text-white flex items-center justify-center border border-[#2C2A29] shadow-[1px_1px_0px_#2C2A29]">
          <Check size={13} strokeWidth={3} />
        </div>

        {/* Player Name Tag */}
        <div className="absolute bottom-1 inset-x-1 text-center px-1">
          <span className="text-[10px] md:text-xs font-black text-white block truncate leading-tight drop-shadow-md">
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
      className={`relative aspect-square w-full rounded-xl border-2 border-[#2C2A29] bg-[#F7F4EC] shadow-[3px_3px_0px_#2C2A29] flex items-center justify-center p-1 select-none transition-all ${
        disabled
          ? 'opacity-60 cursor-not-allowed'
          : 'hover:bg-[#E5E0D5] active:translate-y-0.5 active:shadow-[1px_1px_0px_#2C2A29] cursor-pointer'
      } ${isShaking ? 'ring-2 ring-red-500 animate-[wiggle_0.3s_ease-in-out]' : ''}`}
      dir="rtl"
    >
      <BingoIconRenderer definition={definition} size="sm" />
    </button>
  );
};
