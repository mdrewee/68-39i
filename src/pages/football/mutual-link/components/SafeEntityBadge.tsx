import React, { useState, FC } from 'react';

export interface SafeEntityBadgeProps {
  src?: string;
  name: string;
  alt?: string;
  className?: string;
  type?: 'club' | 'player';
}

export const SafeEntityBadge: FC<SafeEntityBadgeProps> = ({
  src,
  name,
  alt,
  className = 'w-full h-full object-contain',
  type = 'club',
}) => {
  const [hasError, setHasError] = useState(false);
  const [triedProxy, setTriedProxy] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src || '');

  const handleError = () => {
    if (!triedProxy && currentSrc && !currentSrc.includes('wsrv.nl') && !currentSrc.startsWith('data:')) {
      setTriedProxy(true);
      setCurrentSrc(`https://wsrv.nl/?url=${encodeURIComponent(currentSrc)}&w=250&output=webp`);
    } else {
      setHasError(true);
    }
  };

  if (hasError || !currentSrc) {
    // Brutalist Off-White #F7F4EC text badge fallback with bold club/player text
    return (
      <div className="w-full h-full bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-xl flex flex-col items-center justify-center p-2 text-center select-none shadow-[2px_2px_0px_#2C2A29]">
        <div className="w-8 h-8 rounded-full bg-[#8A9A5B] border border-[#2C2A29] flex items-center justify-center text-sm font-black text-[#F7F4EC] mb-1">
          {type === 'club' ? '🛡️' : '⚽'}
        </div>
        <span className="font-black text-xs md:text-sm text-[#2C2A29] leading-tight line-clamp-2">
          {name}
        </span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt || name}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      loading="eager"
      onError={handleError}
      className={className}
    />
  );
};
