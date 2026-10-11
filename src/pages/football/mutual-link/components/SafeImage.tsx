import React, { FC } from 'react';

export interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const SafeImage: FC<SafeImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-contain',
}) => {
  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      loading="eager"
      onError={(e) => {
        const img = e.currentTarget;
        if (!img.src.includes('wsrv.nl') && !img.src.startsWith('data:')) {
          img.src = `https://wsrv.nl/?url=${encodeURIComponent(src)}&w=250&output=webp`;
        } else {
          img.src = '/assets/football/default-club.svg';
        }
      }}
      className={className}
    />
  );
};
