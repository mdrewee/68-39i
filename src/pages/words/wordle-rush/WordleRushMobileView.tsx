import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Send,
  Delete,
  CheckCircle2,
  Clock,
  AlertCircle,
  LogOut,
  Trophy,
  Check
} from 'lucide-react';
import { roomBus, cleanRoomCode } from '../../../lib/roomBus';
import { sound } from '../../../lib/audio';
import { isValidArabicWord, normalizeArabic } from '../../../utils/arabicDictionary';
import { TileStatus, evaluateWordleGuess } from './wordsBank';

interface WordleRushMobileViewProps {
  channel?: any;
  roomCode: string;
  playerId: string;
  playerName: string;
}

const ARABIC_KEYBOARD_ROWS = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
  ['ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'ة', 'و', 'ز', 'ظ', 'ذ']
];

export const WordleRushMobileView: React.FC<WordleRushMobileViewProps> = ({
  channel,
  roomCode,
  playerId,
  playerName
}) => {
  const cleanCode = cleanRoomCode(roomCode);
  const navigate = useNavigate();

  // Round states
  const [currentRound, setCurrentRound] = useState(1);
  const [targetWord, setTargetWord] = useState<string>('');
  const [isRoundActive, setIsRoundActive] = useState(false);

  // Ready button state for lobby / inter-round
  const [isReady, setIsReady] = useState(false);

  // Grid state: 6 rows
  const [guesses, setGuesses] = useState<string[]>([]);
  const [guessResults, setGuessResults] = useState<TileStatus[][]>([]);
  const [currentInput, setCurrentInput] = useState<string>('');

  // Keyboard letter statuses: letter -> TileStatus
  const [letterStatuses, setLetterStatuses] = useState<Record<string, TileStatus>>({});

  // Error shake animation
  const [shakeRow, setShakeRow] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Solved & Outcome state
  const [isSolved, setIsSolved] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [roundEnded, setRoundEnded] = useState(false);
  const [revealedWord, setRevealedWord] = useState('');
  const [roundOutcomeText, setRoundOutcomeText] = useState('');

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

  // Toggle Ready
  const handleToggleReady = () => {
    sound.playClick();
    const next = !isReady;
    setIsReady(next);

    const readyPayload = {
      playerId,
      playerName,
      isReady: next,
      round: currentRound
    };
    roomBus.emit('PLAYER_ROUND_READY', cleanCode, readyPayload);
    if (channel) {
      try {
        channel.send({ type: 'broadcast', event: 'PLAYER_ROUND_READY', payload: readyPayload });
      } catch {}
    }
  };

  // Listen to ROUND_STARTED, WORDLE_ROUND_WON, WORDLE_ALL_LOST
  useEffect(() => {
    const unsubStart = roomBus.on('ROUND_STARTED', (evt) => {
      const payload = (evt as any)?.data || (evt as any)?.payload || evt;
      if (!payload || !payload.targetWord) return;

      sound.playRoundStart();
      setCurrentRound(payload.round || 1);
      setTargetWord(payload.targetWord);
      setGuesses([]);
      setGuessResults([]);
      setCurrentInput('');
      setLetterStatuses({});
      setIsSolved(false);
      setIsFailed(false);
      setRoundEnded(false);
      setRevealedWord('');
      setRoundOutcomeText('');
      setIsReady(false);
      setIsRoundActive(true);
    });

    // Round Won (First solver won)
    const unsubLobby = roomBus.on('RETURN_TO_LOBBY', () => {
      setIsRoundActive(false);
      setRoundEnded(false);
      setIsSolved(false);
      setIsFailed(false);
      setGuesses([]);
      setGuessResults([]);
      setCurrentInput('');
      setLetterStatuses({});
      setIsReady(false);
    });

    const unsubWon = roomBus.on('WORDLE_ROUND_WON', (evt) => {
      const data = (evt as any)?.data || (evt as any)?.payload || evt;
      if (data) {
        sound.playVictory();
        setRoundEnded(true);
        setIsRoundActive(false);
        setRevealedWord(data.word || targetWord);
        setRoundOutcomeText(
          data.winnerId === playerId
            ? 'مبروك! فزت بالجولة وحصدت 10 نقاط! ✓'
            : `فاز بالجولة: ${data.winnerName}!`
        );
      }
    });

    // All Lost
    const unsubAllLost = roomBus.on('WORDLE_ALL_LOST', (evt) => {
      const data = (evt as any)?.data || (evt as any)?.payload || evt;
      if (data) {
        sound.playFailBuzzer();
        setRoundEnded(true);
        setIsRoundActive(false);
        setRevealedWord(data.word || targetWord);
        setRoundOutcomeText('لم ينجح أحد في تخمين الكلمة السرية!');
      }
    });

    return () => {
      unsubStart();
      unsubWon();
      unsubLobby();
      unsubAllLost();
    };
  }, [playerId, targetWord]);

  // Trigger error shake
  const triggerError = (msg: string) => {
    sound.playTick();
    setErrorMessage(msg);
    setShakeRow(true);
    setTimeout(() => {
      setShakeRow(false);
      setErrorMessage('');
    }, 1200);
  };

  // Keyboard typing
  const handleKeyPress = (char: string) => {
    if (isSolved || isFailed || roundEnded || guesses.length >= 6) return;
    if (currentInput.length >= 5) return;
    sound.playClick();
    setCurrentInput(prev => prev + char);
  };

  const handleBackspace = () => {
    if (isSolved || isFailed || roundEnded) return;
    if (currentInput.length === 0) return;
    sound.playClick();
    setCurrentInput(prev => prev.slice(0, -1));
  };

  // Submit guess
  const handleEnter = () => {
    if (isSolved || isFailed || roundEnded) return;

    if (currentInput.length !== 5) {
      triggerError('الكلمة يجب أن تكون ٥ أحرف بالضبط!');
      return;
    }

    // Massively expanded dictionary validation
    if (!isValidArabicWord(currentInput, 5)) {
      triggerError('كلمة غير صحيحة أو غير موجودة في المعجم!');
      return;
    }

    // Evaluate guess
    const result = evaluateWordleGuess(currentInput, targetWord);
    const newGuesses = [...guesses, currentInput];
    const newResults = [...guessResults, result];
    const rowIndex = guesses.length;

    setGuesses(newGuesses);
    setGuessResults(newResults);
    setCurrentInput('');

    // Update keyboard statuses
    setLetterStatuses(prev => {
      const next = { ...prev };
      Array.from(currentInput).forEach((ch, idx) => {
        const st = result[idx];
        const curSt = next[ch];
        if (st === 'correct') {
          next[ch] = 'correct';
        } else if (st === 'present' && curSt !== 'correct') {
          next[ch] = 'present';
        } else if (st === 'absent' && !curSt) {
          next[ch] = 'absent';
        }
      });
      return next;
    });

    // Broadcast guess tiles to TV (anti-cheat: tiles only)
    const guessPayload = {
      playerId,
      playerName,
      rowIndex,
      tiles: result
    };
    roomBus.emit('WORDLE_GUESS', cleanCode, guessPayload);
    if (channel) {
      try {
        channel.send({ type: 'broadcast', event: 'WORDLE_GUESS', payload: guessPayload });
      } catch {}
    }

    // Check if solved (all 5 correct)
    const solved = result.every(s => s === 'correct');
    if (solved) {
      sound.playVictory();
      setIsSolved(true);
      const solvedPayload = {
        playerId,
        playerName,
        attemptNumber: rowIndex + 1
      };
      roomBus.emit('PLAYER_SOLVED_WORDLE', cleanCode, solvedPayload);
      if (channel) {
        try {
          channel.send({ type: 'broadcast', event: 'PLAYER_SOLVED_WORDLE', payload: solvedPayload });
        } catch {}
      }
    } else if (newGuesses.length >= 6) {
      sound.playTimerWarning();
      setIsFailed(true);
    } else {
      sound.playClick();
    }
  };

  // Top Bar Component
  const renderTopBar = () => (
    <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-2.5 flex items-center justify-between mb-2">
      <button
        onClick={handleExitGame}
        className="bg-[#C68B59] hover:bg-[#b0784a] text-white border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] px-3 py-1 rounded-xl font-black text-xs flex items-center gap-1 active:translate-y-0.5"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>خروج</span>
      </button>

      <span className="font-black text-sm text-[#000000]">سباق ووردل</span>

      <span className="text-xs font-bold text-[#5C4033]">
        {guesses.length} / 6
      </span>
    </div>
  );

  // VIEW: LOBBY / WAITING (With 3D "جاهز" Auto-Advance Button)
  if (!isRoundActive && !roundEnded) {
    return (
      <div className="min-h-screen bg-[#E5E0D5] text-[#2C2A29] p-4 flex flex-col justify-between selection:bg-[#8A9A5B]">
        {renderTopBar()}

        {/* Center Wait Card with 3D "جاهز" Button */}
        <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-8 text-center my-auto">
          <div className="w-16 h-16 bg-[#C68B59]/20 border-2 border-[#2C2A29] rounded-2xl flex items-center justify-center text-[#C68B59] mx-auto mb-4">
            <Layers className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-[#000000] mb-2">سباق ووردل</h2>
          <p className="text-xs font-bold text-[#5C4033] mb-6">
            بدون عداد وقت! أول من يفك الكلمة يفوز فوراً بالجولة. اضغط "جاهز" للبدء التلقائي.
          </p>

          {/* 3D Circular "جاهز" Button */}
          <button
            onClick={handleToggleReady}
            className={`w-28 h-28 rounded-full border-3 border-[#2C2A29] mx-auto flex flex-col items-center justify-center font-black transition-all select-none ${
              isReady
                ? 'bg-stone-400 text-stone-800 shadow-[1px_1px_0px_#2C2A29] translate-y-1'
                : 'bg-[#8A9A5B] text-white shadow-[4px_4px_0px_#2C2A29] hover:-translate-y-1 active:translate-y-0.5'
            }`}
          >
            {isReady ? (
              <>
                <Check className="w-8 h-8 mb-1" />
                <span className="text-sm">جاهز ✓</span>
              </>
            ) : (
              <>
                <Check className="w-8 h-8 mb-1" />
                <span className="text-base">أنا جاهز!</span>
              </>
            )}
          </button>

          <span className="block text-[11px] font-bold text-[#5C4033] mt-4">
            * عند جاهزية متسابقين فأكثر ينطلق العد التلقائي على الشاشة.
          </span>
        </div>

        <div className="text-center text-xs font-bold text-[#5C4033]">
          لعبة المجلس تبدأ هنا • طق عصي
        </div>
      </div>
    );
  }

  // VIEW: ROUND ENDED REVEAL
  if (roundEnded) {
    return (
      <div className="min-h-screen bg-[#E5E0D5] text-[#2C2A29] p-4 flex flex-col justify-between selection:bg-[#8A9A5B]">
        {renderTopBar()}

        <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 text-center my-auto">
          <span className="text-xs font-black text-[#5C4033] block mb-2">الكلمة السرية كانت:</span>
          <div className="flex justify-center gap-2 mb-4">
            {Array.from(revealedWord).map((letter, idx) => (
              <div
                key={idx}
                className="w-12 h-12 bg-[#8A9A5B] text-white border-2 border-[#2C2A29] rounded-xl flex items-center justify-center text-2xl font-black shadow-[2px_2px_0px_#2C2A29]"
              >
                {letter}
              </div>
            ))}
          </div>

          <p className="text-base font-black text-[#000000] mb-6">
            {roundOutcomeText}
          </p>

          {/* 3D "جاهز للجولة التالية" Button */}
          <button
            onClick={handleToggleReady}
            className={`px-6 py-3.5 rounded-xl border-2 border-[#2C2A29] font-black text-sm flex items-center justify-center gap-2 mx-auto transition-all ${
              isReady
                ? 'bg-stone-400 text-stone-800 shadow-[1px_1px_0px_#2C2A29] translate-y-0.5'
                : 'bg-[#8A9A5B] text-white shadow-[4px_4px_0px_#2C2A29] hover:-translate-y-0.5'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{isReady ? 'جاهز للجولة التالية ✓' : 'جاهز للجولة التالية ◄'}</span>
          </button>
        </div>

        <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-xl p-3 text-center text-xs font-bold text-[#5C4033]">
          بانتظار انطلاق الجولة التالية من الشاشة...
        </div>
      </div>
    );
  }

  // VIEW: ACTIVE GAMEPLAY
  return (
    <div className="min-h-screen bg-[#E5E0D5] text-[#2C2A29] p-2 flex flex-col justify-between selection:bg-[#8A9A5B]">
      {renderTopBar()}

      {/* Error Message Toast */}
      {errorMessage && (
        <div className="bg-red-600 text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl py-1.5 px-3 text-center text-xs font-black mb-1 animate-bounce flex items-center justify-center gap-1.5">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 6-Row Wordle Grid */}
      <div className="flex flex-col gap-1.5 items-center justify-center my-auto py-1">
        {[0, 1, 2, 3, 4, 5].map((rowIdx) => {
          const isCurrentRow = rowIdx === guesses.length;
          const isSubmittedRow = rowIdx < guesses.length;
          const rowWord = isSubmittedRow ? guesses[rowIdx] : isCurrentRow ? currentInput : '';
          const rowTiles = isSubmittedRow ? guessResults[rowIdx] : [];
          const chars = Array.from(rowWord);

          return (
            <div
              key={rowIdx}
              className={`flex gap-2 transition-transform ${
                isCurrentRow && shakeRow ? 'animate-shake' : ''
              }`}
            >
              {[0, 1, 2, 3, 4].map((colIdx) => {
                const char = chars[colIdx] || '';
                const tileStatus = rowTiles?.[colIdx];

                let bgClass = 'bg-[#F7F4EC] text-[#000000] border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29]';
                if (tileStatus === 'correct') {
                  bgClass = 'bg-[#8A9A5B] text-white border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29]';
                } else if (tileStatus === 'present') {
                  bgClass = 'bg-[#C68B59] text-white border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29]';
                } else if (tileStatus === 'absent') {
                  bgClass = 'bg-[#2C2A29] text-white border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29]';
                } else if (isCurrentRow && char) {
                  bgClass = 'bg-white text-[#000000] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] scale-105';
                }

                return (
                  <div
                    key={colIdx}
                    className={`w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 flex items-center justify-center text-xl md:text-2xl font-black select-none transition-all duration-200 ${bgClass}`}
                  >
                    {char}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Solved / Failed Banner */}
      {isSolved && (
        <div className="bg-[#8A9A5B]/20 border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl p-2.5 text-center my-1">
          <span className="font-black text-sm text-[#000000] block">أحسنت! فككت الكلمة بنجاح ✓</span>
          <span className="text-[11px] font-bold text-[#5C4033]">بانتظار شاشة التلفاز لإعلان الفوز...</span>
        </div>
      )}

      {isFailed && !isSolved && (
        <div className="bg-red-100 border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl p-2.5 text-center my-1">
          <span className="font-black text-sm text-red-800 block">استنفدت محاولاتك الـ 6!</span>
          <span className="text-[11px] font-bold text-[#5C4033]">بانتظار بقية المتسابقين...</span>
        </div>
      )}

      {/* JUMBO TOUCH-FRIENDLY KEYBOARD */}
      {!isSolved && !isFailed && (
        <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-2 mt-auto touch-manipulation">
          <div className="flex flex-col gap-1.5">
            {ARABIC_KEYBOARD_ROWS.map((row, rIdx) => (
              <div key={rIdx} className="flex justify-center gap-1">
                {/* Widen Enter Key on Bottom Row */}
                {rIdx === 2 && (
                  <button
                    onClick={handleEnter}
                    className="flex-[1.5] h-[52px] min-h-[52px] bg-[#8A9A5B] hover:bg-[#728247] text-white border border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-lg font-bold text-base flex items-center justify-center active:translate-y-0.5 select-none"
                  >
                    <span>تأكيد</span>
                  </button>
                )}

                {row.map((char) => {
                  const status = letterStatuses[char];
                  let keyColor = 'bg-[#E5E0D5] text-[#000000]';
                  if (status === 'correct') {
                    keyColor = 'bg-[#8A9A5B] text-white';
                  } else if (status === 'present') {
                    keyColor = 'bg-[#C68B59] text-white';
                  } else if (status === 'absent') {
                    keyColor = 'bg-[#2C2A29] text-stone-400 opacity-60';
                  }

                  return (
                    <button
                      key={char}
                      onClick={() => handleKeyPress(char)}
                      className={`flex-1 h-[52px] min-h-[52px] px-1 rounded-lg border border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] font-bold text-lg flex items-center justify-center active:translate-y-0.5 transition-colors select-none ${keyColor}`}
                    >
                      {char}
                    </button>
                  );
                })}

                {/* Widen Backspace Key on Bottom Row */}
                {rIdx === 2 && (
                  <button
                    onClick={handleBackspace}
                    className="flex-[1.5] h-[52px] min-h-[52px] bg-stone-300 hover:bg-stone-400 text-[#000000] border border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-lg font-bold text-sm flex items-center justify-center active:translate-y-0.5 select-none"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
