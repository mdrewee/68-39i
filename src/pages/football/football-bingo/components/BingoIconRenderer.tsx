import React, { FC } from 'react';
import { BingoTileDefinition } from '../../../../data/footballBingoData';

export interface BingoIconRendererProps {
  definition: BingoTileDefinition;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BingoIconRenderer: FC<BingoIconRendererProps> = ({
  definition,
  size = 'md',
  className = '',
}) => {
  const { category, iconUrl, label } = definition;

  const isImageUrl = iconUrl && (iconUrl.startsWith('http://') || iconUrl.startsWith('https://'));

  const containerDimensions = size === 'lg'
    ? 'w-14 h-14 md:w-16 md:h-16'
    : size === 'sm'
    ? 'w-8 h-8 md:w-9 md:h-9'
    : 'w-9 h-9 sm:w-11 sm:h-11';

  // 1. High-Res Image Asset (Club Logo, National Flag, Trophy, Manager Headshot, Dark Skin)
  if (isImageUrl) {
    const isPortrait = category === 'manager' || category === 'trait';
    const isFlag = category === 'country';

    return (
      <div className={`flex flex-col items-center justify-between select-none w-full h-full ${className}`}>
        <div
          className={`${containerDimensions} flex items-center justify-center shrink-0 my-auto ${
            isPortrait
              ? 'rounded-full overflow-hidden border border-[#2C2A29] shadow-[1px_1px_0px_#2C2A29] bg-[#E5E0D5]'
              : isFlag
              ? 'rounded-md overflow-hidden border border-[#2C2A29]/30 shadow-[1px_1px_0px_#2C2A29]'
              : 'object-contain'
          }`}
        >
          <img
            src={iconUrl}
            alt={label}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            loading="eager"
            className={`w-full h-full ${isPortrait ? 'object-cover' : 'object-contain'} drop-shadow-sm`}
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.includes('wsrv.nl')) {
                target.src = `https://wsrv.nl/?url=${encodeURIComponent(iconUrl)}&w=300&output=webp`;
              }
            }}
          />
        </div>
        <div className="w-full text-center px-0.5 bg-[#E5E0D5]/60 rounded py-0.5 mt-auto">
          <span className="text-[11px] sm:text-xs font-black text-[#2C2A29] block truncate leading-tight">
            {label}
          </span>
        </div>
      </div>
    );
  }

  // 2. Positions, Shirt Numbers, and Physical Traits (Emojis / Badges)
  return (
    <div className={`flex flex-col items-center justify-between select-none w-full h-full ${className}`}>
      <div className={`${containerDimensions} flex items-center justify-center shrink-0 my-auto`}>
        <span className={`${size === 'lg' ? 'text-3xl md:text-4xl' : size === 'sm' ? 'text-xl' : 'text-2xl sm:text-3xl'} select-none leading-none filter drop-shadow-sm`}>
          {iconUrl}
        </span>
      </div>
      <div className="w-full text-center px-0.5 bg-[#E5E0D5]/60 rounded py-0.5 mt-auto">
        <span className="text-[11px] sm:text-xs font-black text-[#2C2A29] block truncate leading-tight">
          {label}
        </span>
      </div>
    </div>
  );
};
