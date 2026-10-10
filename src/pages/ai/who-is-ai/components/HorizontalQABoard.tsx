// src/pages/ai/who-is-ai/components/HorizontalQABoard.tsx
import React from 'react';
import { RoomQuestion, RoomAnswer, Suspect } from '../types';
import { getAvatarById } from '../avatars';
import { Flame, Car, Moon, Crosshair, Feather, Compass, Crown, Fish, User, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface HorizontalQABoardProps {
  questions: RoomQuestion[];
  answers: RoomAnswer[];
  suspects: Suspect[];
  currentIndex: number;
  onSelectIndex?: (index: number) => void;
  isVotingPhase?: boolean;
  isRevealed?: boolean;
  aiAvatarId?: string;
  votesSummary?: Record<string, string[]>;
}

const renderAvatarIcon = (iconName: string) => {
  const iconProps = { className: "w-5 h-5 text-[#2C2A29]" };
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

export const HorizontalQABoard: React.FC<HorizontalQABoardProps> = ({
  questions,
  answers,
  suspects,
  currentIndex,
  onSelectIndex,
  isVotingPhase = false,
  isRevealed = false,
  aiAvatarId,
  votesSummary
}) => {
  if (!questions || questions.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-8 text-center max-w-md">
          <p className="text-xl font-bold text-[#2C2A29]">في انتظار اكتمال طرح الأسئلة...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex] || questions[0];
  const questionAnswers = answers
    .filter((a) => a.questionId === currentQuestion.id)
    .sort((a, b) => {
      const hashA = hashSeed(`${currentQuestion.id}_${a.responderAvatarId}`);
      const hashB = hashSeed(`${currentQuestion.id}_${b.responderAvatarId}`);
      return hashA - hashB;
    });

  // Asker details
  const askerAvatar = getAvatarById(currentQuestion.askerAvatarId);

  return (
    <div className="w-full flex flex-col h-full gap-4">
      {/* Top Question Tabs / Carousel Selector */}
      <div className="flex items-center justify-between bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {questions.map((q, idx) => {
            const isSelected = idx === currentIndex;
            return (
              <button
                key={q.id}
                onClick={() => onSelectIndex && onSelectIndex(idx)}
                className={`px-3 py-1.5 rounded-lg border-2 text-sm font-bold transition-colors flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-[#8A9A5B] text-white border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29]'
                    : 'bg-[#E5E0D5] text-[#2C2A29] border-[#2C2A29] hover:bg-[#dcd6ca]'
                }`}
              >
                <span>سؤال {idx + 1}</span>
              </button>
            );
          })}
        </div>

        {/* Stepper buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onSelectIndex && onSelectIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className={`p-1.5 rounded-lg border-2 border-[#2C2A29] transition-opacity ${
              currentIndex === 0 ? 'opacity-30 cursor-not-allowed bg-stone-200' : 'bg-[#F7F4EC] hover:bg-[#E5E0D5]'
            }`}
            title="السابق"
          >
            <ChevronRight className="w-5 h-5 text-[#2C2A29]" />
          </button>
          <span className="text-sm font-bold text-[#2C2A29] px-1">
            {currentIndex + 1} / {questions.length}
          </span>
          <button
            onClick={() => onSelectIndex && onSelectIndex(Math.min(questions.length - 1, currentIndex + 1))}
            disabled={currentIndex === questions.length - 1}
            className={`p-1.5 rounded-lg border-2 border-[#2C2A29] transition-opacity ${
              currentIndex === questions.length - 1 ? 'opacity-30 cursor-not-allowed bg-stone-200' : 'bg-[#F7F4EC] hover:bg-[#E5E0D5]'
            }`}
            title="التالي"
          >
            <ChevronLeft className="w-5 h-5 text-[#2C2A29]" />
          </button>
        </div>
      </div>

      {/* Main Horizontal Layout: Right 30% Question Card, Left 70% Answers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 flex-1 min-h-0">
        {/* Right 30% (lg:col-span-3 in RTL is the first column on right) */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-5 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="bg-[#C68B59] text-white border-2 border-[#2C2A29] px-3 py-1 rounded-lg text-xs font-bold tracking-wide">
                  السؤال {currentIndex + 1}
                </span>
                
                {/* Asker badge */}
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-[#2C2A29] text-xs font-bold text-[#2C2A29]"
                  style={{ backgroundColor: askerAvatar.bgTone }}
                >
                  {renderAvatarIcon(askerAvatar.iconName)}
                  <span>طرحه: {askerAvatar.name}</span>
                </div>
              </div>

              <h2 className="text-xl md:text-2xl font-black text-[#2C2A29] leading-relaxed text-right mt-2">
                "{currentQuestion.text}"
              </h2>
            </div>

            {isVotingPhase && (
              <div className="mt-4 bg-[#8A9A5B]/15 border-2 border-[#8A9A5B] rounded-xl p-3 text-right">
                <p className="text-xs font-bold text-[#2C2A29]">
                  لوحة التحقيق مفتوحة للمقارنة.. صوّتوا من الجوال على المشتبه به!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Left 70% (lg:col-span-7) Answers Grid */}
        <div className="lg:col-span-7 overflow-y-auto pr-1">
          {questionAnswers.length === 0 ? (
            <div className="h-full flex items-center justify-center p-8 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl">
              <p className="text-base font-bold text-stone-500">جاري جمع الإجابات لهذا السؤال...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {questionAnswers.map((ans) => {
                const responderAvatar = getAvatarById(ans.responderAvatarId);
                const isThisAi = isRevealed && ans.responderAvatarId === aiAvatarId;
                const voters = votesSummary ? votesSummary[ans.responderAvatarId] || [] : [];

                return (
                  <div
                    key={`${ans.questionId}-${ans.responderAvatarId}`}
                    className={`p-4 rounded-2xl border-2 border-[#2C2A29] transition-all flex flex-col justify-between ${
                      isThisAi
                        ? 'bg-[#FEF08A] shadow-[4px_4px_0px_#2C2A29] ring-2 ring-[#CA8A04]'
                        : 'bg-[#F7F4EC] shadow-[4px_4px_0px_#2C2A29]'
                    }`}
                  >
                    <div>
                      {/* Responder Header */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-[#2C2A29] text-xs font-bold text-[#2C2A29]"
                          style={{ backgroundColor: responderAvatar.bgTone }}
                        >
                          {renderAvatarIcon(responderAvatar.iconName)}
                          <span>{responderAvatar.name}</span>
                        </div>

                        {isThisAi && (
                          <span className="bg-[#2C2A29] text-[#FEF08A] px-2 py-0.5 rounded text-[11px] font-black">
                            إجابة الروبوت!
                          </span>
                        )}
                      </div>

                      {/* Answer Body */}
                      <p className="text-base md:text-lg font-bold text-[#2C2A29] leading-relaxed text-right py-1">
                        {ans.text}
                      </p>
                    </div>

                    {/* Reveal voter footer if revealed */}
                    {isRevealed && voters.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-[#2C2A29]/20 flex items-center justify-between text-xs">
                        <span className="font-bold text-stone-600">الأصوات ضده:</span>
                        <div className="flex flex-wrap gap-1">
                          {voters.map((voterName, vIdx) => (
                            <span
                              key={vIdx}
                              className="bg-[#E5E0D5] border border-[#2C2A29] px-1.5 py-0.5 rounded text-[11px] font-bold"
                            >
                              {voterName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
