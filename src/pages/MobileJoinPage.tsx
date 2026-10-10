import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { roomBus, useRoom } from '../lib/roomBus';
import { sound } from '../lib/audio';
import { AVATAR_PRESETS } from '../lib/gamesCatalog';
import { Player } from '../types/game';
import { Users, CheckCircle2 } from 'lucide-react';
import { getOrCreatePlayerId, getOrCreatePlayerName } from '../utils/playerSession';

type JoinStep = 'CODE_INPUT' | 'NAME_INPUT' | 'WAITING_LOBBY';

export const MobileJoinPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const params = useParams<{ code?: string; id?: string; roomId?: string }>();
  const navigate = useNavigate();

  // Read code from ?code=XXXX, ?room=XXXX, /room/:code/join, or /room/:id/join
  const urlCode = (params.code || params.id || params.roomId || searchParams.get('code') || searchParams.get('room') || '').trim().toUpperCase();

  const [inputCode, setInputCode] = useState(urlCode);
  const [playerName, setPlayerName] = useState(() => getOrCreatePlayerName(''));
  const [errorMessage, setErrorMessage] = useState('');
  const [step, setStep] = useState<JoinStep>(urlCode ? 'NAME_INPUT' : 'CODE_INPUT');
  const [joinedPlayer, setJoinedPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (urlCode) {
      setInputCode(urlCode);
      setStep('NAME_INPUT');
    }
  }, [urlCode]);

  const targetCode = (urlCode || inputCode).trim().toUpperCase();
  const { room } = useRoom(targetCode);

  // Auto-navigate to play view when in WAITING_LOBBY if game begins
  useEffect(() => {
    if (step === 'WAITING_LOBBY' && room) {
      const isTrajectoryStarted =
        room.trajectoryState &&
        room.trajectoryState.gameState !== 'GAME_LOBBY' &&
        room.trajectoryState.gameState !== 'LOBBY' &&
        room.trajectoryState.currentRound > 0;

      const hasSavedPlayer = Boolean(
        sessionStorage.getItem(`taghesi_player_${targetCode}`) ||
        sessionStorage.getItem('party_player_id')
      );

      const isWordsGameActive =
        Boolean((room as any)?.scattergoriesState && (room as any).scattergoriesState.gameState !== 'LOBBY') ||
        Boolean((room as any)?.wordleRushState && (room as any).wordleRushState.gameState !== 'LOBBY') ||
        Boolean((room as any)?.pentagonClashState && (room as any).pentagonClashState.gameState !== 'LOBBY');

      const isGameActive =
        (room.flagState && room.flagState.gameState !== 'LOBBY') ||
        (room.landmarkState && room.landmarkState.gameState !== 'LOBBY') ||
        isTrajectoryStarted ||
        Boolean(room.tourismState && room.tourismState.gameState !== 'GAME_LOBBY' && room.tourismState.gameState !== 'LOBBY') ||
        isWordsGameActive;

      if (hasSavedPlayer && isGameActive) {
        navigate(`/room/${targetCode}/play`);
      }
    }
  }, [step, room, targetCode, navigate]);

  // Step 1: Submit Room Code with Instant Reconnection
  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const clean = inputCode.trim().toUpperCase();
    if (!clean) {
      setErrorMessage('فضلاً أدخل رمز الغرفة');
      return;
    }
    sound.playClick();
    const existingRoom = roomBus.getRoom(clean);
    if (existingRoom) {
      const savedSession = sessionStorage.getItem(`taghesi_player_${clean}`);
      const pid = getOrCreatePlayerId();

      let matchedPlayer: Player | undefined;
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          if (parsed?.id) {
            matchedPlayer = existingRoom.players.find((p) => p.id === parsed.id);
          }
        } catch {}
      }
      if (!matchedPlayer && pid) {
        matchedPlayer = existingRoom.players.find((p) => p.id === pid);
      }

      if (matchedPlayer) {
        matchedPlayer.isOnline = true;
        sessionStorage.setItem(`taghesi_player_${clean}`, JSON.stringify(matchedPlayer));
        sessionStorage.setItem('party_player_id', matchedPlayer.id);
        sessionStorage.setItem('party_player_name', matchedPlayer.name);
        roomBus.saveRoom(existingRoom);
        roomBus.emit('STATE_UPDATED', clean, existingRoom);
        setJoinedPlayer(matchedPlayer);
        navigate(`/room/${clean}/play`);
        return;
      }
    } else {
      roomBus.createRoom(clean);
    }
    setStep('NAME_INPUT');
  };

  // Direct Join Handler (No Team Selection)
  const handleJoinDirect = (nameToJoin?: string) => {
    setErrorMessage('');
    sound.playClick();

    const cleanCode = targetCode.trim().toUpperCase();
    const cleanName = (nameToJoin || playerName).trim();

    if (!roomBus.getRoom(cleanCode)) {
      roomBus.createRoom(cleanCode);
    }

    const sessionId = getOrCreatePlayerId();
    sessionStorage.setItem('party_player_name', cleanName);
    sessionStorage.setItem('taq_session_player_name', cleanName);
    localStorage.setItem('taghesi_playerName', cleanName);

    const existingR = roomBus.getRoom(cleanCode);
    const existingP = existingR?.players.find((p) => p.id === sessionId);

    const defaultAvatar = existingP?.avatar || AVATAR_PRESETS[0].id;
    const player = existingP || roomBus.joinPlayer(cleanCode, cleanName, defaultAvatar, 'team_a', sessionId);

    if (player) {
      player.isOnline = true;
      sessionStorage.setItem(`taghesi_player_${cleanCode}`, JSON.stringify(player));
      sessionStorage.setItem('party_player_id', player.id);
      sessionStorage.setItem('party_player_name', player.name);

      if (existingR) {
        roomBus.saveRoom(existingR);
        roomBus.emit('STATE_UPDATED', cleanCode, existingR);
      }
      setJoinedPlayer(player);
      navigate(`/room/${cleanCode}/play`);
    } else {
      setErrorMessage('تعذر الانضمام للغرفة، يرجى المحاولة ثانية');
    }
  };

  // Step 2: Submit Nickname -> Directly Join Game Lobby (Bypasses Team Selection)
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanName = playerName.trim();
    if (!cleanName) {
      setErrorMessage('فضلاً اكتب اسمك');
      return;
    }
    sound.playClick();
    handleJoinDirect(cleanName);
  };

  return (
    <div
      className="h-screen h-[100dvh] overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] flex flex-col justify-between p-4 sm:p-6 max-w-md mx-auto select-none"
      dir="rtl"
    >
      {/* Top Header */}
      <header className="flex items-center justify-between border-b-2 border-ink-950 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-tactile bg-olive-500 border-2 border-ink-950 shadow-tactile-sm flex items-center justify-center text-sand-50 font-black text-xs font-display">
            طق
          </span>
          <span className="text-lg font-black text-ink-950 font-display">طق عصي</span>
        </div>

        <div className="flex items-center gap-2">
          {targetCode && (
            <span className="text-xs font-mono font-bold text-ink-600 bg-sand-200 px-2.5 py-1 rounded-full border border-ink-950/20">
              غرفة: {targetCode}
            </span>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="my-auto py-6">
        <div className="card-tactile p-6 bg-sand-50 flex flex-col gap-5">
          {errorMessage && (
            <div className="p-3 bg-ochre-100 border-2 border-ochre-800 text-ochre-900 rounded-tactile text-xs font-bold text-center">
              {errorMessage}
            </div>
          )}

          {/* STEP 1: Room Code Input */}
          {step === 'CODE_INPUT' && (
            <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
              <div className="text-center">
                <span className="text-xs font-bold text-olive-800 bg-olive-100 px-3 py-0.5 rounded-full">
                  الخطوة 1 من 2
                </span>
                <h1 className="text-2xl font-black text-ink-950 font-display mt-1.5">
                  أدخل رمز الغرفة
                </h1>
                <p className="text-xs text-ink-600 mt-1">
                  اكتب الرمز المعروض على شاشة المجلس للانضمام
                </p>
              </div>

              <div>
                <input
                  type="text"
                  autoFocus
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="مثال: TAQ1"
                  maxLength={8}
                  className="w-full uppercase font-mono tracking-widest text-center text-2xl font-black py-3 px-3 rounded-tactile border-2 border-ink-950 bg-sand-100 focus:bg-sand-50 focus:outline-none focus:ring-2 focus:ring-olive-500 shadow-tactile-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full btn-tactile-primary py-3.5 text-base mt-2 font-display font-black"
              >
                متابعة ◄
              </button>
            </form>
          )}

          {/* STEP 2: Player Nickname Input (Direct Join) */}
          {step === 'NAME_INPUT' && (
            <form onSubmit={handleNameSubmit} className="flex flex-col gap-4">
              <div className="text-center">
                <span className="text-xs font-bold text-olive-800 bg-olive-100 px-3 py-0.5 rounded-full">
                  الخطوة 2 من 2
                </span>
                <h1 className="text-2xl font-black text-ink-950 font-display mt-1.5">
                  اكتب اسمك المستعار
                </h1>
                <p className="text-xs text-ink-600 mt-1">
                  الاسم الذي سيظهر للجميع على الشاشة الكبيرة
                </p>
              </div>

              {targetCode && (
                <div className="flex flex-col items-center justify-center p-2.5 bg-sand-100 border-2 border-ink-950 rounded-tactile shadow-tactile-sm">
                  <span className="text-[11px] font-bold text-ink-600">رمز الغرفة:</span>
                  <span className="font-mono font-black text-xl tracking-widest text-ink-950">
                    {targetCode}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-ink-900 mb-1">
                  اسمك في اللعبة:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="مثال: فهد، نورة، أبو سعود..."
                  maxLength={16}
                  className="w-full text-base font-bold py-3.5 px-3 rounded-tactile border-2 border-ink-950 bg-sand-100 focus:bg-sand-50 focus:outline-none focus:ring-2 focus:ring-olive-500 shadow-tactile-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full btn-tactile-primary py-3.5 text-base mt-2 font-display font-black"
              >
                انضم للعبة فوراً ◄
              </button>

              {!urlCode && (
                <button
                  type="button"
                  onClick={() => setStep('CODE_INPUT')}
                  className="btn-tactile-ghost py-2 text-xs font-bold text-ink-600"
                >
                  الرجوع لتعديل رمز الغرفة
                </button>
              )}
            </form>
          )}

          {/* STEP 3: Confirmed Waiting Lobby */}
          {step === 'WAITING_LOBBY' && (
            <div className="flex flex-col items-center text-center gap-4 py-2">
              <div className="w-14 h-14 rounded-full bg-sand-200 border-2 border-ink-950 flex items-center justify-center text-ink-800 shadow-tactile">
                <Users className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-2xl font-black text-ink-950 font-display">
                  أنت جاهز يا {playerName}!
                </h2>
                <p className="text-xs text-ink-600 mt-1">
                  تم تثبيت انضمامك للعبة بنجاح
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-ink-700 bg-sand-100 px-3 py-1.5 rounded-tactile border border-ink-950/30">
                <span>رمز الغرفة:</span>
                <span className="font-mono font-black text-sm text-ink-950">{targetCode}</span>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/room/${targetCode}/play`)}
                className="w-full btn-tactile-primary py-3.5 text-base mt-2 font-display font-black flex items-center justify-center gap-2"
              >
                <span>الانتقال إلى يد التحكم / اللعب</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="text-center text-xs text-ink-500 py-3 flex items-center justify-center gap-2">
        <CheckCircle2 className="w-3.5 h-3.5 text-olive-700" />
        <span>طق عصي — لا حاجة لتحميل أي تطبيق</span>
      </footer>
    </div>
  );
};
