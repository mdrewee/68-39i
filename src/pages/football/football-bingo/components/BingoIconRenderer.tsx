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

  const imgDimensions = {
    sm: 'w-7 h-7 md:w-8 md:h-8',
    md: 'w-10 h-10 md:w-11 md:h-11',
    lg: 'w-14 h-14 md:w-16 md:h-16',
  }[size];

  // 1. High-Res Image Asset (Club Logo, National Flag, Trophy, Manager Headshot)
  if (isImageUrl) {
    const isManager = category === 'manager';
    const isFlag = category === 'country';

    return (
      <div className={`flex flex-col items-center justify-center select-none w-full h-full p-0.5 ${className}`}>
        <div
          className={`${imgDimensions} flex items-center justify-center shrink-0 ${
            isManager
              ? 'rounded-full overflow-hidden border border-[#2C2A29] shadow-[1px_1px_0px_#2C2A29] bg-[#E5E0D5]'
              : isFlag
              ? 'rounded-md overflow-hidden border border-[#2C2A29]/30 shadow-[1px_1px_0px_#2C2A29]'
              : ''
          }`}
        >
          <img
            src={iconUrl}
            alt={label}
            loading="eager"
            className={`w-full h-full ${isManager ? 'object-cover' : 'object-contain'} drop-shadow-sm`}
            onError={(e) => {
              // Graceful text badge fallback if remote image is blocked
              const target = e.target as HTMLElement;
              target.style.display = 'none';
            }}
          />
        </div>
        <span className="text-[9px] md:text-[10px] font-black text-[#2C2A29] mt-1 text-center truncate max-w-full px-0.5 leading-tight">
          {label}
        </span>
      </div>
    );
  }

  // 2. Positions, Shirt Numbers, and Physical Traits (Emojis / Badges)
  return (
    <div className={`flex flex-col items-center justify-center select-none w-full h-full p-0.5 ${className}`}>
      <span className={`${size === 'lg' ? 'text-3xl md:text-4xl' : size === 'sm' ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'} select-none leading-none filter drop-shadow-sm`}>
        {iconUrl}
      </span>
      <span className="text-[9px] md:text-[10px] font-black text-[#2C2A29] mt-1 text-center truncate max-w-full px-0.5 leading-tight">
        {label}
      </span>
    </div>
  );
};
