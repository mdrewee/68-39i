import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { sound } from '../../lib/audio';

interface MobileReadyButtonProps {
  isReady: boolean;
  onToggle: () => void;
  className?: string;
}

export const MobileReadyButton: React.FC<MobileReadyButtonProps> = ({
  isReady,
  onToggle,
  className = '',
}) => {
  const [bumping, setBumping] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick();
    setBumping(true);
    setTimeout(() => setBumping(false), 180);
    onToggle();
  };

  return (
    <div className={`flex flex-col items-center justify-center my-3 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        className={`w-36 h-36 rounded-full flex flex-col items-center justify-center font-black text-center transition-all duration-150 select-none cursor-pointer ${
          bumping ? 'scale-95' : 'scale-100'
        } ${
          isReady
            ? 'translate-y-2 bg-stone-400 text-stone-800 border-4 border-[#2C2A29] shadow-[0_2px_0_#2C2A29]'
            : 'bg-[#8A9A5B] hover:bg-[#7D8D50] text-white border-4 border-[#2C2A29] shadow-[0_8px_0_#2C2A29] hover:-translate-y-1 active:translate-y-2 active:shadow-[0_2px_0_#2C2A29]'
        }`}
      >
        {isReady ? (
          <>
            <Check className="w-8 h-8 mb-1 stroke-[3.5]" />
            <span className="text-xs font-black leading-tight px-2">بانتظار باقي اللاعبين</span>
            <span className="text-[10px] text-stone-700 font-bold mt-0.5">(اضغط للإلغاء)</span>
          </>
        ) : (
          <>
            <span className="text-3xl font-black font-display tracking-wide">جاهز</span>
            <span className="text-[11px] font-bold text-white/90 mt-1">اضغط للتأكيد</span>
          </>
        )}
      </button>
    </div>
  );
};
