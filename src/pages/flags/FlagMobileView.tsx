import { MobileTopBar } from '../../components/common/MobileTopBar';
import { CopyCodeButton } from '../../components/common/CopyCodeButton';
import { GeoTopNavControls } from '../../components/common/GeoTopNavControls';
import { ShareRoomButton } from '../../components/common/ShareRoomButton';
import { LobbyRuleBox } from '../../components/common/LobbyRuleBox';
import { MobileReadyButton } from '../../components/common/MobileReadyButton';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Check,
  Clock,
  Sparkles,
  Trophy,
  RotateCcw,
  Sliders,
  CheckCircle2,
  LogOut,
  Award,
  Share2
} from 'lucide-react';
import { useRoom, roomBus } from '../../lib/roomBus';
import { FlagComponents, flagsDataset } from '../../data/flags';
import { calculateColorCloseness, hsvToHex } from '../../lib/colorMath';
import { sound } from '../../lib/audio';

interface FlagMobileViewProps {
  channel?: any;
  roomCode?: string;
  playerId?: string;
  playerName?: string;
}

export const FlagMobileView: React.FC<FlagMobileViewProps> = ({
  channel,
  roomCode: propRoomCode,
  playerId: propPlayerId,
  playerName: propPlayerName,
}) => {
  const params = useParams();
  const roomCode = (propRoomCode || params.code || params.roomId || params.id || '').trim().toUpperCase() || 'TAQ1';
  const roomId = roomCode;

  useEffect(() => {
    console.log(`[DEBUG Mount] Room: "${roomCode}" | Component: "FlagMobileView" | Path: "${window.location.pathname}"`);
    if (!roomCode) {
      console.error('[RoomCode Error]: roomCode is empty or undefined on mount!');
    }
  }, [roomCode]);
  const navigate = useNavigate();
  const { room } = useRoom(roomId);

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

  // Handle Join button click in FlagMobileView
  const handleJoin = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      alert('يرجى إدخال اسمك أولاً');
      return;
    }
    console.log('[Flag Join Clicked]:', nickname);

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

  

  const [hue, setHue] = useState<number>(180);
  const [shade, setShade] = useState<number>(0.85); // 0 (dark) to 1 (bright)
  const [toastMessage, setToastMessage] = useState<string>('');
  const [isReadyLocally, setIsReadyLocally] = useState<boolean>(false);
  const [hasSubmittedLocally, setHasSubmittedLocally] = useState<boolean>(false);

  // Slider refs for exact pointer calculation in LTR
  const hueTrackRef = useRef<HTMLDivElement>(null);
  const shadeTrackRef = useRef<HTMLDivElement>(null);
  const isDraggingHue = useRef(false);
  const isDraggingShade = useRef(false);

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

  // Sync / ensure current player is connected and in room
  useEffect(() => {
    if (!room) return;

    if (!savedPlayerId && !isJoined) {
      // Show inline join screen instead of kicking
      return;
    }

    // Auto register into flagState if not yet registered
    const p = room.players.find((pl) => pl.id === savedPlayerId);
    if (room.flagState && !room.flagState.players[savedPlayerId] && p) {
      room.flagState.players[savedPlayerId] = {
        id: p.id,
        name: p.name,
        score: 0,
        isReady: false,
        currentGuessHex: null,
        currentAccuracy: null,
      };
      roomBus.saveRoom(room);
    }
  }, [room, savedPlayerId, roomId, navigate, isJoined]);

  const flagState = room?.flagState;
  const player =
    flagState?.players[savedPlayerId] ||
    (savedPlayerId
      ? {
          id: savedPlayerId,
          name: nickname || propPlayerName || 'متسابق',
          score: 0,
          isReady: isReadyLocally,
          currentGuessHex: null,
          currentAccuracy: null,
        }
      : null);

  // Ref for fresh round tracking
  const currentRoundRef = useRef(flagState?.currentRound || 1);
  useEffect(() => {
    console.log(`[MOBILE RESET] Round changed to: ${flagState?.currentRound}. Resetting input states.`);
    currentRoundRef.current = flagState?.currentRound || 1;
    setHasSubmittedLocally(false);
    setIsReadyLocally(false);
    setHue(180);
    setShade(0.85);
  }, [flagState?.currentRound]);

  // Listen for authoritative ROUND_STARTED from TV Screen (SSOT)
  useEffect(() => {
    const handleRoundReset = (payload?: any) => {
      console.log(`[MOBILE RESET] Round started event received: ${payload?.round || flagState?.currentRound}. Resetting input states.`);
      setIsReadyLocally(false);
      setHasSubmittedLocally(false);
      setHue(180);
      setShade(0.85);
      isDraggingHue.current = false;
      isDraggingShade.current = false;
    };

    const unsub = roomBus.on('ROUND_STARTED', (payload) => {
      const cleanCode = roomId.toUpperCase().replace(/^ROOM_/, '');
      if (payload.roomCode && payload.roomCode !== cleanCode) return;
      handleRoundReset(payload?.data || payload);
    });

    if (channel) {
      channel.on('broadcast', { event: 'ROUND_STARTED' }, ({ payload }: any) => handleRoundReset(payload));
    }

    return () => unsub();
  }, [roomId, channel, flagState?.currentRound]);

  // Reset local ready flag when transitioning to PLAYING
  useEffect(() => {
    if (flagState?.gameState === 'PLAYING') {
      setIsReadyLocally(false);
      isDraggingHue.current = false;
      isDraggingShade.current = false;
    }
  }, [flagState?.gameState]);

  // Selected hex color from the 2 sliders
  const currentHex = useMemo(() => {
    return hsvToHex(hue / 360, 1, shade);
  }, [hue, shade]);

  // Current flag dataset item with null safety
  const currentFlagData = useMemo(() => {
    if (!flagState?.currentFlagId) return flagsDataset[0];
    const found = flagsDataset.find((f) => f.id === flagState.currentFlagId);
    return found || flagsDataset[0];
  }, [flagState?.currentFlagId]);

  const FlagComponent = useMemo(() => {
    if (!currentFlagData || !FlagComponents[currentFlagData.id]) {
      return FlagComponents['sa'] || FlagComponents['qatar'] || (() => null);
    }
    return FlagComponents[currentFlagData.id];
  }, [currentFlagData]);

  // Safe Calculation of Hue from ClientX strictly in LTR (0deg on left to 360deg on right)
  const updateHueFromClientX = useCallback((clientX: number) => {
    if (!hueTrackRef.current) return;
    const rect = hueTrackRef.current.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const percent = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const newHue = Math.round(percent * 360);
    setHue(newHue);
  }, []);

  // Safe Calculation of Shade from ClientX strictly in LTR (0 dark on left to 1 bright on right)
  const updateShadeFromClientX = useCallback((clientX: number) => {
    if (!shadeTrackRef.current) return;
    const rect = shadeTrackRef.current.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const percent = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const newShade = Math.round(percent * 100) / 100;
    setShade(newShade);
  }, []);

  // Window pointer listeners with null guards for smooth dragging
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDraggingHue.current && hueTrackRef.current) {
        updateHueFromClientX(e.clientX);
      } else if (isDraggingShade.current && shadeTrackRef.current) {
        updateShadeFromClientX(e.clientX);
      }
    };

    const handlePointerUp = () => {
      isDraggingHue.current = false;
      isDraggingShade.current = false;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [updateHueFromClientX, updateShadeFromClientX]);



  // Voluntary Exit handler
  const handleExit = () => {
    const confirmed = window.confirm('هل أنت متأكد من الخروج من اللعبة؟');
    if (!confirmed) return;

    sound.playClick();
    if (savedPlayerId) {
      roomBus.leavePlayer(roomId, savedPlayerId);
    }
    navigate('/');
  };

  // Share room link handler
  const handleShare = async () => {
    sound.playClick();
    const joinUrl = `${window.location.origin}/join?code=${room?.code || roomCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'لعبة طق عصي',
          text: `ادخل معنا في لعبة طق عصي بالكود: ${room?.code || roomCode}`,
          url: joinUrl,
        });
      } catch {
        // User dismissed
      }
    } else {
      try {
        await navigator.clipboard.writeText(joinUrl);
        setToastMessage('تم نسخ رابط الغرفة بنجاح!');
        setTimeout(() => setToastMessage(''), 3000);
      } catch {
        setToastMessage(joinUrl);
        setTimeout(() => setToastMessage(''), 4000);
      }
    }
  };

  // Toggle Ready in Lobby
  const handleToggleReady = () => {
    sound.playClick();
    const pid = savedPlayerId || playerId;
    const nextReady = !isReadyLocally;
    setIsReadyLocally(nextReady);
    if (channel && channel.track && channel.state === 'joined') {
      channel.track({
        id: pid,
        name: nickname || (player?.name ?? 'متسابق'),
        isReady: nextReady,
      });
    } else {
      roomBus.trackPlayerPresence(roomId, {
        id: pid,
        name: nickname || (player?.name ?? 'متسابق'),
        isReady: nextReady,
      });
    }
    roomBus.broadcastPlayerReadyUpdate(roomId, pid, nextReady);
  };

  // Ready for next round in Intermission: Mobile announces readiness to TV (SSOT)
  const handleNextRoundReady = () => {
    sound.playClick();
    const pid = savedPlayerId || player?.id || '';
    if (pid) {
      setIsReadyLocally(true);
      roomBus.emitPlayerRoundReady(roomId, pid, currentRoundRef.current);
    }
  };

  // Submit color guess ("خلصت")
  const handleSubmitGuess = () => {
    sound.playClick();
    setHasSubmittedLocally(true);
    const pid = savedPlayerId || playerId;
    const score = calculateColorCloseness(currentHex, currentFlagData.targetHex);
    roomBus.submitFlagGuess(roomId, pid, currentHex, score);
    roomBus.broadcastPlayerSubmission(roomId, pid, { hex: currentHex, score }, flagState?.currentRound || 1);
  };

  // --- 0. JOIN SCREEN (If player not joined yet) ---
  if (!isJoined) {
    return (
      <div className="w-full max-w-lg mx-auto h-[100dvh] overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] text-[#2C2A29] flex flex-col justify-between p-4 select-none" dir="rtl">
        <MobileTopBar roomCode={roomCode} onExit={handleExit} />

        <main className="my-auto max-w-sm mx-auto w-full">
          <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-6 shadow-[4px_4px_0px_#2C2A29] text-center flex flex-col gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] flex items-center justify-center text-white mx-auto">
              <Sliders className="w-7 h-7" />
            </div>

            <div>
              <h1 className="text-2xl font-black font-display text-[#000000]">لون العلم</h1>
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

  if (!room || !flagState || !player) {
    return (
      <div className="min-h-screen bg-[#E5E0D5] flex items-center justify-center p-6 text-center text-[#24221E] font-bold">
        جاري الاتصال باللعبة...
      </div>
    );
  }

  // --- 1. LOBBY PHASE ---
  if (flagState.gameState === 'LOBBY') {
    const dedupMap = new Map<string, any>();
    Object.values(flagState.players).forEach((p: any) => {
      if (!p || !p.name || p.id === 'host_tv') return;
      const key = p.name.trim().toLowerCase();
      if (!dedupMap.has(key)) dedupMap.set(key, p);
    });
    const playersList = Array.from(dedupMap.values());
    const readyCount = playersList.filter((p) => p.isReady).length;

    return (
      <div className="w-full max-w-lg mx-auto h-[100dvh] overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] text-[#2C2A29] flex flex-col justify-between p-3.5 select-none selection:bg-[#8A9A5B] selection:text-white" dir="rtl">
        <MobileTopBar roomCode={room?.code || roomId} onExit={handleExit} points={player?.score || 0} title="لوبي الانتظار" />

        {toastMessage && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-[#8A9A5B] text-white border-2 border-[#4A463D] shadow-lg text-sm font-bold flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        <main className="flex-1 flex flex-col items-center justify-center my-2 gap-4 max-w-sm mx-auto w-full">
          <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-5 shadow-[4px_4px_0px_#2C2A29] text-center w-full flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] flex items-center justify-center text-white">
              <Sliders className="w-7 h-7" />
            </div>

            <div>
              <h1 className="text-2xl font-black font-display text-[#000000]">لون العلم</h1>
              <p className="text-xs font-bold text-[#5C4033] mt-0.5">
                أنت جاهز يا {(player?.name || nickname || 'متسابق')}!
              </p>
            </div>

            <LobbyRuleBox
              summary="اختر درجات الألوان المناسبة لمساحات العلم بدقة عبر أشرطة التمرير. الفائز هو صاحب أعلى نسبة مطابقة للألوان الأصلية!"
              className="text-xs p-3"
            />

            <MobileReadyButton
              isReady={Boolean(Boolean(player?.isReady || isReadyLocally))}
              onToggle={handleToggleReady}
            />

            <ShareRoomButton roomCode={room.code} />

            <div className="text-center text-xs font-bold text-[#5C4033] bg-[#EDE7D9] px-4 py-1.5 rounded-xl border border-[#2C2A29]/20 w-full">
              الجاهزون: {readyCount} من {playersList.length} متسابق
            </div>
          </div>
        </main>

        <footer className="text-center text-xs text-[#4A463D] font-semibold border-t border-[#4A463D]/20 pt-2">
          تبدأ اللعبة تلقائياً عندما يضغط جميع المتسابقين "جاهز"
        </footer>
      </div>
    );
  }

  // --- 2. PLAYING / GUESSING PHASE (25s) ---
  if (flagState.gameState === 'PLAYING') {
    const hasSubmitted = hasSubmittedLocally || (player?.currentGuessHex !== null && player?.currentGuessHex !== undefined);

    return (
      <div className="w-full max-w-lg mx-auto h-[100dvh] overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] text-[#2C2A29] flex flex-col justify-between p-3.5 select-none selection:bg-[#8A9A5B] selection:text-white" dir="rtl">
        <MobileTopBar roomCode={room?.code || roomId} onExit={handleExit} points={player?.score || 0} title={`الجولة ${flagState.currentRound} من ${flagState.totalRounds}`} />

        <main className="flex-1 flex flex-col items-center justify-center my-1 gap-3 max-w-md mx-auto w-full">
          {/* Flag Header Info: Displays ONLY flag name without any color hints! */}
          <div className="flex items-center justify-between w-full px-1">
            <span className="text-base font-black text-[#24221E]">
              {currentFlagData.name}
            </span>
            <div className="flex items-center gap-1 font-mono font-black text-sm text-[#C68B59] bg-[#F7F4EC] px-2.5 py-0.5 rounded-lg border border-[#4A463D]">
              <Clock className="w-3.5 h-3.5" />
              <span>{flagState.countdown}s</span>
            </div>
          </div>

          {/* Interactive SVG Flag Preview */}
          <div className="w-full max-h-[22vh] aspect-[16/10] bg-[#F7F4EC] border-3 border-[#4A463D] rounded-2xl p-1.5 shadow-[inset_0_2px_4px_rgba(255,255,255,0.7),0_4px_0_#38342C] flex items-center justify-center overflow-hidden shrink-0">
            <div className="w-full h-full rounded-xl overflow-hidden border border-[#4A463D]/30">
              <FlagComponent fillColor={currentHex} showQuestionMark={false} className="w-full h-full object-fill" />
            </div>
          </div>

          {/* COLOR SLIDERS CONTAINER: Strictly LTR to fix inverted slider bug! */}
          <div className="w-full bg-[#F7F4EC] border-3 border-[#4A463D] rounded-2xl p-3.5 shadow-[0_4px_0_#4A463D] flex flex-col gap-3">
            {/* 1. Hue Slider (Spectrum) */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs font-bold text-[#24221E]">
                <span>شريط الألوان (Hue)</span>
                <span className="font-mono text-[11px] text-[#4A463D]">{hue}°</span>
              </div>

              {/* LTR Slider Track */}
              <div
                dir="ltr"
                ref={hueTrackRef}
                onPointerDown={(e) => {
                  if (hasSubmitted) return;
                  isDraggingHue.current = true;
                  updateHueFromClientX(e.clientX);
                }}
                className={`relative w-full h-8 rounded-xl border-2 border-[#4A463D] shadow-inner cursor-pointer select-none ${
                  hasSubmitted ? 'opacity-50 pointer-events-none' : ''
                }`}
                style={{
                  background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                }}
              >
                {/* Thumb Indicator */}
                <div
                  className="absolute top-0 bottom-0 w-4 -ml-2 rounded-lg bg-[#F7F4EC] border-2 border-black shadow-md pointer-events-none"
                  style={{ left: `${(hue / 360) * 100}%` }}
                />
              </div>
            </div>

            {/* 2. Shade / Brightness Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs font-bold text-[#24221E]">
                <span>شريط الدرجة (Shade)</span>
                <span className="font-mono text-[11px] text-[#4A463D]">{Math.round(shade * 100)}٪</span>
              </div>

              {/* LTR Slider Track */}
              <div
                dir="ltr"
                ref={shadeTrackRef}
                onPointerDown={(e) => {
                  if (hasSubmitted) return;
                  isDraggingShade.current = true;
                  updateShadeFromClientX(e.clientX);
                }}
                className={`relative w-full h-8 rounded-xl border-2 border-[#4A463D] shadow-inner cursor-pointer select-none ${
                  hasSubmitted ? 'opacity-50 pointer-events-none' : ''
                }`}
                style={{
                  background: `linear-gradient(to right, #000000 0%, ${hsvToHex(hue / 360, 1, 1)} 100%)`,
                }}
              >
                {/* Thumb Indicator */}
                <div
                  className="absolute top-0 bottom-0 w-4 -ml-2 rounded-lg bg-[#F7F4EC] border-2 border-black shadow-md pointer-events-none"
                  style={{ left: `${shade * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Action Button: "خلصت" */}
          <div className="w-full mt-1">
            {hasSubmitted ? (
              <div className="w-full py-3.5 bg-[#8A9A5B]/20 border-3 border-[#8A9A5B] rounded-2xl text-center font-bold text-[#8A9A5B] flex items-center justify-center gap-2">
                <Check className="w-5 h-5" />
                <span>تم قفل اختيارك! بانتظار باقي المتسابقين...</span>
              </div>
            ) : (
              <button
                onClick={handleSubmitGuess}
                className="w-full py-3.5 bg-[#8A9A5B] hover:bg-[#2C2A29] text-white hover:text-[#E5E0D5] text-xl font-black font-display rounded-xl border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] active:translate-y-0.5 active:shadow-[1px_1px_0px_#2C2A29] transition-all cursor-pointer"
              >
                خلصت
              </button>
            )}
          </div>
        </main>

        <footer className="text-center text-[11px] text-[#4A463D] font-semibold border-t border-[#4A463D]/20 pt-2">
          خمن لون الجزء المخفي واضغط "خلصت"
        </footer>
      </div>
    );
  }

  // --- 3. REVEALING PHASE (Wait for TV) ---
  if (flagState.gameState === 'REVEALING') {
    return (
      <div className="w-full max-w-lg mx-auto h-[100dvh] overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] text-[#2C2A29] flex flex-col justify-between p-3.5 select-none selection:bg-[#8A9A5B] selection:text-white" dir="rtl">
        <MobileTopBar roomCode={room?.code || roomId} onExit={handleExit} points={player?.score || 0} title="كشف النتائج" />

        <main className="flex-1 flex flex-col items-center justify-center my-4 text-center max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-[#C68B59] border-3 border-[#4A463D] shadow-[0_4px_0_#4A463D] flex items-center justify-center text-white mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black font-display text-[#24221E] mb-2">انتهى وقت الجولة!</h2>
          <p className="text-sm font-bold text-[#4A463D] max-w-xs leading-relaxed">
            انظر إلى شاشة التلفزيون لمتابعة كشف الألوان ونسب الدقة...
          </p>

          {player.currentAccuracy !== null && (
            <div className="mt-6 px-6 py-3 bg-[#F7F4EC] border-3 border-[#4A463D] rounded-2xl shadow-[0_4px_0_#4A463D]">
              <span className="text-xs font-bold text-[#4A463D] block">دقتك في هذه الجولة:</span>
              <span className="text-3xl font-black font-mono text-[#8A9A5B]">٪{player.currentAccuracy}</span>
            </div>
          )}
        </main>

        <footer className="text-center text-xs text-[#4A463D] font-semibold border-t border-[#4A463D]/20 pt-2">
          تابع الشاشة الكبيرة
        </footer>
      </div>
    );
  }

  // --- 4. ROUND_INTERMISSION PHASE ("أنا جاهز للجولة القادمة") ---
  if (flagState.gameState === 'ROUND_INTERMISSION') {
    const playersList = Object.values(flagState.players);
    const activePid = savedPlayerId || player?.id || '';
    // Isolated check strictly for current player!
    const isCurrentPlayerReady = isReadyLocally || Boolean(flagState.roundReadyPlayers?.[activePid]);
    const readyCount = Object.keys(flagState.roundReadyPlayers || {}).filter(
      (k) => flagState.roundReadyPlayers[k]
    ).length;

    return (
      <div className="w-full max-w-lg mx-auto h-[100dvh] overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] text-[#2C2A29] flex flex-col justify-between p-3.5 select-none selection:bg-[#8A9A5B] selection:text-white" dir="rtl">
        <MobileTopBar roomCode={room?.code || roomId} onExit={handleExit} points={player?.score || 0} title={`نهاية الجولة ${flagState.currentRound}`} />

        <main className="flex-1 flex flex-col items-center justify-center my-4 gap-6 max-w-sm mx-auto w-full">
          {/* Round Score Card */}
          <div className="w-full bg-[#F7F4EC] border-4 border-[#4A463D] rounded-3xl p-5 text-center shadow-[0_6px_0_#38342C] flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-[#8A9A5B] border-2 border-[#4A463D] flex items-center justify-center text-white shadow-sm mb-1">
              <Award className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-black font-display text-[#24221E]">
              نتيجة الجولة {flagState.currentRound}
            </h3>

            <div className="flex items-center gap-4 mt-2">
              <div className="px-4 py-2 rounded-xl bg-[#EDE7D9] border-2 border-[#4A463D]">
                <span className="text-[10px] font-bold text-[#4A463D] block">الدقة</span>
                <span className="text-2xl font-black font-mono text-[#8A9A5B]">
                  ٪{player.currentAccuracy ?? 0}
                </span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-[#EDE7D9] border-2 border-[#4A463D]">
                <span className="text-[10px] font-bold text-[#4A463D] block">مجموع نقاطك</span>
                <span className="text-2xl font-black font-mono text-[#24221E]">
                  {(player?.score || 0)} pt
                </span>
              </div>
            </div>
          </div>

          {/* Isolated Action Button checking ONLY current player */}
          <div className="w-full">
            <button
              disabled={isCurrentPlayerReady}
              onClick={handleNextRoundReady}
              className={`w-full py-4 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-1 ${
                isCurrentPlayerReady
                  ? 'bg-stone-400 text-stone-800 border-[#2C2A29] shadow-[0_2px_0_#2C2A29] cursor-default'
                  : 'bg-[#8A9A5B] hover:bg-[#2C2A29] text-white hover:text-[#E5E0D5] border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] hover:-translate-y-1 active:translate-y-0.5 active:shadow-[1px_1px_0px_#2C2A29] cursor-pointer'
              }`}
            >
              {isCurrentPlayerReady ? (
                <>
                  <CheckCircle2 className="w-10 h-10" />
                  <span className="text-2xl font-black font-display">بانتظار بقية اللاعبين...</span>
                  <span className="text-xs opacity-90">({readyCount} من {playersList.length} جاهزون)</span>
                </>
              ) : (
                <>
                  <Sliders className="w-10 h-10" />
                  <span className="text-2xl font-black font-display">أنا جاهز للجولة القادمة</span>
                  <span className="text-xs opacity-90">اضغط للانتقال للجولة {flagState.currentRound + 1}</span>
                </>
              )}
            </button>
          </div>
        </main>

        <footer className="text-center text-xs text-[#4A463D] font-semibold border-t border-[#4A463D]/20 pt-2">
          تبدأ الجولة التالية فور جاهزية جميع المتسابقين
        </footer>
      </div>
    );
  }

  // --- 5. GAME OVER PHASE ---
  if (flagState.gameState === 'GAME_OVER') {
    const playersList = Object.values(flagState.players).sort((a, b) => b.score - a.score);
    const myRank = playersList.findIndex((p) => p.id === player.id) + 1;

    return (
      <div className="w-full max-w-lg mx-auto h-[100dvh] overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] text-[#2C2A29] flex flex-col justify-between p-3.5 select-none selection:bg-[#8A9A5B] selection:text-white" dir="rtl">
        <MobileTopBar roomCode={room?.code || roomId} onExit={handleExit} points={player?.score || 0} title="النتائج النهائية" />

        <main className="flex-1 flex flex-col items-center justify-center my-4 gap-6 max-w-sm mx-auto w-full">
          <div className="w-full bg-[#F7F4EC] border-4 border-[#4A463D] rounded-3xl p-6 text-center shadow-[0_8px_0_#38342C] flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-[#8A9A5B] border-2 border-[#4A463D] flex items-center justify-center text-white shadow-sm">
              <Trophy className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-bold text-[#4A463D]">ترتيبك النهائي</span>
              <h3 className="text-3xl font-black font-display text-[#24221E] mt-0.5">
                المركز {myRank === 1 ? 'الأول' : myRank === 2 ? 'الثاني' : myRank === 3 ? 'الثالث' : `${myRank}`}
              </h3>
            </div>

            <div className="px-5 py-2 rounded-xl bg-[#EDE7D9] border-2 border-[#4A463D] font-black text-xl text-[#24221E]">
              {(player?.score || 0)} pt
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              roomBus.resetFlagToLobby(roomId);
            }}
            className="w-full py-4 bg-[#8A9A5B] text-white text-xl font-black font-display rounded-2xl border-4 border-[#4A463D] shadow-[0_6px_0_#38342C] flex items-center justify-center gap-2 hover:bg-[#7D8D50] active:translate-y-1"
          >
            <RotateCcw className="w-5 h-5" />
            <span>العودة للوبي</span>
          </button>
        </main>

        <footer className="text-center text-xs text-[#4A463D] font-semibold border-t border-[#4A463D]/20 pt-2">
          شكراً لمشاركتك في لعبة طق عصي
        </footer>
      </div>
    );
  }

  return null;
};
