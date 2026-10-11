import React, { useState, useEffect } from 'react';

interface SafeEntityBadgeProps {
  id?: string;
  src: string;
  alt: string;
  fallbackText: string;
  fallbackColor?: string;
  className?: string;
}

export const SafeEntityBadge: React.FC<SafeEntityBadgeProps> = ({
  id,
  src,
  alt,
  fallbackText,
  fallbackColor = '#2C2A29',
  className = 'w-28 h-28 sm:w-36 sm:h-36'
}) => {
  const [imgError, setImgError] = useState(false);

  // Reset error state on src or id change
  useEffect(() => {
    setImgError(false);
  }, [src, id]);

  if (imgError || !src) {
    return (
      <div
        className={`${className} rounded-2xl border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] bg-[#F7F4EC] flex flex-col items-center justify-center p-3 text-center select-none`}
      >
        <div
          className="w-10 h-10 rounded-full border-2 border-[#2C2A29] mb-1 flex items-center justify-center font-black text-sm text-white"
          style={{ backgroundColor: fallbackColor }}
        >
          {fallbackText.slice(0, 2)}
        </div>
        <span className="font-black text-xs sm:text-sm text-[#2C2A29] leading-tight">
          {fallbackText}
        </span>
      </div>
    );
  }

  return (
    <div className={`${className} relative flex items-center justify-center p-2`}>
      <img
        key={`${id}_${src}`}
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        loading="eager"
        onError={() => setImgError(true)}
        className="w-full h-full object-contain drop-shadow-md select-none transition-transform duration-200"
      />
    </div>
  );
};
