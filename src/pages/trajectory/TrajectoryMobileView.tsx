import { MobileTopBar } from '../../components/common/MobileTopBar';
import { CopyCodeButton } from '../../components/common/CopyCodeButton';
import { GeoTopNavControls } from '../../components/common/GeoTopNavControls';
import { ShareRoomButton } from '../../components/common/ShareRoomButton';
import { LobbyRuleBox } from '../../components/common/LobbyRuleBox';
import { MobileReadyButton } from '../../components/common/MobileReadyButton';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Compass,
  CheckCircle2,
  Clock,
  Trophy,
  Check,
  RotateCcw,
  Sparkles,
  LogOut,
  Search,
  AlertCircle,
  X,
} from 'lucide-react';
import { useRoom, roomBus, cleanRoomCode } from '../../lib/roomBus';
import { COUNTRIES_CATALOG, CountryItem } from '../../data/countries';
import { searchCountryCatalog } from '../../data/countryAliases';
import { useSafeCountdown } from '../../hooks/useSafeCountdown';
import { DemoSwitcher } from '../../components/common/DemoSwitcher';
import { sound } from '../../lib/audio';

interface TrajectoryMobileViewProps {
  channel?: any;
  roomCode?: string;
  playerId?: string;
  playerName?: string;
}

export const TrajectoryMobileView: React.FC<TrajectoryMobileViewProps> = ({
  channel,
  roomCode: propRoomCode,
  playerId: propPlayerId,
  playerName: propPlayerName,
}) => {
  const params = useParams();
  const roomCode = (propRoomCode || params.code || params.roomId || params.id || '').trim().toUpperCase() || 'TAQ1';
  const roomId = roomCode;

  useEffect(() => {
    console.log(`[DEBUG Mount] Room: "${roomCode}" | Component: "TrajectoryMobileView" | Path: "${window.location.pathname}"`);
    if (!roomCode) {
      console.error('[RoomCode Error]: roomCode is empty or undefined on mount!');
    }
  }, [roomCode]);
  const navigate = useNavigate();
  const { room } = useRoom(roomId);

  const trajectoryState = room?.trajectoryState;
  const currentRoundData = trajectoryState?.currentRoundData;

  // 1. Strict State Initialization
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isReadyLocally, setIsReadyLocally] = useState<boolean>(false);
  const [isNextReady, setIsNextReady] = useState<boolean>(false);
  const [lastReactionTime, setLastReactionTime] = useState<number>(0);

  const [nickname, setNickname] = useState<string>(() => {
    if (propPlayerName) return propPlayerName;
    try {
      const sessionPlayer = sessionStorage.getItem(`taghesi_player_${roomCode}`);
      if (sessionPlayer) {
        const parsed = JSON.parse(sessionPlayer);
        if (parsed?.name) return parsed.name;
      }
    } catch {}
    return localStorage.getItem('taghesi_playerName') || '';
  });

  const [playerId, setPlayerId] = useState<string>(() => {
    if (propPlayerId) return propPlayerId;
    try {
      const sessionPlayer = sessionStorage.getItem(`taghesi_player_${roomCode}`);
      if (sessionPlayer) {
        const parsed = JSON.parse(sessionPlayer);
        if (parsed?.id) return parsed.id;
      }
    } catch {}
    return localStorage.getItem('taghesi_playerId') || 'p_' + Math.random().toString(36).substring(2, 9);
  });

  const [isJoined, setIsJoined] = useState<boolean>(() => {
    try {
      const sessionPlayer = sessionStorage.getItem(`taghesi_player_${roomCode}`) || localStorage.getItem(`taghesi_player_${roomCode}`);
      if (sessionPlayer) {
        const parsed = JSON.parse(sessionPlayer);
        if (parsed?.id && parsed?.name) return true;
      }
    } catch {}
    return Boolean(propPlayerId || localStorage.getItem('taghesi_playerId'));
  });

  const handleJoin = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      alert('يرجى إدخال اسمك أولاً');
      return;
    }
    console.log('[على مسار الخط Join Clicked]:', nickname);

    const pid = playerId || 'p_' + Math.random().toString(36).substring(2, 9);
    setPlayerId(pid);
    localStorage.setItem('taghesi_playerId', pid);
    localStorage.setItem('taghesi_playerName', nickname.trim());

    const p = roomBus.joinPlayer(roomCode, nickname.trim(), 'avatar_1', 'team_a', pid);
    if (p?.id && p.id !== pid) {
      setPlayerId(p.id);
      localStorage.setItem('taghesi_playerId', p.id);
    }
    const finalPlayer = p || {
      id: pid,
      name: nickname.trim(),
      avatar: 'avatar_1' as const,
      team: 'team_a' as const,
      joinedAt: Date.now(),
      isOnline: true,
      isReady: false,
      lastPingMs: 25,
    };

    sessionStorage.setItem(`taghesi_player_${roomCode}`, JSON.stringify(finalPlayer));
    localStorage.setItem(`taghesi_player_${roomCode}`, JSON.stringify(finalPlayer));

    if (channel && channel.track && channel.state === 'joined') {
      channel.track(finalPlayer);
    } else {
      roomBus.trackPlayerPresence(roomCode, finalPlayer);
    }
    setIsJoined(true);
  };

  // Current user's playerId from prop / sessionStorage / localStorage
  const savedPlayerId = useMemo(() => {
    if (propPlayerId) return propPlayerId;
    if (typeof window === 'undefined') return '';
    try {
      const sessionPlayer = sessionStorage.getItem(`taghesi_player_${roomId}`);
      if (sessionPlayer) {
        const parsed = JSON.parse(sessionPlayer);
        if (parsed?.id) return parsed.id;
      }
    } catch {}
    return sessionStorage.getItem('taq_session_player_id') || localStorage.getItem('taghesi_playerId') || '';
  }, [roomId, propPlayerId]);

  const currentPlayer = useMemo(() => {
    return (
      room?.players?.find((p) => p.id === savedPlayerId) ||
      (savedPlayerId
        ? {
            id: savedPlayerId,
            name: nickname || propPlayerName || 'متسابق',
            avatar: 'avatar_1' as const,
            team: 'team_a' as const,
            joinedAt: Date.now(),
            isOnline: true,
            isReady: isReadyLocally,
            lastPingMs: 25,
          }
        : null)
    );
  }, [room?.players, savedPlayerId, nickname, propPlayerName, isReadyLocally]);

  const trajectoryPlayer = useMemo(() => {
    if (!trajectoryState || !savedPlayerId) return null;
    return (
      trajectoryState.players[savedPlayerId] || {
        id: savedPlayerId,
        name: nickname || propPlayerName || 'متسابق',
        score: 0,
        isReady: isReadyLocally,
        guessedCountryAr: null,
        guessedCountryEn: null,
        guessedIso3: null,
        hasSubmitted: hasSubmitted,
        isWinner: false,
      }
    );
  }, [trajectoryState, savedPlayerId, nickname, propPlayerName, isReadyLocally, hasSubmitted]);

  // Safe countdown for 30s
  const secondsRemaining = useSafeCountdown(trajectoryState?.roundEndsAt);

  const currentRoundNum = trajectoryState?.currentRound || 1;

  // Check if player already submitted for the current round (from local state or room sync)
  const isAlreadySubmitted =
    hasSubmitted ||
    Boolean(
      trajectoryPlayer?.hasSubmitted &&
        trajectoryState?.currentRound === currentRoundNum &&
        (trajectoryPlayer?.guessedCountryAr ||
          trajectoryPlayer?.guessedCountryEn ||
          trajectoryPlayer?.guessedIso3)
    );

  // Filtered country autocomplete candidates with Arabic normalizer & aliases
  const filteredCountries = useMemo(() => {
    return searchCountryCatalog(searchQuery, COUNTRIES_CATALOG, currentRoundData?.originIso);
  }, [searchQuery, currentRoundData?.originIso]);

  // Unconditional reset on every round change
  useEffect(() => {
    console.log(`[MOBILE RESET] Round changed to: ${currentRoundNum}. Resetting input states.`);
    setHasSubmitted(false);
    setSelectedCountry(null);
    setSearchQuery('');
    setIsReadyLocally(false);
    setIsNextReady(false);
  }, [currentRoundNum]);

  // Also listen to broadcast ROUND_STARTED from both channel and roomBus
  useEffect(() => {
    const handleRoundReset = (payload?: any) => {
      console.log(`[MOBILE RESET] Round started event received: ${payload?.round || currentRoundNum}. Resetting input states.`);
      setHasSubmitted(false);
      setSelectedCountry(null);
      setSearchQuery('');
      setIsReadyLocally(false);
      setIsNextReady(false);
    };

    const unsub = roomBus.on('ROUND_STARTED', (payload) => handleRoundReset(payload?.data || payload));
    if (channel) {
      channel.on('broadcast', { event: 'ROUND_STARTED' }, ({ payload }: any) => handleRoundReset(payload));
    }
    return () => unsub();
  }, [channel, currentRoundNum]);

  // Safe auto-submit: only trigger when round is actively live and endsAt is within fresh expiry threshold (< 2s)
  useEffect(() => {
    const isRoundLive =
      trajectoryState?.gameState === 'PLAYING' || trajectoryState?.gameState === 'ROUND_ACTIVE';
    const endsAt = trajectoryState?.roundEndsAt;
    const isFreshExpired = endsAt ? (Date.now() >= endsAt && Date.now() - endsAt < 2000) : false;

    if (isRoundLive && secondsRemaining === 0 && isFreshExpired && !hasSubmitted) {
      if (selectedCountry) {
        handleConfirmSubmit();
      } else {
        setHasSubmitted(true);
      }
    }
  }, [secondsRemaining, trajectoryState?.gameState, trajectoryState?.roundEndsAt, selectedCountry, hasSubmitted]);

  const handleSelectCountry = (country: CountryItem) => {
    sound.playClick();
    setSelectedCountry(country);
    setSearchQuery(country.nameAr);
  };

  const handleConfirmSubmit = () => {
    if (!selectedCountry || !savedPlayerId || hasSubmitted) return;
    setHasSubmitted(true);
    sound.playClick();
    roomBus.submitTrajectoryGuess(
      roomId,
      savedPlayerId,
      selectedCountry.nameAr,
      selectedCountry.nameEn,
      selectedCountry.iso3
    );
    roomBus.broadcastPlayerSubmission(
      roomId,
      savedPlayerId,
      selectedCountry,
      trajectoryState?.currentRound || 1
    );
  };

  const handleToggleReady = () => {
    const pid = savedPlayerId || playerId;
    if (!pid || isReadyLocally) return;
    setIsReadyLocally(true);
    sound.playClick();
    roomBus.readyForNextTrajectoryRound(roomId, pid);
    roomBus.broadcastPlayerReadyUpdate(roomId, pid, true);

    const clean = cleanRoomCode(roomId);
    roomBus.emit('PLAYER_NEXT_READY', clean, { playerId: pid, isReady: true });
    if (channel && channel.send) {
      try {
        channel.send({
          type: 'broadcast',
          event: 'PLAYER_NEXT_READY',
          payload: { playerId: pid, isReady: true, roomCode: clean },
        });
        channel.send({
          type: 'broadcast',
          event: 'PLAYER_READY_UPDATE',
          payload: { playerId: pid, isReady: true, roomCode: clean },
        });
      } catch (e) {
        console.warn('broadcast error:', e);
      }
    }

    if (channel && channel.track && channel.state === 'joined') {
      channel.track({
        id: pid,
        name: nickname || currentPlayer?.name || 'متسابق',
        isReady: true,
      });
    } else {
      roomBus.trackPlayerPresence(roomId, {
        id: pid,
        name: nickname || currentPlayer?.name || 'متسابق',
        isReady: true,
      });
    }
  };

  const handleToggleNextReady = async () => {
    const nextState = !isNextReady;
    setIsNextReady(nextState);
    sound.playClick();

    const pid = savedPlayerId || playerId;
    const clean = cleanRoomCode(roomId);

    roomBus.emit('PLAYER_NEXT_ROUND_READY', clean, {
      playerId: pid,
      isReady: nextState,
      round: currentRoundNum,
    });
    roomBus.emit('PLAYER_NEXT_READY', clean, { playerId: pid, isReady: nextState });

    if (channel && channel.send) {
      try {
        await channel.send({
          type: 'broadcast',
          event: 'PLAYER_NEXT_ROUND_READY',
          payload: {
            playerId: pid,
            isReady: nextState,
            round: currentRoundNum,
          },
        });
        await channel.send({
          type: 'broadcast',
          event: 'PLAYER_NEXT_READY',
          payload: { playerId: pid, isReady: nextState, roomCode: clean },
        });
        await channel.send({
          type: 'broadcast',
          event: 'PLAYER_READY_UPDATE',
          payload: { playerId: pid, isReady: nextState, roomCode: clean },
        });
      } catch (e) {
        console.warn('send PLAYER_NEXT_ROUND_READY error:', e);
      }
    }
  };

  // Exit Room Handler
  const handleExitGame = () => {
    const confirmed = window.confirm('هل أنت متأكد من الخروج من اللعبة؟');
    if (!confirmed) return;
    sound.playClick();
    if (savedPlayerId) {
      roomBus.leavePlayer(roomId, savedPlayerId);
    }
    navigate('/');
  };

  // Ephemeral Live Reactions Handler (0.5s)
  const handleSendReaction = (emoji: string) => {
    const now = Date.now();
    if (now - lastReactionTime < 300) return; // 300ms spam rate-limit
    setLastReactionTime(now);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(40);
      } catch {}
    }
    sound.playClick();

    if (savedPlayerId) {
      roomBus.emit('PLAYER_REACTION', roomId, {
        playerId: savedPlayerId,
        emoji,
      });
    }
  };

  const isLobby =
    !trajectoryState ||
    trajectoryState.gameState === 'GAME_LOBBY' ||
    trajectoryState.gameState === 'LOBBY' ||
    trajectoryState.currentRound === 0;

  const isPlaying =
    !isLobby &&
    (trajectoryState?.gameState === 'ROUND_ACTIVE' || trajectoryState?.gameState === 'PLAYING');

  const isRevealing = !isLobby && trajectoryState?.gameState === 'REVEALING';
  const isIntermission = !isLobby && trajectoryState?.gameState === 'ROUND_INTERMISSION';
  const isGameOver = !isLobby && trajectoryState?.gameState === 'GAME_OVER';


  

  

  if (!isJoined) {
    return (
      <div className="w-full max-w-lg mx-auto h-[100dvh] overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] text-[#2C2A29] flex flex-col justify-between p-4 select-none" dir="rtl">
        <MobileTopBar roomCode={roomCode} onExit={handleExitGame} />

        <main className="my-auto max-w-sm mx-auto w-full">
          <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-6 shadow-[4px_4px_0px_#2C2A29] text-center flex flex-col gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] flex items-center justify-center text-white mx-auto">
              <Compass className="w-7 h-7" />
            </div>

            <div>
              <h1 className="text-2xl font-black font-display text-[#000000]">على مسار الخط</h1>
              <p className="text-xs font-bold text-[#5C4033] mt-1">
                رمز الغرفة: <span className="font-mono text-[#000000] font-black">{roomCode}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#000000] mb-1.5 text-right">
                اسمك المستعار:
              </label>
              <input
                type="text"
                autoFocus
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="اكتب اسمك هنا..."
                maxLength={16}
                className="w-full text-base font-bold py-3 px-3.5 rounded-xl border-2 border-[#2C2A29] bg-[#FAF7F2] focus:outline-none focus:border-[#8A9A5B] shadow-inner text-[#000000]"
              />
            </div>

            <button
              type="button"
              onClick={handleJoin}
              className="w-full py-3.5 bg-[#8A9A5B] hover:bg-[#2C2A29] text-white hover:text-[#E5E0D5] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-xl font-display font-black text-base active:translate-y-0.5 active:shadow-[1px_1px_0px_#2C2A29] transition-all cursor-pointer"
            >
              دخول
            </button>
          </div>
        </main>

        <footer className="text-center text-xs text-[#5C4033] font-semibold">
          طق عصي — منصة ألعاب تفاعلية
        </footer>
      </div>
    );
  }

  return (
    <div dir="rtl" className="w-full max-w-lg mx-auto h-[100dvh] flex flex-col justify-between p-3.5 pb-36 overflow-y-auto bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] text-[#2C2A29] font-sans select-none"
    >
      <MobileTopBar roomCode={room?.code || roomId} onExit={handleExitGame} points={trajectoryPlayer?.score || 0} title={isLobby ? 'لوبي الانتظار' : isPlaying ? `الجولة ${trajectoryState?.currentRound || 1} من ${trajectoryState?.totalRounds || 5}` : undefined} />

      {/* Main Content Areas based on Game State */}
      <main className="flex-1 flex flex-col p-4 max-w-md w-full mx-auto justify-between">
        {/* LOBBY VIEW */}
        {isLobby && (
          <main className="flex-1 flex flex-col items-center justify-center my-2 gap-4 max-w-sm mx-auto w-full">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-5 shadow-[4px_4px_0px_#2C2A29] text-center w-full flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] flex items-center justify-center text-white">
                <Compass className="w-7 h-7 text-white" />
              </div>

              <div>
                <h1 className="text-2xl font-black font-display text-[#000000]">على مسار الخط</h1>
                <p className="text-xs font-bold text-[#5C4033] mt-0.5">
                  أنت جاهز يا {currentPlayer?.name || trajectoryPlayer?.name || 'متسابق'}!
                </p>
              </div>

              <LobbyRuleBox
                summary="انتبه لمسار السهم المنطلق من الدولة الأساسية، واختر دولة يمر فوقها السهم. كلما كانت دولتك أبعد على المسار كسبت نقاطاً أعلى!"
                className="text-xs p-3"
              />

              <MobileReadyButton
                isReady={Boolean(currentPlayer?.isReady || trajectoryPlayer?.isReady || isReadyLocally)}
                onToggle={() => {
                  sound.playClick();
                  const pid = savedPlayerId || playerId;
                  if (!pid) return;
                  const nextReady = !isReadyLocally;
                  setIsReadyLocally(nextReady);
                  roomBus.togglePlayerReady(roomId, pid);
                  roomBus.broadcastPlayerReadyUpdate(roomId, pid, nextReady);
                  if (channel && channel.track && channel.state === 'joined') {
                    channel.track({
                      id: pid,
                      name: nickname || (currentPlayer?.name ?? 'متسابق'),
                      isReady: nextReady,
                    });
                  } else {
                    roomBus.trackPlayerPresence(roomId, {
                      id: pid,
                      name: nickname || (currentPlayer?.name ?? 'متسابق'),
                      isReady: nextReady,
                    });
                  }
                }}
              />

              <ShareRoomButton roomCode={room?.code || roomId} />

              <div className="text-center text-xs font-bold text-[#5C4033] bg-[#EDE7D9] px-4 py-1.5 rounded-xl border border-[#2C2A29]/20 w-full">
                الجاهزون: {(() => {
                const map = new Map<string, any>();
                Object.values(trajectoryState?.players || {}).forEach((p: any) => {
                  if (p?.name) map.set(p.name.trim().toLowerCase(), p);
                });
                const list = Array.from(map.values());
                return `${list.filter(p => p.isReady).length} من ${list.length || 1}`;
              })()} متسابق
              </div>
            </div>
          </main>
        )}

        {/* PLAYING VIEW */}
        {isPlaying && (
          <div className="flex-1 flex flex-col gap-4">
            {/* Round Prompt Banner */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29]/15 rounded-2xl p-4 shadow-tactile text-center">
              <span className="text-xs font-bold text-[#C68B59] uppercase tracking-wider block mb-1">
                نقطة الانطلاق
              </span>
              <div className="text-2xl font-black text-[#2C2A29]">
                {currentRoundData?.originCountry || 'جاري التحميل...'}
              </div>
              <p className="text-xs font-bold text-[#2C2A29]/60 mt-1">
                اتجاه المسار: {currentRoundData?.bearing}° {currentRoundData?.description ? `(${currentRoundData.description})` : ''}
              </p>
            </div>

            {/* Input & Autocomplete Area */}
            {!isAlreadySubmitted ? (
              <div className="flex-1 flex flex-col gap-3">
                <div className="relative">
                  <div className="flex items-center bg-[#F7F4EC] border-2 border-[#2C2A29]/20 rounded-xl px-3 py-2 shadow-tactile focus-within:border-[#C68B59]">
                    <Search className="w-5 h-5 text-[#2C2A29]/50 ml-2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSelectedCountry(null);
                      }}
                      placeholder="ابحث عن دولة (مثال: إيطاليا، اليابان...)"
                      className="w-full bg-transparent text-base font-bold text-[#2C2A29] placeholder-[#2C2A29]/40 outline-none"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCountry(null);
                        }}
                        className="text-[#2C2A29]/40 hover:text-[#2C2A29]"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Autocomplete Dropdown List */}
                  {searchQuery && !selectedCountry && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#F7F4EC] border-2 border-[#2C2A29]/20 rounded-xl shadow-tactile max-h-56 overflow-y-auto z-40 divide-y divide-[#2C2A29]/10">
                      {filteredCountries.length > 0 ? (
                        filteredCountries.map((c) => (
                          <button
                            key={c.iso3 || c.nameEn}
                            onClick={() => handleSelectCountry(c)}
                            className="w-full text-right px-4 py-2.5 hover:bg-[#C68B59]/15 flex items-center justify-between transition-colors"
                          >
                            <span className="font-bold text-[#2C2A29]">{c.nameAr}</span>
                            <span className="text-xs font-bold text-[#2C2A29]/50 font-mono">{c.nameEn}</span>
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs font-bold text-[#2C2A29]/50">
                          لم يتم العثور على دولة مطابقة
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Country Card */}
                {selectedCountry && (
                  <div className="bg-[#8A9A5B]/15 border-2 border-[#8A9A5B]/40 rounded-xl p-3.5 flex items-center justify-between shadow-tactile animate-fade-in">
                    <div>
                      <span className="text-[11px] font-bold text-[#8A9A5B] block">الدولة المختارة</span>
                      <span className="text-lg font-black text-[#2C2A29]">{selectedCountry.nameAr}</span>
                    </div>
                    <CheckCircle2 className="w-6 h-6 text-[#8A9A5B]" />
                  </div>
                )}

                {/* Notice Card */}
                <div className="bg-[#F7F4EC]/50 border border-[#2C2A29]/10 rounded-lg p-2 text-[10px] font-bold text-[#2C2A29]/70 leading-relaxed text-center shrink-0">
                  الأبعد على المسار يكسب نقاطاً وترتيباً أعلى!
                </div>
              </div>
            ) : (
              /* Already Submitted Wait Card */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#F7F4EC] border-2 border-[#2C2A29]/15 rounded-2xl shadow-tactile">
                <div className="w-16 h-16 rounded-full bg-[#8A9A5B]/20 border-2 border-[#8A9A5B] flex items-center justify-center mb-3">
                  <Check className="w-8 h-8 text-[#8A9A5B]" />
                </div>
                <h3 className="text-lg font-black text-[#2C2A29] mb-1">تم تثبيت إجابتك</h3>
                <p className="text-base font-bold text-[#8A9A5B] mb-3">
                  {selectedCountry ? selectedCountry.nameAr : trajectoryPlayer?.guessedCountryAr || 'تم الإرسال'}
                </p>
                <p className="text-xs font-bold text-[#2C2A29]/60">
                  خلك متابع مع شاشة التلفزيون لرؤية مسار الشعاع والنتائج!
                </p>
              </div>
            )}

            {/* Bottom Submit Action Button: Elevated above reactions */}
            {!hasSubmitted && (
              <div className="fixed bottom-16 left-4 right-4 z-30 max-w-lg mx-auto">
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={!selectedCountry}
                  className={`w-full py-4 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-2 border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] active:translate-y-0.5 active:shadow-[1px_1px_0px_#2C2A29] cursor-pointer ${
                    selectedCountry
                      ? 'bg-[#8A9A5B] hover:bg-[#2C2A29] text-white hover:text-[#E5E0D5]'
                      : 'bg-[#EDE7D9] text-[#2C2A29]/40 border-stone-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  <span>تثبيت الدولة واعتماد التوقع</span>
                  <Check className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* RESULTS & INTERMISSION VIEW */}
        {(isRevealing || isIntermission) && (
          <div className="flex-1 flex flex-col items-center justify-between py-4 min-h-0 overflow-y-auto">
            <div className="w-full bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-5 shadow-[4px_4px_0px_#2C2A29] text-center my-auto">
              <span className="text-xs font-bold text-[#C68B59] block mb-1">نتيجة جولتك</span>
              <div className="text-xl font-black text-[#2C2A29] mb-2">
                {trajectoryPlayer?.guessedCountryAr || 'لم يتم التخمين'}
              </div>

              {trajectoryPlayer?.isValidIntersect ? (
                <div className="bg-[#8A9A5B]/20 border-2 border-[#8A9A5B] rounded-xl p-3 my-3">
                  <div className="text-sm font-bold text-[#8A9A5B] mb-0.5">توقع صحيح يتقاطع مع المسار!</div>
                  <div className="text-2xl font-black text-[#2C2A29]">
                    {trajectoryPlayer.entryDistanceKm?.toLocaleString('ar-SA')} كم
                  </div>
                  <div className="text-xs font-bold text-[#2C2A29]/70 mt-1">
                    المركز {trajectoryPlayer.rank} • +{trajectoryPlayer.currentPointsAwarded} pt
                  </div>
                </div>
              ) : (
                <div className="bg-[#A35A5A]/15 border-2 border-[#A35A5A]/40 rounded-xl p-3 my-3">
                  <div className="text-sm font-bold text-[#A35A5A]">لم يتقاطع المسار مع هذه الدولة</div>
                  <div className="text-xs font-bold text-[#2C2A29]/60 mt-1">0 pt لهذه الجولة</div>
                </div>
              )}

              <div className="text-sm font-bold text-[#2C2A29]/80 mt-2">
                مجموع نقاطك الكلي: <span className="font-black text-[#C68B59] text-base">{trajectoryPlayer?.score || 0} pt</span>
              </div>
            </div>

            {/* Tactile Ready for Next Question Button */}
            <div className="w-full pt-4">
              <button
                type="button"
                onClick={handleToggleNextReady}
                className={`w-full py-3.5 px-6 rounded-xl font-bold text-base border-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isNextReady
                    ? 'bg-stone-400 text-stone-800 border-2 border-[#2C2A29] shadow-[1px_1px_0px_#2C2A29] translate-y-1'
                    : 'bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-xl font-bold hover:-translate-y-1 active:translate-y-0.5'
                }`}
              >
                {isNextReady ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-stone-800" />
                    <span>بانتظار باقي المتسابقين...</span>
                  </>
                ) : (
                  <span>جاهز للسؤال التالي ◄</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* GAME OVER PODIUM VIEW */}
        {isGameOver && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <div className="w-20 h-20 rounded-2xl bg-[#C68B59] text-white flex items-center justify-center shadow-tactile mb-4">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-black text-[#2C2A29] mb-1">انتهت الجولات الخمس!</h2>
            <p className="text-sm font-bold text-[#2C2A29]/70 mb-4">
              مجموع نقاطك النهائي:{' '}
              <span className="font-black text-[#C68B59] text-lg">{trajectoryPlayer?.score || 0}</span> pt
            </p>
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29]/15 rounded-xl p-4 shadow-tactile text-sm font-bold text-[#2C2A29]/80 mb-6">
              شاهد منصة التتويج للمراكز الأولى على شاشة التلفزيون!
            </div>
          </div>
        )}
      </main>

      {/* Floating 0.5s Reaction Bar at the very bottom */}
      <div className="fixed bottom-2 left-0 right-0 z-10 flex justify-center gap-4 pointer-events-auto">
        <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-full px-5 py-1.5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => handleSendReaction('😴')}
            className="text-2xl active:scale-125 transition-transform hover:scale-110 cursor-pointer p-1"
            title="نعسان"
          >
            😴
          </button>
          <div className="w-0.5 h-6 bg-[#2C2A29]/20" />
          <button
            type="button"
            onClick={() => handleSendReaction('😝')}
            className="text-2xl active:scale-125 transition-transform hover:scale-110 cursor-pointer p-1"
            title="مطلع لسانه"
          >
            😝
          </button>
          <div className="w-0.5 h-6 bg-[#2C2A29]/20" />
          <button
            type="button"
            onClick={() => handleSendReaction('😡')}
            className="text-2xl active:scale-125 transition-transform hover:scale-110 cursor-pointer p-1"
            title="معصب"
          >
            😡
          </button>
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      

      <DemoSwitcher roomId={roomId} currentRole="player" />
    </div>
  );
};