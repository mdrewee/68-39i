// src/pages/ai/who-is-ai/components/MobileSwipeCards.tsx
import React, { useState, useRef } from 'react';
import { QuestionItem } from '../types';

interface MobileSwipeCardsProps {
  questions: (QuestionItem | any)[];
  myAvatar: string;
  onSubmitAll: (answersMap: Record<string, string>) => void;
}

export const MobileSwipeCards: React.FC<MobileSwipeCardsProps> = ({
  questions,
  myAvatar,
  onSubmitAll
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState<Record<string, string>>({});
  
  // Touch Drag State
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const total = questions?.length || 0;
  if (!questions || total === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center text-[#2C2A29] font-bold">
        لا توجد أسئلة متاحة حالياً
      </div>
    );
  }

  const currentQ = questions[currentIndex] || questions[0];
  const qText = currentQ.questionText || currentQ.text || '';
  const askerName = currentQ.askerAvatar || currentQ.askerAvatarName || 'مشتبه';
  const answeredCount = Object.values(answersMap).filter((v) => v && v.trim().length > 0 && v.trim() !== '—').length;

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;
    // Dampen drag past bounds
    if ((currentIndex === 0 && diff > 0) || (currentIndex === total - 1 && diff < 0)) {
      setDragOffset(diff * 0.3);
    } else {
      setDragOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // Swipe threshold (60px)
    // RTL: Drag Left (negative diff) -> Next Card, Drag Right (positive diff) -> Previous Card
    if (dragOffset < -60 && currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (dragOffset > 60 && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
    setDragOffset(0);
  };

  const handleFinalSubmit = () => {
    // Fill all unwritten answers with "—"
    const finalMap: Record<string, string> = {};
    questions.forEach((q) => {
      finalMap[q.id] = (answersMap[q.id] || '').trim() || '—';
    });
    onSubmitAll(finalMap);
  };

  return (
    <div className="flex flex-col h-full justify-between p-4 bg-[#E5E0D5] select-none" dir="rtl">
      {/* Top Bar with Avatar & Dots */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold text-[#5C4033] bg-[#F7F4EC] px-3 py-1 rounded-xl border border-[#2C2A29]">
            أنت: [{myAvatar}]
          </span>
          <span className="text-xs font-black bg-[#C68B59] text-white px-3 py-1 rounded-xl border border-[#2C2A29]">
            {currentIndex + 1} من {total}
          </span>
        </div>

        {/* Progress Dots Indicator */}
        <div className="flex justify-center gap-1.5 mb-2">
          {questions.map((q, idx) => {
            const hasAns = (answersMap[q.id] || '').trim().length > 0 && (answersMap[q.id] || '').trim() !== '—';
            return (
              <button
                key={q.id || idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentIndex
                    ? 'w-6 bg-[#2C2A29]'
                    : hasAns
                    ? 'w-2 bg-[#8A9A5B]'
                    : 'w-2 bg-[#C68B59]/40'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Swipeable Container */}
      <div
        className="flex-1 flex flex-col justify-between bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-5 mb-3 transition-transform duration-150 ease-out"
        style={{
          transform: `translateX(${dragOffset}px)`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black bg-[#E5E0D5] text-[#2C2A29] px-2.5 py-0.5 rounded border border-[#2C2A29]">
              سؤال {currentIndex + 1}
            </span>
            <span className="text-xs font-bold text-[#5C4033]">
              السائل: {askerName}
            </span>
          </div>

          <h2 className="text-xl font-black text-[#2C2A29] leading-relaxed mt-2">
            {qText}
          </h2>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-black text-[#5C4033] mb-1.5">
            إجابتك (اسحب يمين ويسار للتنقل):
          </label>
          <textarea
            rows={3}
            placeholder="اكتب ردك هنا بكلمات بسيطة..."
            value={answersMap[currentQ.id] || ''}
            onChange={(e) =>
              setAnswersMap({ ...answersMap, [currentQ.id]: e.target.value })
            }
            className="w-full p-3 rounded-xl border-2 border-[#2C2A29] bg-white text-[#2C2A29] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#8A9A5B] resize-none"
          />
        </div>
      </div>

      {/* Navigation Controls & Action */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => currentIndex > 0 && setCurrentIndex((prev) => prev - 1)}
            disabled={currentIndex === 0}
            className="w-full py-3 bg-[#F7F4EC] text-[#2C2A29] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl font-black text-sm disabled:opacity-30 cursor-pointer"
          >
            السابق
          </button>
          <button
            type="button"
            onClick={() => currentIndex < total - 1 && setCurrentIndex((prev) => prev + 1)}
            disabled={currentIndex === total - 1}
            className="w-full py-3 bg-[#F7F4EC] text-[#2C2A29] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl font-black text-sm disabled:opacity-30 cursor-pointer"
          >
            التالي
          </button>
        </div>

        <button
          type="button"
          onClick={handleFinalSubmit}
          className="w-full py-3.5 bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-xl font-black text-base active:translate-y-0.5 cursor-pointer"
        >
          تسليم الإجابات ({answeredCount}/{total})
        </button>
      </div>
    </div>
  );
};
