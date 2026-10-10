import { FullscreenButton } from '../components/common/FullscreenButton';
import { CopyCodeButton } from '../components/common/CopyCodeButton';
import { LobbyRuleBox } from '../components/common/LobbyRuleBox';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  Zap,
  Maximize,
  Minimize,
  Copy,
  Check,
  Tv,
  Trophy,
  Sparkles,
  RotateCcw,
  Play,
  LogOut,
  X,
  Clock,
} from 'lucide-react';
import { useRoom, roomBus, cleanRoomCode } from '../lib/roomBus';
import { ALL_GAME_MODES } from '../lib/gamesCatalog';
import { HexBoard } from '../components/game/HexBoard';
import { QRCodeView } from '../components/common/QRCodeView';
import { DemoSwitcher } from '../components/common/DemoSwitcher';
import { sound } from '../lib/audio';
import { FlagTVView } from './flags/FlagTVView';
import { GeoLandmarkTVView } from './landmarks/GeoLandmarkTVView';
import { TrajectoryTVView } from './trajectory/TrajectoryTVView';
import { BlindTourismTVView } from './tourism/BlindTourismTVView';
import { ScattergoriesTVView } from './words/scattergories/ScattergoriesTVView';
import { WordleRushTVView } from './words/wordle-rush/WordleRushTVView';
import { PentagonClashTVView } from './words/pentagon-clash/PentagonClashTVView';
import { ThreeLetterWordTVView } from './words/three-letter-word/ThreeLetterWordTVView';
import { WhoIsAiTVView } from './ai/who-is-ai/WhoIsAiTVView';
import { AiLawyerTVView } from './ai/ai-lawyer/AiLawyerTVView';
import { TheScammerTVView } from './ai/the-scammer/TheScammerTVView';
import { ConspiracyTVView } from './ai/conspiracy-maker/ConspiracyTVView';
import { WalaKalimaTVView } from './eshrah/WalaKalima/WalaKalimaTVView';
import { ForbiddenWordsTVView } from './eshrah/ForbiddenWords/ForbiddenWordsTVView';
import { OneWordTVView } from './eshrah/OneWord/OneWordTVView';
import { MoveThePuppetTVView } from './eshrah/MoveThePuppet/MoveThePuppetTVView';
import { useSafeCountdown } from '../hooks/useSafeCountdown';

