// src/pages/ai/who-is-ai/components/VerticalSinglePageQABoard.tsx
import React from 'react';
import { QuestionItem, AnswerItem } from '../types';

interface VerticalSinglePageQABoardProps {
  questions: (QuestionItem | any)[];
  answers: (AnswerItem | any)[];
  highlightAiAvatar?: string;
  realNamesMap?: Record<string, string>;
}

export const VerticalSinglePageQABoard: React.FC<VerticalSinglePageQABoardProps> = ({
  questions,
  answers,
  highlightAiAvatar,
  realNamesMap
}) => {
  // Deterministic shuffle per question to decouple presentation from submission time
  const getShuffledAnswers = (list: any[], questionId: string) => {
    return [...list].sort((a, b) => {
      const respA = a.responderAvatar || a.responderAvatarName || a.responderAvatarId || '';
      const respB = b.responderAvatar || b.responderAvatarName || b.responderAvatarId || '';
      const hashA = hashString(`${questionId}-${respA}`);
      const hashB = hashString(`${questionId}-${respB}`);
      return hashA - hashB;
    });
  };

  const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  };

  if (!questions || questions.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-8 text-center max-w-md">
          <p className="text-xl font-bold text-[#2C2A29]">في انتظار اكتمال طرح الأسئلة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto space-y-6 px-4 py-2" dir="rtl">
      {questions.map((q, idx) => {
        const questionText = q.questionText || q.text || '';
        const askerAvatar = q.askerAvatar || q.askerAvatarName || 'مشتبه';
        const questionAnswers = answers.filter((a) => a.questionId === q.id);
        const shuffled = getShuffledAnswers(questionAnswers, q.id);

        return (
          <div
            key={q.id}
            className="w-full bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-5"
          >
            {/* Question Header ON TOP */}
            <div className="border-b-2 border-[#2C2A29]/15 pb-3 mb-4 flex justify-between items-start gap-4">
              <div>
                <span className="inline-block bg-[#C68B59] text-white text-xs font-black px-3 py-1 rounded-lg border border-[#2C2A29] mb-1.5 shadow-[2px_2px_0px_#2C2A29]">
                  سؤال {idx + 1}
                </span>
                <h2 className="text-xl md:text-2xl font-black text-[#2C2A29] leading-snug">
                  "{questionText}"
                </h2>
              </div>
              <span className="text-xs font-bold text-[#5C4033] bg-[#E5E0D5] px-3 py-1 rounded-lg border border-[#2C2A29] shrink-0">
                السائل: {askerAvatar}
              </span>
            </div>

            {/* Answers Grid UNDERNEATH */}
            {shuffled.length === 0 ? (
              <p className="text-xs font-bold text-stone-500 py-2">جاري جمع الإجابات...</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {shuffled.map((ans) => {
                  const responderAvatar = ans.responderAvatar || ans.responderAvatarName || 'مشتبه';
                  const responderId = ans.responderAvatarId || ans.responderAvatar;
                  const answerText = ans.answerText || ans.text || '';
                  const isAi = highlightAiAvatar && (responderAvatar === highlightAiAvatar || responderId === highlightAiAvatar);
                  const realName = realNamesMap
                    ? realNamesMap[responderAvatar] || (responderId ? realNamesMap[responderId] : null)
                    : null;

                  return (
                    <div
                      key={`${ans.questionId}-${responderAvatar}`}
                      className={`p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between ${
                        isAi
                          ? 'bg-[#C68B59]/20 border-[#C68B59] shadow-[3px_3px_0px_#C68B59]'
                          : 'bg-white border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29]'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-black text-xs text-[#2C2A29] bg-[#E5E0D5] px-2 py-0.5 rounded border border-[#2C2A29]">
                            {responderAvatar}
                          </span>
                          {isAi && (
                            <span className="text-[10px] font-black bg-[#C68B59] text-white px-2 py-0.5 rounded">
                              الروبوت المندس
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-[#2C2A29] leading-relaxed break-words">
                          {answerText}
                        </p>
                      </div>

                      {realName && (
                        <div className="mt-2 pt-1.5 border-t border-[#2C2A29]/10 text-[11px] font-black text-[#5C4033]">
                          اللاعب: {realName}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
