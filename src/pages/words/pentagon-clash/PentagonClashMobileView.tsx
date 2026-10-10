import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  Send,
  Delete,
  Sparkles,
  Award,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Hexagon
} from 'lucide-react';
import { roomBus, cleanRoomCode } from '../../../lib/roomBus';
import { sound } from '../../../lib/audio';
import { arabicDict, normalizeArabic } from '../../../utils/arabicDictionary';

interface PentagonMobileProps {
  channel: RealtimeChannel | null;
  roomCode: string;
  playerId: string;
  playerName: string;
}

export const PentagonClashMobileView: React.FC<PentagonMobileProps> = ({
  channel,
  roomCode,
  playerId,
  playerName
}) => {
  const navigate = useNavigate();
  const cleanCode = cleanRoomCode(roomCode);

  // Round states
  const [isRoundActive, setIsRoundActive] = useState<boolean>(false);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [centerLetter, setCenterLetter] = useState<string>('');
  const [outerLetters, setOuterLetters] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState<string>('');
  const [roundEnded, setRoundEnded] = useState<boolean>(false);

  // My stats
  const [myClaimedWords, setMyClaimedWords] = useState<Array<{ word: string; points: number }>>([]);
  const [myTotalScore, setMyTotalScore] = useState<number>(0);

  // Toast feedback & Shake
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [shake, setShake] = useState(false);

  // Mutex submission guard & 400ms debounce
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittedWordsRef = useRef<Set<string>>(new Set());

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // Exit handler
  const handleExitGame = () => {
    if (window.confirm('هل تريد مغادرة الغرفة والعودة للرئيسية؟')) {
      sound.playClick();
      sessionStorage.removeItem('taq_session_player_id');
      localStorage.removeItem('taq_room_code');
      try {
        sessionStorage.removeItem(`taghesi_player_${cleanCode}`);
        localStorage.removeItem(`taghesi_player_${cleanCode}`);
      } catch {}
      navigate('/');
    }
  };

  // Event Listeners
  useEffect(() => {
    const unsubStart = roomBus.on('ROUND_STARTED', (evt) => {
      const payload = (evt as any)?.data || (evt as any)?.payload || evt;
      if (!payload || !payload.centerLetter) return;

      sound.playRoundStart();
      setCurrentRound(payload.round || 1);
      setCenterLetter(payload.centerLetter);
      setOuterLetters(payload.outerLetters || []);
      setCurrentWord('');
      setMyClaimedWords([]);
      setToastMessage(null);
      setRoundEnded(false);
      submittedWordsRef.current.clear();
      setIsSubmitting(false);
      setIsRoundActive(true);
    });

    const unsubClaimed = roomBus.on('WORD_CLAIMED', (evt) => {
      const payload = (evt as any)?.data || (evt as any)?.payload || evt;
      if (!payload || !payload.word) return;

      const normWord = normalizeArabic(payload.word);

      if (payload.playerId === playerId) {
        sound.playSuccess();
        setMyClaimedWords(prev => [{ word: payload.word, points: payload.points }, ...prev]);
        setMyTotalScore(prev => prev + (payload.points || 0));
        setToastMessage({ text: `تم خطف "${payload.word}" بنجاح! (+${payload.points} pt)`, type: 'success' });
        setCurrentWord('');
      } else if (normalizeArabic(currentWord) === normWord) {
        sound.playTimerWarning();
        setToastMessage({ text: `سبقك عليها ${payload.playerName}!`, type: 'error' });
        setCurrentWord('');
      }
    });

    const unsubEnd = roomBus.on('PENTAGON_ROUND_ENDED', () => {
      sound.playBuzzerHit();
      setRoundEnded(true);
      setIsRoundActive(false);
      setToastMessage({ text: 'انتهت الجولة!', type: 'info' });
    });

    const unsubLobby = roomBus.on('RETURN_TO_LOBBY', () => {
      setIsRoundActive(false);
      setRoundEnded(false);
      setCurrentWord('');
      setToastMessage({ text: 'تمت العودة للوبي', type: 'info' });
    });

    return () => {
      unsubStart();
      unsubClaimed();
      unsubEnd();
      unsubLobby();
    };
  }, [playerId, currentWord, cleanCode]);

  // Clear toast after delay
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Letter tap
  const handleLetterTap = (letter: string) => {
    if (!isRoundActive || roundEnded) return;
    sound.playClick();
    setCurrentWord(prev => prev + letter);
  };

  const handleBackspace = () => {
    sound.playClick();
    setCurrentWord(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    sound.playClick();
    setCurrentWord('');
  };

  // Submit word claim with Strict Gibberish Rejection & 400ms Debounce
  const handleSubmitWord = async () => {
    if (!isRoundActive || roundEnded) return;
    const clean = normalizeArabic(currentWord);

    if (clean.length < 3) {
      sound.playTimerWarning();
      triggerShake();
      setToastMessage({ text: 'الكلمة يجب أن تتكون من 3 أحرف كحد أدنى!', type: 'error' });
      return;
    }

    // Strict Center Letter Check
    const centerNorm = normalizeArabic(centerLetter);
    if (!clean.includes(centerNorm)) {
      sound.playTimerWarning();
      triggerShake();
      setToastMessage({ text: `يجب أن تحتوي الكلمة على الحرف المركزي (${centerLetter})!`, type: 'error' });
      return;
    }

    // Strict Dictionary Validation: Reject Gibberish
    if (!arabicDict.isValid(clean)) {
      sound.playTimerWarning();
      triggerShake();
      setToastMessage({ text: 'كلمة غير صحيحة أو غير موجودة في المعجم!', type: 'error' });
      return;
    }

    // Local Duplicate & Debounce Check
    if (submittedWordsRef.current.has(clean) || isSubmitting) {
      sound.playTimerWarning();
      triggerShake();
      setToastMessage({ text: 'تم إرسال هذه الكلمة مسبقاً!', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    submittedWordsRef.current.add(clean);
    sound.playClick();

    const payload = {
      playerId,
      playerName,
      word: clean
    };

    roomBus.emit('CLAIM_WORD', cleanCode, payload);
    if (channel) {
      try {
        await channel.send({ type: 'broadcast', event: 'CLAIM_WORD', payload });
      } catch {}
    }

    setTimeout(() => {
      setIsSubmitting(false);
    }, 400);
  };

  return (
    <div className="w-full min-h-[100dvh] flex flex-col bg-[#E5E0D5] p-3 select-none justify-between" dir="rtl">
      {/* Top Bar: Strictly Exit Button, Game Title, Score */}
      <div className="flex items-center justify-between bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl px-3 py-2 mb-3">
        <button
          onClick={handleExitGame}
          className="px-3 py-1.5 bg-[#C68B59] hover:bg-[#2C2A29] text-white border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-lg font-black text-xs flex items-center gap-1 transition-all active:translate-y-0.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>خروج</span>
        </button>

        <div className="text-xs font-black text-[#000000] flex items-center gap-1.5">
          <Hexagon className="w-4 h-4 text-[#8A9A5B]" />
          <span>خلية الخماسيات • ج{currentRound}</span>
        </div>

        <div className="bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] px-2.5 py-1 rounded-lg text-xs font-black">
          {myTotalScore} pt
        </div>
      </div>

      {/* Main Arena */}
      {!isRoundActive && !roundEnded ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl mb-3">
          <Hexagon className="w-16 h-16 text-[#8A9A5B] mb-4 animate-pulse" />
          <h2 className="text-xl font-black text-[#000000] mb-2">استعد للجولة!</h2>
          <p className="text-xs font-bold text-[#5C4033] mb-6">
            ستظهر الحروف الخماسية على شاشتك. كوّن الكلمات بأسرع ما يمكن واخطف النقاط قبل بقية اللاعبين!
          </p>
          <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] px-4 py-2 rounded-xl text-xs font-black text-[#2C2A29]">
            بانتظار إطلاق الجولة من شاشة العرض...
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between mb-3">
          {/* Word Input Display Box */}
          <div className={`bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4 mb-3 text-center min-h-[70px] flex items-center justify-center ${
            shake ? 'animate-[shake_0.4s_ease-in-out]' : ''
          }`}>
            {currentWord ? (
              <span className="text-3xl font-black text-[#000000] tracking-wider">
                {currentWord}
              </span>
            ) : (
              <span className="text-xs font-bold text-[#5C4033]">
                انقر على الحروف لتكوين الكلمة...
              </span>
            )}
          </div>

          {/* Toast feedback */}
          {toastMessage && (
            <div className={`text-center py-2 px-3 rounded-xl border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] text-xs font-black mb-3 ${
              toastMessage.type === 'success'
                ? 'bg-[#8A9A5B] text-white'
                : toastMessage.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-[#C68B59] text-white'
            }`}>
              {toastMessage.text}
            </div>
          )}

          {/* Letter Hive Layout for Mobile Touch */}
          <div className="flex flex-col items-center justify-center gap-3 my-auto">
            {/* Top row: 2 outer letters */}
            <div className="flex justify-center gap-4">
              {outerLetters.slice(0, 2).map((letter, i) => (
                <button
                  key={i}
                  onClick={() => handleLetterTap(letter)}
                  className="w-[72px] h-[72px] bg-[#F7F4EC] active:bg-[#8A9A5B] active:text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl text-2xl font-black text-[#000000] active:translate-y-0.5 transition-all select-none touch-manipulation"
                >
                  {letter}
                </button>
              ))}
            </div>

            {/* Middle row: 1 outer + CENTER + 1 outer */}
            <div className="flex items-center justify-center gap-4">
              {outerLetters[2] && (
                <button
                  onClick={() => handleLetterTap(outerLetters[2])}
                  className="w-[72px] h-[72px] bg-[#F7F4EC] active:bg-[#8A9A5B] active:text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl text-2xl font-black text-[#000000] active:translate-y-0.5 transition-all select-none touch-manipulation"
                >
                  {outerLetters[2]}
                </button>
              )}

              {/* Center Mandatory Letter */}
              <button
                onClick={() => handleLetterTap(centerLetter)}
                className="w-[84px] h-[84px] bg-[#C68B59] active:bg-[#2C2A29] text-white border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-3xl text-3xl font-black active:translate-y-0.5 transition-all select-none touch-manipulation animate-pulse"
              >
                {centerLetter}
              </button>

              {outerLetters[3] && (
                <button
                  onClick={() => handleLetterTap(outerLetters[3])}
                  className="w-[72px] h-[72px] bg-[#F7F4EC] active:bg-[#8A9A5B] active:text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl text-2xl font-black text-[#000000] active:translate-y-0.5 transition-all select-none touch-manipulation"
                >
                  {outerLetters[3]}
                </button>
              )}
            </div>

            {/* Bottom row: 1 outer letter */}
            <div className="flex justify-center gap-4">
              {outerLetters[4] && (
                <button
                  onClick={() => handleLetterTap(outerLetters[4])}
                  className="w-[72px] h-[72px] bg-[#F7F4EC] active:bg-[#8A9A5B] active:text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl text-2xl font-black text-[#000000] active:translate-y-0.5 transition-all select-none touch-manipulation"
                >
                  {outerLetters[4]}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Control Action Buttons */}
      <div className="grid grid-cols-4 gap-2 pt-2 border-t-2 border-[#2C2A29]">
        <button
          onClick={handleClear}
          disabled={!isRoundActive || !currentWord}
          className="col-span-1 py-3 bg-[#E5E0D5] hover:bg-[#2C2A29] text-[#2C2A29] hover:text-white border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl text-xs font-black transition-all disabled:opacity-40"
        >
          مسح الكل
        </button>

        <button
          onClick={handleBackspace}
          disabled={!isRoundActive || !currentWord}
          className="col-span-1 py-3 bg-[#F7F4EC] text-[#2C2A29] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl text-xs font-black flex items-center justify-center transition-all disabled:opacity-40"
        >
          <Delete className="w-5 h-5" />
        </button>

        <button
          onClick={handleSubmitWord}
          disabled={!isRoundActive || currentWord.length < 3 || isSubmitting}
          className="col-span-2 py-3 bg-[#8A9A5B] hover:bg-[#2C2A29] text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl text-sm font-black flex items-center justify-center gap-1.5 transition-all active:translate-y-0.5 disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
          <span>إرسال الكلمة</span>
        </button>
      </div>
    </div>
  );
};
