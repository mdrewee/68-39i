import React, { FC } from 'react';
import { FootballPlayer } from '../../../../data/footballMasterData';
import { DraftPosition } from '../types';
import { Shield, User, Award } from 'lucide-react';

interface SecretPitchDrawerProps {
  picks: Record<DraftPosition, FootballPlayer | null>;
  activePosition?: DraftPosition;
}

export const SecretPitchDrawer: FC<SecretPitchDrawerProps> = ({ picks, activePosition }) => {
  const slots: { pos: DraftPosition; label: string }[] = [
    { pos: 'FWD', label: 'مهاجم' },
    { pos: 'MID', label: 'وسط' },
    { pos: 'DEF', label: 'مدافع' },
    { pos: 'GK', label: 'حارس' },
    { pos: 'WILDCARD', label: 'جوكر' },
  ];

  return (
    <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl p-3">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E5E0D5]">
        <span className="text-xs font-black text-[#2C2A29] flex items-center gap-1.5">
          <Shield size={14} className="text-[#8A9A5B]" />
          تشكيلتي السرية
        </span>
        <span className="text-[10px] font-bold text-[#5C4033]">
          {Object.values(picks).filter(Boolean).length}/5 عناصر
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {slots.map(({ pos, label }) => {
          const player = picks[pos];
          const isActive = activePosition === pos;

          return (
            <div
              key={pos}
              className={`rounded-xl border-2 p-1.5 flex flex-col items-center justify-center text-center transition-all min-h-[72px] ${
                player
                  ? 'bg-[#8A9A5B] border-[#2C2A29] text-[#F7F4EC] shadow-[1px_1px_0px_#2C2A29]'
                  : isActive
                  ? 'bg-[#E5E0D5] border-[#8A9A5B] border-dashed text-[#2C2A29]'
                  : 'bg-[#E5E0D5] border-[#2C2A29] text-[#5C4033] opacity-75'
              }`}
            >
              <span className="text-[9px] font-black uppercase tracking-wider mb-1">
                {label}
              </span>

              {player ? (
                <>
                  <div className="w-7 h-7 rounded-full bg-white text-[#2C2A29] border border-[#2C2A29] flex items-center justify-center text-[10px] font-black overflow-hidden shrink-0">
                    {player.photo ? (
                      <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
                    ) : (
                      <User size={14} />
                    )}
                  </div>
                  <span className="text-[10px] font-black leading-tight mt-1 truncate max-w-full">
                    {player.name}
                  </span>
                </>
              ) : (
                <div className="w-7 h-7 rounded-full border border-dashed border-[#2C2A29] flex items-center justify-center text-xs font-black text-[#5C4033]">
                  ؟
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
