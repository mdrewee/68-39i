// src/pages/ai/who-is-ai/components/VotingPad.tsx
import React, { useState } from 'react';
import { Suspect } from '../types';
import { getAvatarById } from '../avatars';
import { Flame, Car, Moon, Crosshair, Feather, Compass, Crown, Fish, User, Check, ShieldAlert } from 'lucide-react';

interface VotingPadProps {
  suspects: Suspect[];
  myAvatarId: string;
  hasVoted: boolean;
  onConfirmVote: (targetAvatarId: string) => void;
  isSubmitting?: boolean;
}

const renderAvatarIcon = (iconName: string) => {
  const iconProps = { className: "w-6 h-6 text-[#2C2A29]" };
  switch (iconName) {
    case 'Flame': return <Flame {...iconProps} />;
    case 'Car': return <Car {...iconProps} />;
    case 'Moon': return <Moon {...iconProps} />;
    case 'Crosshair': return <Crosshair {...iconProps} />;
    case 'Feather': return <Feather {...iconProps} />;
    case 'Compass': return <Compass {...iconProps} />;
    case 'Crown': return <Crown {...iconProps} />;
    case 'Fish': return <Fish {...iconProps} />;
    default: return <User {...iconProps} />;
  }
};

const hashSeed = (str: string): number => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return hash >>> 0;
};

export const VotingPad: React.FC<VotingPadProps> = ({
  suspects,
  myAvatarId,
  hasVoted,
  onConfirmVote,
  isSubmitting = false
}) => {
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);

  const orderedSuspects = React.useMemo(() => {
    return [...suspects].sort((a, b) => hashSeed(a.avatarId) - hashSeed(b.avatarId));
  }, [suspects]);

  if (hasVoted) {
    const chosenSuspect = suspects.find((s) => s.avatarId === selectedAvatarId);
    const chosenAvatar = chosenSuspect ? getAvatarById(chosenSuspect.avatarId) : null;

    return (
      <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-4 my-auto">
        <div className="w-14 h-14 rounded-full bg-[#8A9A5B]/20 border-2 border-[#8A9A5B] flex items-center justify-center">
          <Check className="w-8 h-8 text-[#8A9A5B] stroke-[3]" />
        </div>
        <h3 className="text-xl font-black text-[#2C2A29]">تم تأكيد تصويتك بنجاح!</h3>
        {chosenAvatar && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-[#2C2A29] text-sm font-bold"
            style={{ backgroundColor: chosenAvatar.bgTone }}
          >
            {renderAvatarIcon(chosenAvatar.iconName)}
            <span>صوتك ضد: {chosenAvatar.name}</span>
          </div>
        )}
        <p className="text-xs font-bold text-stone-600 mt-2">
          تابع شاشة التلفزيون.. روليت الكشف سيبدأ قريباً!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full justify-between gap-4">
      <div className="text-right">
        <h2 className="text-lg font-black text-[#2C2A29]">مين الـ AI فينا؟</h2>
        <p className="text-xs font-bold text-stone-600">
          اختر الأفاتار اللي تشك إنه روبوت مندس، ثم اضغط تأكيد:
        </p>
      </div>

      {/* Suspects Grid */}
      <div className="grid grid-cols-2 gap-3 flex-1 overflow-y-auto p-1">
        {orderedSuspects.map((suspect) => {
          const avatar = getAvatarById(suspect.avatarId);
          const isMe = suspect.avatarId === myAvatarId;
          const isSelected = selectedAvatarId === suspect.avatarId;

          return (
            <button
              key={suspect.avatarId}
              disabled={isMe}
              onClick={() => setSelectedAvatarId(suspect.avatarId)}
              className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all text-center relative ${
                isMe
                  ? 'opacity-40 bg-stone-200 border-dashed border-stone-400 cursor-not-allowed'
                  : isSelected
                  ? 'bg-white border-[#8A9A5B] ring-2 ring-[#8A9A5B] shadow-[4px_4px_0px_#8A9A5B] -translate-y-0.5'
                  : 'bg-[#F7F4EC] border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] hover:bg-stone-50'
              }`}
            >
              {isMe && (
                <span className="absolute top-2 right-2 bg-stone-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  أنت
                </span>
              )}

              {isSelected && !isMe && (
                <span className="absolute top-2 right-2 bg-[#8A9A5B] text-white p-0.5 rounded-full">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </span>
              )}

              <div
                className="w-12 h-12 rounded-xl border-2 border-[#2C2A29] flex items-center justify-center"
                style={{ backgroundColor: avatar.bgTone }}
              >
                {renderAvatarIcon(avatar.iconName)}
              </div>

              <span className="text-sm font-black text-[#2C2A29]">
                {avatar.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Confirmation Button */}
      <button
        onClick={() => {
          if (selectedAvatarId) {
            onConfirmVote(selectedAvatarId);
          }
        }}
        disabled={!selectedAvatarId || isSubmitting}
        className={`w-full py-3.5 px-4 rounded-xl border-2 border-[#2C2A29] font-black text-base flex items-center justify-center gap-2 shadow-[4px_4px_0px_#2C2A29] transition-all ${
          selectedAvatarId && !isSubmitting
            ? 'bg-[#8A9A5B] text-white hover:bg-[#7b8a51] active:translate-y-0.5'
            : 'bg-stone-300 text-stone-500 cursor-not-allowed'
        }`}
      >
        <ShieldAlert className="w-5 h-5" />
        {isSubmitting
          ? 'جاري تأكيد الصوت...'
          : selectedAvatarId
          ? 'تأكيد التصويت على هذا المشتبه'
          : 'حدد مشتبه به أولاً'}
      </button>
    </div>
  );
};
