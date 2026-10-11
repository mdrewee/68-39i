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
  const { category, targetValue, iconUrl, label } = definition;

  // Size mappings
  const iconDimensions = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10 md:w-11 md:h-11',
    lg: 'w-14 h-14 md:w-16 md:h-16',
  }[size];

  // ==========================================
  // 1. NATIONAL FLAGS
  // ==========================================
  if (category === 'country') {
    const flagEmojis: Record<string, string> = {
      SA: '🇸🇦',
      BR: '🇧🇷',
      AR: '🇦🇷',
      FR: '🇫🇷',
      PT: '🇵🇹',
      ES: '🇪🇸',
      'GB-ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      DE: '🇩🇪',
      NL: '🇳🇱',
      HR: '🇭🇷',
      MA: '🇲🇦',
      EG: '🇪🇬',
    };
    const emoji = flagEmojis[iconUrl] || '⚽';
    return (
      <div className={`flex flex-col items-center justify-center select-none ${className}`}>
        <span className={`${size === 'lg' ? 'text-4xl md:text-5xl' : size === 'sm' ? 'text-2xl' : 'text-3xl md:text-4xl'} filter drop-shadow-sm`}>
          {emoji}
        </span>
        <span className="text-[10px] md:text-xs font-bold text-[#5C4033] mt-1 text-center truncate max-w-full">
          {label}
        </span>
      </div>
    );
  }

  // ==========================================
  // 2. SHIRT NUMBERS
  // ==========================================
  if (category === 'number') {
    return (
      <div className={`flex flex-col items-center justify-center select-none ${className}`}>
        <div className="relative flex items-center justify-center">
          {/* Football Kit Jersey SVG */}
          <svg className={`${iconDimensions} text-[#C68B59] drop-shadow-sm`} viewBox="0 0 64 64" fill="currentColor">
            <path d="M22 6 L12 16 L18 24 L22 20 L22 56 L42 56 L42 20 L46 24 L52 16 L42 6 L36 12 C34 14 30 14 28 12 Z" stroke="#2C2A29" strokeWidth="2.5" />
          </svg>
          <span className="absolute font-black text-white text-base md:text-lg tracking-tighter" style={{ top: '48%', transform: 'translateY(-50%)' }}>
            {targetValue}
          </span>
        </div>
        <span className="text-[10px] md:text-xs font-black text-[#2C2A29] mt-1">
          رقم {targetValue}
        </span>
      </div>
    );
  }

  // ==========================================
  // 3. POSITIONS
  // ==========================================
  if (category === 'position') {
    const posColors: Record<string, { bg: string; text: string; sub: string }> = {
      GK: { bg: 'bg-amber-100 border-amber-800', text: 'text-amber-900', sub: 'حارس مرمى' },
      DEF: { bg: 'bg-blue-100 border-blue-800', text: 'text-blue-900', sub: 'مدافع' },
      MID: { bg: 'bg-emerald-100 border-emerald-800', text: 'text-emerald-900', sub: 'لاعب وسط' },
      FWD: { bg: 'bg-rose-100 border-rose-800', text: 'text-rose-900', sub: 'مهاجم' },
    };
    const current = posColors[targetValue as string] || { bg: 'bg-gray-100 border-gray-800', text: 'text-gray-900', sub: 'مركز' };

    return (
      <div className={`flex flex-col items-center justify-center select-none ${className}`}>
        <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl border-2 flex items-center justify-center font-black text-sm md:text-base shadow-[2px_2px_0px_#2C2A29] ${current.bg} ${current.text}`}>
          {targetValue}
        </div>
        <span className="text-[10px] md:text-xs font-bold text-[#5C4033] mt-1">
          {current.sub}
        </span>
      </div>
    );
  }

  // ==========================================
  // 4. TROPHIES
  // ==========================================
  if (category === 'trophy') {
    return (
      <div className={`flex flex-col items-center justify-center select-none ${className}`}>
        <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] flex items-center justify-center text-amber-500">
          <svg className="w-6 h-6 md:w-7 md:h-7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 3h14v2H5V3zm2 4v2c0 2.21 1.79 4 4 4h2c2.21 0 4-1.79 4-4V7h2c1.1 0 2 .9 2 2v2c0 2.21-1.79 4-4 4h-.17C14.39 16.61 13 18.06 13 19v2h4v2H7v-2h4v-2c0-.94-1.39-2.39-1.83-4H9c-2.21 0-4-1.79-4-4V9c0-1.1.9-2 2-2h2zm-2 2H3V9c0-.55.45-1 1-1h1v1zm14 0h1c.55 0 1 .45 1 1v2c0 1.1-.9 2-2 2v-5z" />
          </svg>
        </div>
        <span className="text-[10px] md:text-xs font-bold text-[#2C2A29] mt-1 text-center truncate max-w-[70px]">
          {label}
        </span>
      </div>
    );
  }

  // ==========================================
  // 5. MANAGERS
  // ==========================================
  if (category === 'manager') {
    return (
      <div className={`flex flex-col items-center justify-center select-none ${className}`}>
        <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-[#E5E0D5] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] flex items-center justify-center text-[#2C2A29]">
          {/* Tactical Clipboard / Coach Whistle Icon */}
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>
        <span className="text-[10px] md:text-xs font-extrabold text-[#2C2A29] mt-1 text-center truncate max-w-[70px]">
          {label}
        </span>
      </div>
    );
  }

  // ==========================================
  // 6. TRAITS (Left Foot, Right Foot, Dark Skin)
  // ==========================================
  if (category === 'trait') {
    return (
      <div className={`flex flex-col items-center justify-center select-none ${className}`}>
        <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-[#8A9A5B]/20 border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] flex items-center justify-center text-[#2C2A29]">
          {targetValue === 'left_foot' ? (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m0 0l7 7m-7-7l7-7" />
            </svg>
          ) : targetValue === 'right_foot' ? (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0l-7-7m7 7l-7 7" />
            </svg>
          ) : (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
        </div>
        <span className="text-[10px] md:text-xs font-bold text-[#2C2A29] mt-1 text-center truncate max-w-[70px]">
          {label}
        </span>
      </div>
    );
  }

  // ==========================================
  // 7. CLUBS (BADGES)
  // ==========================================
  // Crisp stylized badge with club initials & primary team colors
  const clubColors: Record<string, { bg: string; text: string; code: string }> = {
    c_nassr: { bg: 'bg-[#FFEB3B]', text: 'text-[#0D47A1]', code: 'النصر' },
    c_hilal: { bg: 'bg-[#1565C0]', text: 'text-white', code: 'الهلال' },
    c_ittihad: { bg: 'bg-[#FBC02D]', text: 'text-black', code: 'الاتحاد' },
    c_ahli: { bg: 'bg-[#2E7D32]', text: 'text-white', code: 'الأهلي' },
    c_real_madrid: { bg: 'bg-white', text: 'text-[#1A237E]', code: 'ريال' },
    c_barcelona: { bg: 'bg-[#B71C1C]', text: 'text-[#FFD54F]', code: 'بارسا' },
    c_man_city: { bg: 'bg-[#64B5F6]', text: 'text-[#0D47A1]', code: 'سيتي' },
    c_man_united: { bg: 'bg-[#D32F2F]', text: 'text-white', code: 'يونايتد' },
    c_liverpool: { bg: 'bg-[#C62828]', text: 'text-[#FFD54F]', code: 'ليفربول' },
    c_bayern: { bg: 'bg-[#E53935]', text: 'text-white', code: 'بايرن' },
    c_psg: { bg: 'bg-[#0D47A1]', text: 'text-[#EF5350]', code: 'باريس' },
    c_juventus: { bg: 'bg-black', text: 'text-white', code: 'يوفي' },
    c_chelsea: { bg: 'bg-[#1976D2]', text: 'text-white', code: 'تشيلسي' },
    c_arsenal: { bg: 'bg-[#C62828]', text: 'text-white', code: 'أرسنال' },
  };

  const clubStyle = clubColors[iconUrl] || { bg: 'bg-[#8A9A5B]', text: 'text-white', code: label.slice(0, 4) };

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      {/* Shield Badge */}
      <div className={`w-10 h-10 md:w-11 md:h-11 rounded-lg border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] flex items-center justify-center font-black text-xs md:text-sm ${clubStyle.bg} ${clubStyle.text}`}>
        <span className="truncate px-0.5">{clubStyle.code}</span>
      </div>
      <span className="text-[10px] md:text-xs font-bold text-[#2C2A29] mt-1 text-center truncate max-w-[70px]">
        {label}
      </span>
    </div>
  );
};
