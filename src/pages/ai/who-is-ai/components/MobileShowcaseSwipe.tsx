// src/pages/ai/who-is-ai/components/MobileShowcaseSwipe.tsx
import React, { useState, useRef } from 'react';
import { QuestionItem, AnswerItem } from '../types';

interface MobileShowcaseSwipeProps {
  questions: QuestionItem[];
  answers: AnswerItem[];
  myAvatar: string;
}

export const MobileShowcaseSwipe: React.FC<MobileShowcaseSwipeProps> = ({
  questions,
  answers,
  myAvatar
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const total = questions.length;
  const currentQ = questions[currentIndex] || { id: '', questionText: '', askerAvatar: '' };
  const questionAnswers = answers.filter((a) => a.questionId === currentQ.id);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;
    if ((currentIndex === 0 && diff > 0) || (currentIndex === total - 1 && diff < 0)) {
      setDragOffset(diff * 0.3);
    } else {
      setDragOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // Swipe Threshold: 50px
    if (dragOffset < -50 && currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1); // RTL Next
    } else if (dragOffset > 50 && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1); // RTL Prev
    }
    setDragOffset(0);
  };

  if (!questions || questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center p-6 bg-[#F7F4EC] rounded-2xl border-2 border-[#2C2A29]">
        <p className="font-bold text-[#5C4033]">جاري تجهيز استعراض الإجابات...</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full justify-between p-3 bg-[#E5E0D5] select-none"
      dir="rtl"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header with Navigation Indicator */}
      <div className="mb-2">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-bold text-[#5C4033] bg-[#F7F4EC] px-3 py-1 rounded-xl border border-[#2C2A29]">
            أنت: [{myAvatar || 'أفاتار سري'}]
          </span>
          <span className="text-xs font-black bg-[#C68B59] text-white px-3 py-1 rounded-xl border border-[#2C2A29]">
            سؤال {currentIndex + 1} من {total}
          </span>
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-1.5">
          {questions.map((q, idx) => (
            <button
              key={q.id || idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentIndex ? 'w-6 bg-[#2C2A29]' : 'w-2 bg-[#C68B59]/40'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Swipeable Card */}
      <div
        className="flex-1 flex flex-col bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4 mb-2 overflow-hidden transition-transform duration-150 ease-out"
        style={{
          transform: `translateX(${dragOffset}px)`
        }}
      >
        {/* Question on Top */}
        <div className="border-b-2 border-[#2C2A29]/15 pb-2.5 mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-black bg-[#E5E0D5] text-[#2C2A29] px-2 py-0.5 rounded border border-[#2C2A29]">
              سؤال {currentIndex + 1}
            </span>
            <span className="text-[11px] font-bold text-[#5C4033]">
              السائل: {currentQ.askerAvatar || (currentQ as any).askerAvatarName || 'مجهول'}
            </span>
          </div>
          <h3 className="text-base font-black text-[#2C2A29] leading-snug">
            {currentQ.questionText || currentQ.text}
          </h3>
        </div>

        {/* Avatars & Answers List Underneath */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          <span className="text-[11px] font-black text-[#5C4033] block">
            إجابات الأفاتارات على هذا السؤال:
          </span>

          {questionAnswers.map((ans, aIdx) => (
            <div
              key={`${ans.questionId}-${ans.responderAvatar || aIdx}`}
              className="bg-white border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl p-2.5"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-black bg-[#E5E0D5] text-[#2C2A29] px-2 py-0.5 rounded border border-[#2C2A29]">
                  {ans.responderAvatar || (ans as any).responderAvatarName}
                </span>
                {ans.responderAvatar === myAvatar && (
                  <span className="text-[10px] font-black text-[#8A9A5B]">
                    (جوابك أنت)
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-[#2C2A29] leading-relaxed break-words">
                {ans.answerText || ans.text}
              </p>
            </div>
          ))}
          {questionAnswers.length === 0 && (
            <p className="text-xs font-bold text-[#5C4033]/70 text-center py-4">
              لا توجد إجابات مسجلة بعد
            </p>
          )}
        </div>
      </div>

      {/* Swipe Navigation Footer Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => currentIndex > 0 && setCurrentIndex((p) => p - 1)}
          disabled={currentIndex === 0}
          className="py-2.5 bg-[#F7F4EC] text-[#2C2A29] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl font-black text-xs disabled:opacity-30"
        >
          السابق
        </button>
        <button
          onClick={() => currentIndex < total - 1 && setCurrentIndex((p) => p + 1)}
          disabled={currentIndex === total - 1}
          className="py-2.5 bg-[#F7F4EC] text-[#2C2A29] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl font-black text-xs disabled:opacity-30"
        >
          التالي (اسحب باللمس)
        </button>
      </div>
    </div>
  );
};
