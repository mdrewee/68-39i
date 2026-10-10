// src/pages/ai/who-is-ai/WhoIsAiMobileView.tsx
import React, { useState, useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { GamePhase, QuestionItem, AnswerItem } from './types';
import { MobileShowcaseSwipe } from './components/MobileShowcaseSwipe';
import { MobileSwipeCards } from './components/MobileSwipeCards';
import { GameTopBar } from './components/GameTopBar';

interface WhoIsAiMobileViewProps {
  roomCode: string;
  playerId: string;
  playerName: string;
  channel: RealtimeChannel;
  onLeaveRoom?: () => void;
}

export const WhoIsAiMobileView: React.FC<WhoIsAiMobileViewProps> = ({
  roomCode,
  playerId,
  playerName,
  channel,
  onLeaveRoom
}) => {
  const [phase, setPhase] = useState<GamePhase>('LOBBY');
  const [myAvatar, setMyAvatar] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [hasSubmittedQuestion, setHasSubmittedQuestion] = useState(false);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [answers, setAnswers] = useState<AnswerItem[]>([]);
  const [selectedVoteAvatar, setSelectedVoteAvatar] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [allAvatars, setAllAvatars] = useState<string[]>([]);

  useEffect(() => {
    if (!channel) return;

    // 1. Kick listener
    const kickSub = channel.on('broadcast', { event: 'KICK_PLAYER' }, ({ payload }) => {
      if (payload?.playerId === playerId) {
        alert('تم طردك من الغرفة بواسطة المضيف');
        if (onLeaveRoom) {
          onLeaveRoom();
        } else {
          window.location.href = '/';
        }
      }
    });

    // 2. Start Question Phase
    const handleStartQuestion = ({ payload }: { payload: any }) => {
      if (payload?.assignments && payload.assignments[playerId]) {
        const assigned = payload.assignments[playerId];
        setMyAvatar(typeof assigned === 'string' ? assigned : (assigned.name || assigned.avatarName || ''));
      }
      if (payload?.allAvatars) {
        setAllAvatars(payload.allAvatars);
      }
      setPhase('QUESTION_INPUT');
      setHasSubmittedQuestion(false);
      setQuestionText('');
    };

    channel.on('broadcast', { event: 'START_QUESTION_PHASE' }, handleStartQuestion);
    channel.on('broadcast', { event: 'START_QUESTIONS_PHASE' }, handleStartQuestion);

    // 3. Start Answering Phase
    const handleStartAnswering = ({ payload }: { payload: any }) => {
      console.log('[Mobile] Received questions for answering:', payload?.questions);
      if (payload?.questions && Array.isArray(payload.questions) && payload.questions.length > 0) {
        setQuestions(payload.questions);
      }
      if (payload?.answers && Array.isArray(payload.answers) && payload.answers.length > 0) {
        const normAnswers: AnswerItem[] = payload.answers.map((a: any) => ({
          questionId: a.questionId,
          responderAvatar: a.responderAvatar || a.responderAvatarName || '',
          answerText: a.answerText || a.text || ''
        }));
        setAnswers(normAnswers);
      }
      if (payload?.allAvatars) {
        setAllAvatars(payload.allAvatars);
      }
      setPhase('ANSWERING_SWIPE');
    };

    channel.on('broadcast', { event: 'START_ANSWERING_PHASE' }, handleStartAnswering);
    channel.on('broadcast', { event: 'START_ANSWERS_PHASE' }, handleStartAnswering);

    channel.on('broadcast', { event: 'START_SHOWCASE_PHASE' }, ({ payload }: { payload: any }) => {
      if (payload?.questions && Array.isArray(payload.questions) && payload.questions.length > 0) {
        setQuestions(payload.questions);
      }
      if (payload?.answers && Array.isArray(payload.answers) && payload.answers.length > 0) {
        setAnswers(payload.answers);
      }
      setPhase('SHOWCASE_BOARD');
    });

    // 4. Start Voting Phase
    const startVoteSub = channel.on('broadcast', { event: 'START_VOTING_PHASE' }, ({ payload }: { payload: any }) => {
      if (payload?.allAvatars) {
        setAllAvatars(payload.allAvatars);
      }
      if (payload?.questions && Array.isArray(payload.questions) && payload.questions.length > 0) {
        setQuestions(payload.questions);
      }
      if (payload?.answers && Array.isArray(payload.answers) && payload.answers.length > 0) {
        setAnswers(payload.answers);
      }
      setPhase('VOTING');
      setHasVoted(false);
      setSelectedVoteAvatar(null);
    });

    // 5. Reveal / Standings
    channel.on('broadcast', { event: 'ROULETTE_REVEAL' }, () => {
      setPhase('ROULETTE_REVEAL');
    });
    channel.on('broadcast', { event: 'START_REVEAL_PHASE' }, () => {
      setPhase('ROULETTE_REVEAL');
    });

    // 6. Return to Lobby
    const returnLobbySub = channel.on('broadcast', { event: 'RETURN_TO_LOBBY' }, () => {
      setPhase('LOBBY');
      setIsReady(false);
      setHasSubmittedQuestion(false);
      setHasVoted(false);
      setMyAvatar('');
      setAnswers([]);
    });

    // 7. Sync State on remount/subscribe
    const handleSync = ({ payload }: { payload: any }) => {
      if (payload?.playerAvatarMap && payload.playerAvatarMap[playerId]) {
        const myAvId = payload.playerAvatarMap[playerId];
        const matchSuspect = payload.suspects?.find((s: any) => s.avatarId === myAvId);
        if (matchSuspect) setMyAvatar(matchSuspect.avatarName);
      }
      if (payload?.assignments && payload.assignments[playerId]) {
        const assigned = payload.assignments[playerId];
        setMyAvatar(typeof assigned === 'string' ? assigned : (assigned.name || assigned.avatarName || ''));
      }
      if (payload?.allAvatars) {
        setAllAvatars(payload.allAvatars);
      }
      if (payload?.questions && Array.isArray(payload.questions) && payload.questions.length > 0) {
        setQuestions(payload.questions);
      }
      if (payload?.phase) {
        if (payload.phase === 'QUESTIONS' || payload.phase === 'QUESTION_INPUT') {
          setPhase('QUESTION_INPUT');
        } else if (payload.phase === 'ANSWERS' || payload.phase === 'ANSWERING_SWIPE') {
          setPhase('ANSWERING_SWIPE');
        } else if (payload.phase === 'SHOWCASE' || payload.phase === 'SHOWCASE_BOARD') {
          setPhase('SHOWCASE_BOARD');
        } else if (payload.phase === 'REVEAL' || payload.phase === 'ROULETTE_REVEAL') {
          setPhase('ROULETTE_REVEAL');
        } else {
          setPhase(payload.phase);
        }
      }
    };

    channel.on('broadcast', { event: 'WHO_IS_AI_STATE_SYNC' }, handleSync);
    const syncSub = channel.on('broadcast', { event: 'ROOM_STATE_SYNC' }, handleSync);

    // Request active room state immediately
    channel.send({
      type: 'broadcast',
      event: 'REQUEST_ROOM_STATE',
      payload: { playerId }
    });

    return () => {
      const ch = channel as any;
      if (ch && typeof ch.off === 'function') {
        ch.off('broadcast', { event: 'KICK_PLAYER' });
        ch.off('broadcast', { event: 'START_QUESTION_PHASE' });
        ch.off('broadcast', { event: 'START_QUESTIONS_PHASE' });
        ch.off('broadcast', { event: 'START_ANSWERING_PHASE' });
        ch.off('broadcast', { event: 'START_ANSWERS_PHASE' });
        ch.off('broadcast', { event: 'START_SHOWCASE_PHASE' });
        ch.off('broadcast', { event: 'START_VOTING_PHASE' });
        ch.off('broadcast', { event: 'ROULETTE_REVEAL' });
        ch.off('broadcast', { event: 'START_REVEAL_PHASE' });
        ch.off('broadcast', { event: 'RETURN_TO_LOBBY' });
        ch.off('broadcast', { event: 'ROOM_STATE_SYNC' });
      }
    };
  }, [channel, playerId, onLeaveRoom]);

  // Handlers
  const handleToggleReady = () => {
    const nextReady = !isReady;
    setIsReady(nextReady);
    channel.send({
      type: 'broadcast',
      event: 'PLAYER_READY_TOGGLE',
      payload: { playerId, isReady: nextReady }
    });
  };

  const handleSubmitQuestion = () => {
    if (!questionText.trim()) return;
    channel.send({
      type: 'broadcast',
      event: 'SUBMIT_QUESTION',
      payload: {
        playerId,
        avatar: myAvatar,
        questionText: questionText.trim()
      }
    });
    setHasSubmittedQuestion(true);
  };

  const handleFinishAllAnswers = (answersMap: Record<string, string>) => {
    const answersList = Object.entries(answersMap).map(([questionId, text]) => ({
      questionId,
      responderPlayerId: playerId,
      responderAvatar: myAvatar,
      answerText: text.trim() || '—'
    }));

    channel.send({
      type: 'broadcast',
      event: 'SUBMIT_ALL_ANSWERS',
      payload: { playerId, answers: answersList, answersMap }
    });

    setPhase('SHOWCASE_BOARD');
  };

  const handleCastVote = () => {
    if (!selectedVoteAvatar) return;
    channel.send({
      type: 'broadcast',
      event: 'SUBMIT_VOTE',
      payload: { voterPlayerId: playerId, targetAvatar: selectedVoteAvatar }
    });
    setHasVoted(true);
  };

  const handleLeave = onLeaveRoom || (() => { window.location.href = '/'; });

  return (
    <div className="flex flex-col h-screen bg-[#E5E0D5]" dir="rtl">
      {/* TopBar with conditional return to lobby */}
      <GameTopBar
        roomCode={roomCode}
        phase={phase}
        onLeaveGame={handleLeave}
      />

      <div className="flex-1 overflow-hidden p-4">
        {/* LOBBY PHASE */}
        {phase === 'LOBBY' && (
          <div className="flex flex-col h-full justify-between">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 text-center mt-6">
              <span className="text-xs font-bold text-[#5C4033] block mb-1">أهلاً بك</span>
              <h2 className="text-2xl font-black text-[#2C2A29] mb-2">{playerName}</h2>
              <p className="text-sm font-bold text-[#5C4033]">
                بانتظار المضيف يبدأ الجلسة من التلفزيون...
              </p>
            </div>

            <button
              onClick={handleToggleReady}
              className={`w-full py-4 rounded-xl border-2 border-[#2C2A29] font-black text-lg shadow-[4px_4px_0px_#2C2A29] active:translate-y-0.5 cursor-pointer ${
                isReady
                  ? 'bg-[#2C2A29] text-white'
                  : 'bg-[#8A9A5B] text-white hover:bg-[#78884E]'
              }`}
            >
              {isReady ? 'جاهز للعب ✓' : 'أنا جاهز (اختياري)'}
            </button>
          </div>
        )}

        {/* QUESTION INPUT PHASE */}
        {phase === 'QUESTION_INPUT' && (
          <div className="flex flex-col h-full justify-between">
            {hasSubmittedQuestion ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 text-center w-full">
                  <span className="text-xs font-bold text-[#8A9A5B] block mb-1">تم إرسال سؤالك ✓</span>
                  <h3 className="text-lg font-black text-[#2C2A29] mb-2">اسمك: [{myAvatar || 'أفاتار سري'}]</h3>
                  <p className="text-sm font-bold text-[#5C4033]">
                    خلك مروق.. بانتظار باقي الشباب يكتبون أسئلتهم
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4 mb-4">
                    <span className="text-xs font-bold text-[#5C4033] block">هويتك السرية:</span>
                    <h2 className="text-xl font-black text-[#2C2A29]">أنت: [{myAvatar || 'أفاتار سري'}]</h2>
                  </div>

                  <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4">
                    <label className="block text-sm font-black text-[#2C2A29] mb-2">
                      اكتب سؤال محرج أو ذكي للجلسة:
                    </label>
                    <textarea
                      rows={4}
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      placeholder="مثال: لو مسكوك مسوي مصيبة وش أول تصريفة تطلعها؟"
                      className="w-full p-3 rounded-xl border-2 border-[#2C2A29] bg-white text-[#2C2A29] font-bold text-sm focus:outline-none resize-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSubmitQuestion}
                  disabled={!questionText.trim()}
                  className="w-full py-4 bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-xl font-black text-lg disabled:opacity-50 active:translate-y-0.5 cursor-pointer"
                >
                  إرسال السؤال
                </button>
              </>
            )}
          </div>
        )}

        {/* ANSWERING SWIPE PHASE */}
        {phase === 'ANSWERING_SWIPE' && (
          questions.length > 0 ? (
            <MobileSwipeCards
              questions={questions}
              myAvatar={myAvatar}
              onSubmitAll={handleFinishAllAnswers}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-center p-6 bg-[#F7F4EC] rounded-2xl border-2 border-[#2C2A29]">
              <p className="font-bold text-[#5C4033]">جاري تجهيز بطاقات الأسئلة...</p>
            </div>
          )
        )}

        {/* SHOWCASE PHASE */}
        {phase === 'SHOWCASE_BOARD' && (
          <MobileShowcaseSwipe
            questions={questions}
            answers={answers}
            myAvatar={myAvatar}
          />
        )}

        {/* VOTING PHASE */}
        {phase === 'VOTING' && (
          <div className="flex flex-col h-full justify-between select-none" dir="rtl">
            {/* Mini Swipe Inspector at Top (48% height) */}
            <div className="h-[48%] overflow-hidden mb-2">
              <MobileShowcaseSwipe
                questions={questions}
                answers={answers}
                myAvatar={myAvatar}
              />
            </div>

            {/* Voting Pad at Bottom */}
            <div className="flex-1 flex flex-col justify-between bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-3">
              <div>
                <h3 className="text-sm font-black text-[#2C2A29] text-center mb-1">
                  مين تتوقع الروبوت المندس؟
                </h3>
                <p className="text-[11px] font-bold text-[#5C4033] text-center mb-2">
                  قارن الإجابات فوق وصوّت للأفاتار المشبوه
                </p>

                <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto">
                  {allAvatars.filter((av) => av !== myAvatar).map((av) => (
                    <button
                      key={av}
                      onClick={() => !hasVoted && setSelectedVoteAvatar(av)}
                      className={`py-2 rounded-xl border-2 border-[#2C2A29] font-black text-xs transition-all ${
                        selectedVoteAvatar === av
                          ? 'bg-[#8A9A5B] text-white shadow-[2px_2px_0px_#2C2A29]'
                          : 'bg-white text-[#2C2A29]'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCastVote}
                disabled={!selectedVoteAvatar || hasVoted}
                className="w-full py-3 bg-[#C68B59] text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl font-black text-sm disabled:opacity-50 active:translate-y-0.5 mt-2 cursor-pointer"
              >
                {hasVoted ? 'تم التصويت ✓ (طالع التلفزيون)' : 'تأكيد التصويت'}
              </button>
            </div>
          </div>
        )}

        {/* REVEAL */}
        {phase === 'ROULETTE_REVEAL' && (
          <div className="flex-1 flex items-center justify-center text-center p-6 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl">
            <h3 className="text-xl font-black text-[#2C2A29]">انظر للتلفزيون لكشف الستار!</h3>
          </div>
        )}
      </div>
    </div>
  );
};