export const TVScreenView: React.FC = () => {
  const params = useParams();
  const roomCode = (params.code || params.roomId || params.id || '').trim().toUpperCase() || 'TAQ1';
  const roomId = roomCode;

  const [loadingFailsafe, setLoadingFailsafe] = useState(false);

  useEffect(() => {
    console.log(`[DEBUG Mount] Room: "${roomCode}" | Host TV | Path: "${window.location.pathname}"`);
    if (roomCode && !roomBus.getRoom(roomCode)) {
      roomBus.createRoom(roomCode);
    }
  }, [roomCode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingFailsafe(true);
      if (roomCode && !roomBus.getRoom(roomCode)) {
        roomBus.createRoom(roomCode);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [roomCode]);

  const { room } = useRoom(roomId);
  const activeRoom = room || roomBus.getRoom(roomId) || roomBus.createRoom(roomId);

  if (!room && !loadingFailsafe) {
    return (
      <div className="w-full h-[100dvh] flex items-center justify-center bg-[#E5E0D5] text-[#2C2A29] font-bold select-none">
        جاري تحميل شاشة العرض...
      </div>
    );
  }

  const path = window.location.pathname;

  if (activeRoom.selectedGameId === 'geo-flag-color' || path.includes('flags-tv')) {
    return <FlagTVView />;
  }
  if (activeRoom.selectedGameId === 'geo-pin-landmark' || path.includes('geo-tv')) {
    return <GeoLandmarkTVView />;
  }
  if (activeRoom.selectedGameId === 'geo-trajectory' || path.includes('trajectory-tv')) {
    return <TrajectoryTVView />;
  }
  if (activeRoom.selectedGameId === 'geo-blind-tourism' || path.includes('tourism-tv')) {
    return <BlindTourismTVView />;
  }
  if (activeRoom.selectedGameId === 'scattergories' || path.includes('scattergories')) {
    return <ScattergoriesTVView />;
  }
  if (activeRoom.selectedGameId === 'wordle-rush' || path.includes('wordle-rush')) {
    return <WordleRushTVView />;
  }
  if (activeRoom.selectedGameId === 'pentagon-clash' || path.includes('pentagon-clash')) {
    return <PentagonClashTVView />;
  }
  if (
    activeRoom.selectedGameId === 'three-letter-word' ||
    activeRoom.selectedGameId === 'kalim-stack' ||
    path.includes('three-letter-word') ||
    path.includes('kalim-stack')
  ) {
    return <ThreeLetterWordTVView />;
  }
  if (
    activeRoom.selectedGameId === 'conspiracy-maker' ||
    path.includes('conspiracy-maker')
  ) {
    return <ConspiracyTVView />;
  }
  if (
    activeRoom.selectedGameId === 'the-scammer' ||
    path.includes('the-scammer')
  ) {
    return <TheScammerTVView />;
  }
  if (
    activeRoom.selectedGameId === 'ai-lawyer' ||
    path.includes('ai-lawyer')
  ) {
    return <AiLawyerTVView />;
  }
  if (
    activeRoom.selectedGameId === 'who-is-ai' ||
    activeRoom.selectedGameId === 'ai-room' ||
    path.includes('who-is-ai') ||
    path.includes('ai-room')
  ) {
    return <WhoIsAiTVView />;
  }
  if (
    activeRoom.selectedGameId === 'wala-kalima' ||
    path.includes('wala-kalima')
  ) {
    return <WalaKalimaTVView />;
  }
  if (
    activeRoom.selectedGameId === 'forbidden-words' ||
    path.includes('forbidden-words')
  ) {
    return <ForbiddenWordsTVView />;
  }
  if (
    activeRoom.selectedGameId === 'one-word' ||
    path.includes('one-word')
  ) {
    return <OneWordTVView />;
  }
  if (
    activeRoom.selectedGameId === 'move-the-puppet' ||
    path.includes('move-the-puppet')
  ) {
    return <MoveThePuppetTVView />;
  }

  return <ClassicTVScreenView roomId={roomId} />;
};

const ClassicTVScreenView: React.FC<{ roomId: string }> = ({ roomId }) => {
  const { room, activeBuzzer } = useRoom(roomId);
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (!roomBus.getRoom(roomId)) {
      roomBus.createRoom(roomId);
    }
  }, [roomId]);

  const buzzerLock = room?.buzzerLock;
  const secondsLeft = useSafeCountdown(buzzerLock?.endsAt);
  const idleSecondsLeft = useSafeCountdown(buzzerLock?.idleEndsAt);
  const displaySeconds = buzzerLock?.endsAt ? secondsLeft : (buzzerLock?.countdownRemaining ?? 0);
  const displayIdleSeconds = buzzerLock?.idleEndsAt ? idleSecondsLeft : (buzzerLock?.idleCountdownRemaining ?? 10);

  const toggleFullscreen = () => {
    sound.playClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      sound.playClick();
    });
  };

  const handleStartGame = () => {
    roomBus.startGame(roomId);
  };

  const handleResetGrid = () => {
    roomBus.resetBoard(roomId);
  };

  const handleEndGame = () => {
    if (window.confirm('هل أنت متأكد من إنهاء اللعبة لجميع الأجهزة والعودة للرئيسية؟')) {
      roomBus.endGame(roomId);
    }
  };

  const handleKickPlayer = async (targetPlayerId: string, playerName: string) => {
    const confirmKick = window.confirm(`هل أنت متأكد من طرد اللاعب "${playerName}"؟`);
    if (!confirmKick) return;

    roomBus.kickPlayer(roomId, targetPlayerId);

    const clean = cleanRoomCode(roomId);
    const channel = roomBus.getSupabaseChannel(roomId);
    if (channel && channel.send) {
      try {
        await channel.send({
          type: 'broadcast',
          event: 'PLAYER_KICKED',
          payload: { playerId: targetPlayerId }
        });
      } catch (e) {
        console.warn('kick broadcast error:', e);
      }
    }
  };

  const selectedGame =
    ALL_GAME_MODES.find((g) => g.id === room?.selectedGameId) || ALL_GAME_MODES[0];

  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/room/${roomId}/join`
      : `/room/${roomId}/join`;

  const isLobby = room?.status === 'lobby';
  const isBuzzed = buzzerLock?.status === 'buzzed';
  const buzzedTeam = buzzerLock?.buzzedTeam;

  const teamAPlayers = room?.players.filter((p) => p.team === 'team_a') || [];
  const teamBPlayers = room?.players.filter((p) => p.team === 'team_b') || [];
  const canStartGame = teamAPlayers.length >= 1 && teamBPlayers.length >= 1;

  return (
    <div
      className={`min-h-screen bg-grain text-ink-950 flex flex-col justify-between select-none ${
        isFullscreen ? 'p-4 md:p-6' : 'p-3 md:p-6'
      }`}
    >
      {/* Top TV Bar */}
      <header className="flex items-center justify-between border-b-2 border-ink-950 pb-3 gap-3 flex-wrap">
        {/* Brand & Selected Game Display */}
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-tactile bg-olive-500 border-2 border-ink-950 shadow-tactile-sm flex items-center justify-center text-sand-50 font-bold">
              <Tv className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black font-display text-ink-950 leading-tight">
                طق عصي
              </span>
              <span className="text-[10px] font-bold text-olive-800">
                {isLobby ? 'ردهة الانتظار وتوزيع الفرق' : 'شاشة التلفزيون المركزية'}
              </span>
            </div>
          </a>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-sand-200 border-2 border-ink-950 rounded-tactile shadow-tactile-sm text-xs">
            <span className="text-ink-600 font-bold">الطور:</span>
            <span className="font-black text-ink-950 font-display">{selectedGame.title}</span>
          </div>
        </div>

        {/* Room Code & Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={copyRoomCode}
            title="نسخ رمز الغرفة"
            className="flex items-center gap-1.5 px-3 py-1 bg-sand-200 hover:bg-sand-300 border-2 border-ink-950 rounded-tactile shadow-tactile-sm transition-all text-xs"
          >
            <span className="text-ink-600 font-bold">الغرفة:</span>
            <span className="font-mono font-black text-sm text-ochre-700">{roomId}</span>
            {copiedCode ? <Check className="w-3.5 h-3.5 text-olive-700" /> : <Copy className="w-3 h-3 text-ink-600" />}
          </button>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-tactile border-2 border-ink-950 text-xs font-bold ${
              room?.hostConnected
                ? 'bg-olive-100 text-olive-900 border-olive-900 shadow-tactile-sm'
                : 'bg-sand-100 text-ink-500'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{room?.hostConnected ? 'المقدم متصل' : 'بانتظار المقدم'}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="btn-tactile-ghost py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'خروج' : 'شاشة كاملة'}</span>
          </button>

          {/* Permanent End Game Button in Dark Ochre */}
          <button
            onClick={handleEndGame}
            title="إنهاء اللعبة وإعادة جميع الأجهزة للرئيسية"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2C2A29] hover:bg-[#3D3A38] text-white border-2 border-[#2C2A29] rounded-tactile shadow-[0_3px_0_#1a1918] text-xs font-black transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>إنهاء اللعبة</span>
          </button>
        </div>
      </header>

      {/* Toast Notification Banner (e.g. Idle 10s Timeout auto-reroll) */}
      {room?.toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-2.5 rounded-full bg-ochre-800 text-sand-50 border-2 border-ink-950 shadow-tactile-lg flex items-center gap-2.5 text-sm md:text-base font-black font-display">
          <Clock className="w-5 h-5 text-sand-50" />
          <span>{room.toastMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. LOBBY VIEW (ردهة الانتظار وتقسيم الفرق)                */}
      {/* ======================================================== */}
      {isLobby ? (
        <main className="my-auto py-6 max-w-6xl mx-auto w-full flex flex-col gap-6">
          {/* Center Banner: QR Code & Giant Code */}
          <div className="card-tactile p-6 bg-sand-50 flex flex-col sm:flex-row items-center justify-around gap-6">
            <div className="flex flex-col items-center sm:items-start text-center sm:text-right gap-2">
              <span className="text-xs font-bold text-olive-800 bg-olive-100 px-3 py-1 rounded-full border border-olive-800/20">
                امسح الكود بكاميرا جوالك للانضمام
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-ink-950 font-display">
                رمز الغرفة:{' '}
                <span className="font-mono text-ochre-700 tracking-widest">{roomId}</span>
              </h2>
              <p className="text-xs text-ink-600 font-semibold">
                الرابط المباشر:{' '}
                <span className="font-mono text-olive-800">{joinUrl.replace(/^https?:\/\//, '')}</span>
              </p>
            </div>

            <QRCodeView value={joinUrl} size={170} />
          </div>

          {/* Two Distinct Panels for Team 1 & Team 2 */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Team 1 (الفريق الأول - الأخضر الزيتوني) */}
            <div className="card-tactile p-6 bg-olive-50 border-3 border-olive-800 flex flex-col justify-between min-h-[220px]">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b-2 border-olive-800/30 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-none bg-olive-600 border border-ink-950/40 inline-block shadow-sm"></span>
                    <h3 className="text-xl font-black text-olive-950 font-display">
                      الفريق الأول
                    </h3>
                  </div>

                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-olive-200 text-olive-950 border border-olive-800">
                    {teamAPlayers.length} لاعبين
                  </span>
                </div>

                {/* Team 1 Players List: Plain Elegant Text Badges (No Avatars/Emojis) */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {teamAPlayers.length === 0 ? (
                    <span className="text-xs text-olive-700/80 font-bold py-6 text-center w-full">
                      بانتظار انضمام متسابقي الفريق الأول...
                    </span>
                  ) : (
                    teamAPlayers.map((p) => (
                      <span
                        key={p.id}
                        className="px-3.5 py-1.5 rounded-xl bg-sand-50 border-2 border-olive-900 shadow-tactile-sm text-xs font-black text-ink-950 flex items-center gap-2"
                      >
                        <span>{p.name}</span>
                        <button
                          type="button"
                          onClick={() => handleKickPlayer(p.id, p.name)}
                          className="p-0.5 rounded bg-red-100 text-red-700 hover:bg-red-600 hover:text-white transition-all border border-olive-900 shadow-sm cursor-pointer"
                          title={`طرد ${p.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Team 2 (الفريق الثاني - الأصفر الخردلي) */}
            <div className="card-tactile p-6 bg-ochre-50 border-3 border-ochre-800 flex flex-col justify-between min-h-[220px]">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b-2 border-ochre-800/30 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-none bg-ochre-500 border border-ink-950/40 inline-block shadow-sm"></span>
                    <h3 className="text-xl font-black text-ochre-950 font-display">
                      الفريق الثاني
                    </h3>
                  </div>

                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-ochre-200 text-ochre-950 border border-ochre-800">
                    {teamBPlayers.length} لاعبين
                  </span>
                </div>

                {/* Team 2 Players List: Plain Elegant Text Badges (No Avatars/Emojis) */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {teamBPlayers.length === 0 ? (
                    <span className="text-xs text-ochre-700/80 font-bold py-6 text-center w-full">
                      بانتظار انضمام متسابقي الفريق الثاني...
                    </span>
                  ) : (
                    teamBPlayers.map((p) => (
                      <span
                        key={p.id}
                        className="px-3.5 py-1.5 rounded-xl bg-sand-50 border-2 border-ochre-900 shadow-tactile-sm text-xs font-black text-ink-950 flex items-center gap-2"
                      >
                        <span>{p.name}</span>
                        <button
                          type="button"
                          onClick={() => handleKickPlayer(p.id, p.name)}
                          className="p-0.5 rounded bg-red-100 text-red-700 hover:bg-red-600 hover:text-white transition-all border border-ochre-900 shadow-sm cursor-pointer"
                          title={`طرد ${p.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Lobby Waiting Footer & Start Condition */}
          <div className="card-tactile p-4 bg-sand-50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-col text-center sm:text-right">
              <span className="text-xs font-bold text-ink-600">
                تسجيل الدخول: اكتب اسمك وانضم للتحدي فوراً من جوالك
              </span>
              {!canStartGame && (
                <span className="text-xs font-black text-ochre-700 mt-0.5">
                  ⚠️ بانتظار انضمام لاعب في كل فريق لبدء المنافسة (لاعب على الأقل في الفريق الأول ولاعب في الفريق الثاني)
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleStartGame}
                disabled={!canStartGame}
                className={`py-2 px-5 text-xs font-black flex items-center gap-1.5 rounded-tactile border-2 border-ink-950 shadow-tactile-sm transition-all ${
                  canStartGame
                    ? 'bg-olive-500 hover:bg-olive-600 text-sand-50 cursor-pointer active:scale-95'
                    : 'bg-sand-200 text-ink-400 cursor-not-allowed opacity-60'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>ابدأ اللعبة</span>
              </button>
            </div>
          </div>
        </main>
      ) : (
        /* ======================================================== */
        /* 2. PLAYING VIEW (لوح العرض والشبكة السداسية 5x5)          */
        /* ======================================================== */
        <main className="my-auto py-2 grid lg:grid-cols-12 gap-6 items-center max-w-7xl mx-auto w-full">
          {/* Left Column: Scoreboard + Active Buzzer Card */}
          <section className="lg:col-span-4 flex flex-col gap-4">
            {/* Scoreboard: Team 1 vs Team 2 */}
            <div className="card-tactile p-4 bg-sand-50 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-sand-300 pb-2">
                <span className="text-xs font-bold text-ink-600">
                  لوحة النتائج (الجولة {room?.roundNumber || 1})
                </span>
                <span className="text-[11px] font-bold text-olive-800 bg-olive-100 px-2 py-0.5 rounded">
                  توصيل الأطراف
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                {/* Team 1 (Olivine) */}
                <div className="p-3 rounded-tactile bg-olive-50 border-2 border-olive-800 shadow-tactile-sm flex flex-col items-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-4 h-4 rounded-none bg-olive-600 border border-ink-950/30 inline-block shadow-sm"></span>
                    <span className="text-xs font-black text-olive-900">الفريق الأول</span>
                  </div>
                  <div className="text-3xl font-black text-olive-900 font-display my-1">
                    {room?.scores.team_a.cellsWon || 0}
                  </div>
                  <span className="text-[10px] font-bold text-olive-700 bg-olive-200/60 px-2 py-0.5 rounded-full">
                    جولات: {room?.scores.team_a.roundsWon || 0}
                  </span>
                </div>

                {/* Team 2 (Ochre) */}
                <div className="p-3 rounded-tactile bg-ochre-50 border-2 border-ochre-800 shadow-tactile-sm flex flex-col items-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-4 h-4 rounded-none bg-ochre-500 border border-ink-950/30 inline-block shadow-sm"></span>
                    <span className="text-xs font-black text-ochre-900">الفريق الثاني</span>
                  </div>
                  <div className="text-3xl font-black text-ochre-900 font-display my-1">
                    {room?.scores.team_b.cellsWon || 0}
                  </div>
                  <span className="text-[10px] font-bold text-ochre-700 bg-ochre-200/60 px-2 py-0.5 rounded-full">
                    جولات: {room?.scores.team_b.roundsWon || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Active Buzzer Card (Slides in when buzzer is hit) */}
            {isBuzzed ? (
              <div
                className={`card-tactile p-5 transition-colors duration-150 flex flex-col items-center text-center gap-2.5 shadow-tactile-lg ${
                  buzzedTeam === 'team_a'
                    ? 'bg-olive-100 border-3 border-olive-800'
                    : 'bg-ochre-100 border-3 border-ochre-800'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ink-950">
                  <Zap className="w-4 h-4 fill-current text-ochre-600" />
                  <span>
                    كبس الجرس! (المحاولة {buzzerLock?.attemptNumber || 1} من 2 {buzzerLock?.attemptNumber === 2 ? '• ارتداد' : ''})
                  </span>
                </div>

                <div className="text-2xl font-black font-display text-ink-950">
                  {buzzerLock?.buzzedPlayerName || (buzzerLock?.buzzedTeam === 'team_a' ? 'الفريق الأول' : 'الفريق الثاني')}
                </div>

                {/* Massive Real-Time Countdown or Timeout Freeze Message */}
                {buzzerLock?.isFrozen ? (
                  <div className="flex flex-col items-center gap-1 my-1">
                    <div className="w-20 h-20 rounded-full border-4 border-ink-950 bg-ochre-200 flex items-center justify-center shadow-tactile-md">
                      <span className="text-4xl font-black font-mono text-ochre-950">0</span>
                    </div>
                    <span className="text-xs font-black text-ochre-900 bg-ochre-100 px-3 py-1 rounded-full border border-ochre-800/40 animate-pulse">
                      انتهى الوقت! بانتظار تقييم المقدم..
                    </span>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full border-4 border-ink-950 bg-sand-50 flex items-center justify-center my-1 shadow-tactile-md">
                    <span className="text-5xl font-black font-mono text-ochre-700 animate-pulse">
                      {displaySeconds}
                    </span>
                  </div>
                )}

                <span className="text-[11px] font-bold text-ink-800">
                  {buzzerLock?.isFrozen
                    ? 'يتجمد النظام حتى يضغط المقدم ✅ صح أو ❌ خطأ'
                    : 'ثوانٍ للإجابة بصوت واضح للمقدم في المجلس!'}
                </span>
              </div>
            ) : buzzerLock?.status === 'unlocked' ? (
              buzzerLock?.attemptPhase === 'REBOUND_TEAM_B' ? (
                <div className="card-tactile p-5 bg-ochre-100 border-3 border-ochre-800 flex flex-col items-center text-center gap-2.5 shadow-tactile-lg">
                  <div className="flex items-center gap-2 text-xs font-black text-ochre-950">
                    <Zap className="w-4 h-4 fill-current text-ochre-700" />
                    <span>ارتداد السؤال لـ {buzzerLock?.buzzedTeam === 'team_a' ? 'الفريق الأول' : 'الفريق الثاني'}!</span>
                  </div>
                  <div className="w-20 h-20 rounded-full border-4 border-ink-950 bg-sand-50 flex items-center justify-center my-1 shadow-tactile-md">
                    <span className="text-5xl font-black font-mono text-ochre-800 animate-pulse">
                      {displaySeconds}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-ink-800">
                    أي متسابق من الفريق المنافس يكبس الزر في جواله بـ 5 ثوانٍ!
                  </span>
                </div>
              ) : (
                <div className="card-tactile p-5 bg-sand-50 flex flex-col items-center text-center gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-olive-500 animate-ping"></span>
                    <span className="text-base font-black text-olive-800 font-display">
                      الجرس مفتوح الآن!
                    </span>
                  </div>

                  {room?.activeQuestion?.letter && (
                    <div className="flex items-center gap-1.5 py-1 px-3 bg-sand-200 border-2 border-ink-950 rounded-tactile shadow-tactile-sm">
                      <span className="text-xs font-bold text-ink-600">الخلية المحددة:</span>
                      <span className="text-xl font-black font-display text-olive-900">
                        {room.activeQuestion.letter}
                      </span>
                    </div>
                  )}

                  <span className="text-xs text-ink-600">
                    أسرع متسابق يكبس الزر في جواله يحصل على 3 ثوانٍ للإجابة
                  </span>

                  {/* 10-Second Idle Countdown Indicator */}
                  <div className="w-full pt-1 border-t border-sand-300/80 flex flex-col items-center gap-1.5">
                    <div className="flex items-center justify-between w-full text-xs font-bold text-ink-600">
                      <span>مهلة السؤال:</span>
                      <span className="font-mono text-sm font-black text-ochre-800">
                        {displayIdleSeconds} ثوانٍ
                      </span>
                    </div>
                    <div className="w-full bg-sand-200 h-2 rounded-full overflow-hidden border border-ink-950/20">
                      <div
                        className="bg-ochre-600 h-full transition-all duration-1000 ease-linear rounded-full"
                        style={{
                          width: `${Math.max(0, Math.min(100, (displayIdleSeconds / 10) * 100))}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-ink-500 font-medium">
                      يتم استبدال السؤال تلقائياً بعد انتهاء الـ 10 ثوانٍ
                    </span>
                  </div>
                </div>
              )
            ) : room?.cellPickerPlayerId ? (
              <div className="card-tactile p-4 bg-olive-50 border-2 border-olive-800 text-center flex flex-col items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-olive-700" />
                <span className="text-xs font-bold text-olive-800">إجابة صحيحة!</span>
                <span className="text-sm font-black text-ink-950 font-display">
                  {room.cellPickerPlayerName} يختار الخلية القادمة من جواله..
                </span>
              </div>
            ) : room?.activeCellId ? (
              <div className="card-tactile p-4 bg-sand-50 flex flex-col items-center text-center gap-1.5">
                <span className="text-xs font-bold text-ink-600">الخلية قيد التنافس:</span>
                <span className="text-2xl font-black text-ink-950 font-display">
                  {room?.activeQuestion?.letter}
                </span>
                <span className="text-xs font-semibold text-ochre-800">
                  المقدم يقرأ السؤال في جواله...
                </span>
              </div>
            ) : (
              <div className="card-tactile p-4 bg-sand-50 text-center text-xs text-ink-600 font-medium">
                بانتظار تحديد الخلية لبدء التنافس حولها
              </div>
            )}

            {/* Quick Controls */}
            <div className="card-tactile p-3 bg-sand-50 flex items-center justify-between text-xs">
              <button
                onClick={handleResetGrid}
                className="btn-tactile-ghost py-1.5 px-3 text-xs flex items-center gap-1 font-bold"
              >
                <RotateCcw className="w-3.5 h-3.5 text-ink-700" />
                <span>جولة جديدة</span>
              </button>

              <button
                onClick={() => {
                  roomBus.createRoom(roomId, room?.selectedGameId);
                }}
                className="text-[11px] font-bold text-ink-600 hover:underline"
              >
                العودة للردهة
              </button>
            </div>
          </section>

          {/* Center: 5x5 Hexagonal Board with Flanking Border Hexagons (Display Only, Non-Interactive) */}
          <section className="lg:col-span-8 flex flex-col items-center justify-center">
            <HexBoard
              cells={room?.hexGrid || []}
              activeCellId={room?.activeCellId || null}
              onSelectCell={() => {}}
              interactive={false}
              showHelperBanner={false}
              gameTitle={selectedGame.title}
              winningPath={room?.winningPath || []}
              className="w-full"
            />
          </section>
        </main>
      )}

      {/* ======================================================== */}
      {/* VICTORY CELEBRATION (لوح اللعب يظل ظاهراً مع نبض ذهبي)    */}
      {/* ======================================================== */}
      {room?.winnerTeam && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 max-w-xl w-full px-4">
          <div className="card-tactile p-4 bg-sand-50 border-3 border-ochre-700 shadow-tactile-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-tactile bg-ochre-100 border-2 border-ink-950 flex items-center justify-center text-ochre-700 shadow-tactile-sm">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-olive-800 bg-olive-100 px-2.5 py-0.5 rounded-full border border-olive-800/30">
                  فوز وتوصيل متصل!
                </span>
                <h3 className="text-xl font-black text-ink-950 font-display mt-0.5">
                  مبروك! فاز {room.winnerTeam === 'team_a' ? 'الفريق الأول' : 'الفريق الثاني'}!
                </h3>
              </div>
            </div>

            <button
              onClick={handleResetGrid}
              className="btn-tactile-primary py-2 px-3 text-xs font-bold flex items-center gap-1 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>جولة جديدة</span>
            </button>
          </div>
        </div>
      )}

      {/* Demo Switcher */}
      <DemoSwitcher roomId={roomId} currentRole="tv" />
    </div>
  );
};

