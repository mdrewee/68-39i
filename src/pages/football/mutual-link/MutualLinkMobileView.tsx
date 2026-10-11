import React, { useState, useEffect, useRef, useCallback, FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  MutualLinkPhase,
  MutualLinkEventPayload,
} from './types';
import { MutualLinkChallenge } from '../../../utils/mutualLinkEngine';
import { searchFootballPlayers } from '../../../utils/footballSearch';
import { FOOTBALL_CLUBS_MASTER, LOCAL_COUNTRY_FLAGS } from '../../../data/footballMasterData';
import { sound } from '../../../lib/audio';
import { Trophy, Send, Search, CheckCircle2, AlertCircle, Clock, Link as LinkIcon, RotateCcw } from 'lucide-react';

const AVATARS = ['⚽', '🔥', '👑', '🧤', '⚡', '🏆', '🦁', '🎯'];

export const MutualLinkMobileView: FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // Player Profile
  const [playerId, setPlayerId] = useState<string>(() => {
    return sessionStorage.getItem('mutual_player_id') || `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  });
  const [playerName, setPlayerName] = useState<string>(() => {
    return sessionStorage.getItem('mutual_player_name') || '';
  });
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AVATARS[0]);
  const [hasJoined, setHasJoined] = useState<boolean>(() => {
    return !!sessionStorage.getItem('mutual_player_name');
  });

  // Game Realtime State
  const [phase, setPhase] = useState<MutualLinkPhase>('LOBBY');
  const [round, setRound] = useState<number>(1);
  const [maxRounds, setMaxRounds] = useState<number>(5);
  const [currentChallenge, setCurrentChallenge] = useState<MutualLinkChallenge | null>(null);
  const [myScore, setMyScore] = useState<number>(0);

  // Round Winner / Timeout reveal
  const [roundWinnerName, setRoundWinnerName] = useState<string | null>(null);
  const [revealAnswer, setRevealAnswer] = useState<string | null>(null);

  // Search & Guess Input
  const [query, setQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLockedOut, setIsLockedOut] = useState<boolean>(false);
  const [lockoutSec, setLockoutSec] = useState<number>(0);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Channel ref
  const channelRef = useRef<RealtimeChannel | null>(null);
  const playerIdRef = useRef<string>(playerId);
  const playerNameRef = useRef<string>(playerName);
  const hasJoinedRef = useRef<boolean>(hasJoined);

  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);
  useEffect(() => { hasJoinedRef.current = hasJoined; }, [hasJoined]);

  // Autocomplete suggestion logic based on challenge type
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || isLockedOut) {
      setSuggestions([]);
      return;
    }

    if (currentChallenge?.type === 'CLUB_TO_CLUB') {
      // Suggest player names
      const players = searchFootballPlayers(trimmed, 6);
      setSuggestions(players.map(p => p.name));
    } else {
      // Suggest club or country names
      const clubNames = FOOTBALL_CLUBS_MASTER.map(c => c.name);
      const countryNames = Object.keys(LOCAL_COUNTRY_FLAGS);
      const allEntities = Array.from(new Set([...clubNames, ...countryNames]));
      const hits = allEntities.filter(name => name.includes(trimmed)).slice(0, 6);
      setSuggestions(hits);
    }
  }, [query, currentChallenge, isLockedOut]);

  // Broadcast event helper
  const broadcastEvent = useCallback((payload: MutualLinkEventPayload) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'mutual_link_event',
      payload,
    });
  }, []);

  // Submit Answer Guess
  const handleSubmitGuess = useCallback((textToSubmit?: string) => {
    if (isLockedOut || phase !== 'GAMEPLAY') return;

    const answer = (textToSubmit || query).trim();
    if (!answer) return;

    sound.playClick();
    setQuery('');
    setSuggestions([]);

    broadcastEvent({
      action: 'SUBMIT_GUESS',
      playerId: playerIdRef.current,
      playerName: playerNameRef.current,
      guessText: answer,
    });
  }, [isLockedOut, phase, query, broadcastEvent]);

  // Handle Join Lobby
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = playerName.trim();
    if (!cleanName) return;

    sound.playClick();
    sessionStorage.setItem('mutual_player_id', playerId);
    sessionStorage.setItem('mutual_player_name', cleanName);
    sessionStorage.setItem('mutual_room', roomCode);
    setHasJoined(true);

    if (channelRef.current) {
      channelRef.current.track({
        id: playerId,
        name: cleanName,
        avatar: selectedAvatar,
        joinedAt: Date.now(),
      });
    }
  };

  // Realtime Supabase Channel
  useEffect(() => {
    if (!roomCode) return;

    const channelId = `mutuallink:${roomCode}`;

    const channel = supabase.channel(channelId, {
      config: {
        broadcast: { self: true },
        presence: { key: playerId },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {})
      .on('broadcast', { event: 'mutual_link_event' }, ({ payload }) => {
        if (!payload) return;
        const ev = payload as MutualLinkEventPayload;

        if (ev.action === 'GAME_START') {
          sound.playWhistle();
          setPhase('GAMEPLAY');
          setRound(ev.round || 1);
          setMaxRounds(ev.maxRounds || 5);
          setCurrentChallenge(ev.challenge || null);
          setRoundWinnerName(null);
          setRevealAnswer(null);
          setIsLockedOut(false);
          setQuery('');
          if (ev.scores && ev.scores[playerIdRef.current] !== undefined) {
            setMyScore(ev.scores[playerIdRef.current]);
          }
        } else if (ev.action === 'NEW_ROUND') {
          sound.playTick();
          setPhase('GAMEPLAY');
          setRound(ev.round || 1);
          setCurrentChallenge(ev.challenge || null);
          setRoundWinnerName(null);
          setRevealAnswer(null);
          setIsLockedOut(false);
          setQuery('');
          if (ev.scores && ev.scores[playerIdRef.current] !== undefined) {
            setMyScore(ev.scores[playerIdRef.current]);
          }
        } else if (ev.action === 'ROUND_WINNER') {
          setPhase(ev.phase || 'ROUND_REVEAL');
          setRoundWinnerName(ev.winnerPlayerName || 'أحد المتسابقين');
          setRevealAnswer(ev.challenge?.revealItem?.name || ev.guessText || '');
          if (ev.scores && ev.scores[playerIdRef.current] !== undefined) {
            setMyScore(ev.scores[playerIdRef.current]);
          }
        } else if (ev.action === 'WRONG_GUESS') {
          if (ev.playerId === playerIdRef.current) {
            // Lockout me!
            setIsLockedOut(true);
            setIsShaking(true);
            setLockoutSec(5);
            setTimeout(() => setIsShaking(false), 600);

            let count = 5;
            const lockoutTimer = setInterval(() => {
              count--;
              setLockoutSec(count);
              if (count <= 0) {
                clearInterval(lockoutTimer);
                setIsLockedOut(false);
              }
            }, 1000);
          }
        } else if (ev.action === 'ROUND_TIMEOUT') {
          setPhase('ROUND_REVEAL');
          setRoundWinnerName(null);
          setRevealAnswer(ev.challenge?.revealItem?.name || 'انتهى الوقت');
        } else if (ev.action === 'ROOM_TERMINATED') {
          sessionStorage.removeItem('mutual_player_id');
          sessionStorage.removeItem('mutual_room');
          navigate('/');
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && hasJoinedRef.current) {
          channel.track({
            id: playerIdRef.current,
            name: playerNameRef.current,
            avatar: selectedAvatar,
            joinedAt: Date.now(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, playerId, selectedAvatar, navigate]);

  // RENDER: Not Joined Yet Screen
  if (!hasJoined) {
    return (
      <div
        className="min-h-screen w-full bg-[#E5E0D5] text-[#2C2A29] flex flex-col justify-center items-center p-4 font-sans"
        dir="rtl"
      >
        <div className="w-full max-w-sm bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-2xl flex items-center justify-center mx-auto text-3xl">
              ⚽
            </div>
            <h1 className="text-2xl font-black text-[#2C2A29]">حلقة الوصل</h1>
            <p className="text-xs font-bold text-[#5C4033]">
              أدخل اسمك للانضمام للغرفة <span className="font-mono font-black">{roomCode}</span>
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-[#2C2A29] mb-1.5">
                اسم المتسابق
              </label>
              <input
                type="text"
                required
                maxLength={18}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="مثلاً: سامي، بطل الديربي..."
                className="w-full bg-[#E5E0D5] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl px-4 py-2.5 font-black text-sm text-[#2C2A29] focus:outline-none focus:bg-white"
              />
            </div>

            {/* Avatar Selector */}
            <div>
              <label className="block text-xs font-black text-[#2C2A29] mb-1.5">
                اختر شارتك
              </label>
              <div className="grid grid-cols-4 gap-2">
                {AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => { sound.playClick(); setSelectedAvatar(av); }}
                    className={`py-2 text-2xl border-2 border-[#2C2A29] rounded-xl transition-all cursor-pointer ${
                      selectedAvatar === av
                        ? 'bg-[#8A9A5B] shadow-[2px_2px_0px_#2C2A29]'
                        : 'bg-[#E5E0D5] hover:bg-[#D5CFC5]'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#8A9A5B] hover:bg-[#78884E] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none py-3 rounded-xl font-black text-base transition-all cursor-pointer"
            >
              انضم للتحدي الآن ⚡
            </button>
          </form>
        </div>
      </div>
    );
  }

  // RENDER: Active Mobile Controller
  return (
    <div
      className="min-h-screen w-full bg-[#E5E0D5] text-[#2C2A29] flex flex-col font-sans select-none overflow-x-hidden"
      dir="rtl"
    >
      {/* Mobile Top Header */}
      <header className="bg-[#E5E0D5] border-b-2 border-[#2C2A29] px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl">{selectedAvatar}</span>
          <span className="font-black text-sm text-[#2C2A29] truncate max-w-[120px]">
            {playerName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {phase !== 'LOBBY' && (
            <span className="bg-[#F7F4EC] border-2 border-[#2C2A29] px-2.5 py-0.5 rounded-lg text-xs font-black shadow-[1px_1px_0px_#2C2A29]">
              جولة {round}/{maxRounds}
            </span>
          )}
          <div className="flex items-center gap-1 bg-[#8A9A5B] text-[#F7F4EC] border-2 border-[#2C2A29] px-2.5 py-0.5 rounded-lg text-xs font-black shadow-[1px_1px_0px_#2C2A29]">
            <Trophy size={12} />
            <span className="font-mono">{myScore}</span>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 flex flex-col p-4 space-y-4 max-w-md mx-auto w-full justify-between">
        {/* =======================================================
            STATE: LOBBY
            ======================================================= */}
        {phase === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8">
            <div className="w-20 h-20 bg-[#F7F4EC] border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-3xl flex items-center justify-center text-4xl animate-bounce">
              {selectedAvatar}
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-[#2C2A29]">أنت جاهز يا {playerName}!</h2>
              <p className="text-xs font-bold text-[#5C4033]">
                تابع شاشة العرض الرئيسية لبدء الجولة الأولى ⚡
              </p>
            </div>
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] px-4 py-2 rounded-xl text-xs font-mono font-bold text-[#5C4033]">
              غرفة: {roomCode}
            </div>
          </div>
        )}

        {/* =======================================================
            STATE: GAMEPLAY
            ======================================================= */}
        {phase === 'GAMEPLAY' && currentChallenge && (
          <div className="flex-1 flex flex-col space-y-4 justify-between">
            {/* Visual Helper of Entity A and B */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl p-3">
              <div className="text-center text-xs font-black text-[#5C4033] mb-2">
                {currentChallenge.type === 'CLUB_TO_CLUB'
                  ? 'من هو اللاعب الذي لعب للناديين؟ ⚽'
                  : 'ما هو النادي أو المنتخب المشترك؟ 🛡️'}
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-xl overflow-hidden p-1 flex items-center justify-center">
                    <img
                      src={currentChallenge.entityA.image}
                      alt={currentChallenge.entityA.name}
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-[11px] font-black text-[#2C2A29] mt-1 truncate max-w-[90px]">
                    {currentChallenge.entityA.name}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <div className="w-10 h-10 bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl flex items-center justify-center text-lg font-black text-[#F7F4EC]">
                    ؟
                  </div>
                </div>

                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-xl overflow-hidden p-1 flex items-center justify-center">
                    <img
                      src={currentChallenge.entityB.image}
                      alt={currentChallenge.entityB.name}
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-[11px] font-black text-[#2C2A29] mt-1 truncate max-w-[90px]">
                    {currentChallenge.entityB.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Lockout Banner or Input Arena */}
            {isLockedOut ? (
              <div
                className={`bg-[#C68B59] text-[#F7F4EC] border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 text-center space-y-2 ${
                  isShaking ? 'animate-shake' : ''
                }`}
              >
                <div className="text-3xl">⏳</div>
                <h3 className="font-black text-xl">إجابة خاطئة!</h3>
                <p className="text-xs font-bold opacity-90">
                  تم حظرك مؤقتاً لمدة {lockoutSec} ثوانٍ
                </p>
                <div className="w-full bg-[#2C2A29] h-2 rounded-full overflow-hidden mt-3">
                  <div
                    className="bg-[#F7F4EC] h-full transition-all duration-1000"
                    style={{ width: `${(lockoutSec / 5) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      currentChallenge.type === 'CLUB_TO_CLUB'
                        ? 'ابحث بالاسم: مثلاً بنزيما، ميسي...'
                        : 'ابحث عن النادي أو المنتخب...'
                    }
                    className="w-full bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl px-4 py-3 font-black text-sm text-[#2C2A29] focus:outline-none focus:bg-white"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#5C4033]"
                    >
                      مسح
                    </button>
                  )}
                </div>

                {/* Suggestions List */}
                {suggestions.length > 0 && (
                  <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {suggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSubmitGuess(item)}
                        className="w-full text-right px-4 py-2.5 text-xs font-black text-[#2C2A29] border-b border-[#E5E0D5] hover:bg-[#8A9A5B] hover:text-[#F7F4EC] transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span>{item}</span>
                        <Send size={12} className="opacity-70" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Submit Guess Button */}
                <button
                  type="button"
                  disabled={!query.trim()}
                  onClick={() => handleSubmitGuess()}
                  className={`w-full py-3.5 rounded-xl font-black text-base border-2 border-[#2C2A29] transition-all flex items-center justify-center gap-2 ${
                    query.trim()
                      ? 'bg-[#8A9A5B] hover:bg-[#78884E] text-[#F7F4EC] shadow-[3px_3px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer'
                      : 'bg-[#D5CFC5] text-[#5C4033] opacity-60 cursor-not-allowed'
                  }`}
                >
                  <Send size={16} />
                  <span>إرسال الإجابة</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* =======================================================
            STATE: ROUND REVEAL
            ======================================================= */}
        {phase === 'ROUND_REVEAL' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8">
            <div className="w-16 h-16 bg-[#8A9A5B] border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl flex items-center justify-center text-3xl">
              🎉
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-[#2C2A29]">
                {roundWinnerName ? `${roundWinnerName} جابها صح!` : 'انتهى وقت الجولة!'}
              </h3>
              <p className="text-sm font-bold text-[#8A9A5B]">
                حلقة الوصل: <span className="text-[#2C2A29] font-black">{revealAnswer}</span>
              </p>
            </div>
            <p className="text-xs font-bold text-[#5C4033]">
              استعد للجولة التالية مباشرة...
            </p>
          </div>
        )}

        {/* =======================================================
            STATE: MATCH OVER
            ======================================================= */}
        {phase === 'MATCH_OVER' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8">
            <div className="w-20 h-20 bg-[#8A9A5B] border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-3xl flex items-center justify-center text-4xl animate-bounce">
              🏆
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-[#2C2A29]">انتهت الـ 5 جولات!</h2>
              <p className="text-base font-black text-[#8A9A5B]">
                مجموع نقاطك: <span className="font-mono text-xl">{myScore}</span>
              </p>
            </div>
            <p className="text-xs font-bold text-[#5C4033]">
              تابع شاشة العرض لرؤية منصة التتويج النهائية 🥇
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
