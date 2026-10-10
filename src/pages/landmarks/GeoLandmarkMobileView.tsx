import { MobileTopBar } from '../../components/common/MobileTopBar';
import { CopyCodeButton } from '../../components/common/CopyCodeButton';
import { GeoTopNavControls } from '../../components/common/GeoTopNavControls';
import { ShareRoomButton } from '../../components/common/ShareRoomButton';
import { LobbyRuleBox } from '../../components/common/LobbyRuleBox';
import { MobileReadyButton } from '../../components/common/MobileReadyButton';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  CheckCircle2,
  Clock,
  Compass,
  Trophy,
  Check,
  RotateCcw,
  Sparkles,
  LogOut,
  Navigation,
  Copy,
} from 'lucide-react';
import { useRoom, roomBus } from '../../lib/roomBus';
import { getLandmarksByScope } from '../../data/landmarks';
import { LandmarkScope } from '../../types/landmarkGame';
import { DemoSwitcher } from '../../components/common/DemoSwitcher';
import { useSafeCountdown } from '../../hooks/useSafeCountdown';
import { sound } from '../../lib/audio';
// Custom Tactile SVG Marker (Zero external PNG asset dependency in Vite)
const createCustomPinIcon = (color: string, label?: string) => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
        ${label ? `<span style="background:#2C2A29; color:#FFF; font-size:11px; font-weight:bold; padding:2px 6px; border-radius:4px; margin-bottom:2px; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.3); font-family:sans-serif;">${label}</span>` : ''}
        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.16344 0 0 7.16344 0 16C0 27.5 16 42 16 42C16 42 32 27.5 32 16C32 7.16344 24.8366 0 16 0Z" fill="${color}" stroke="#FFFFFF" stroke-width="2"/>
          <circle cx="16" cy="16" r="6" fill="#FFFFFF"/>
        </svg>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

interface GeoLandmarkMobileViewProps {
  channel?: any;
  roomCode?: string;
  playerId?: string;
  playerName?: string;
}

export const GeoLandmarkMobileView: React.FC<GeoLandmarkMobileViewProps> = ({
  channel,
  roomCode: propRoomCode,
  playerId: propPlayerId,
  playerName: propPlayerName,
}) => {
  const params = useParams();
  const roomCode = (propRoomCode || params.code || params.roomId || params.id || '').trim().toUpperCase() || 'TAQ1';
  const roomId = roomCode;

  useEffect(() => {
    console.log(`[DEBUG Mount] Room: "${roomCode}" | Component: "GeoLandmarkMobileView" | Path: "${window.location.pathname}"`);
    if (!roomCode) {
      console.error('[RoomCode Error]: roomCode is empty or undefined on mount!');
    }
  }, [roomCode]);
  const navigate = useNavigate();
  const { room } = useRoom(roomId);

  const landmarkState = room?.landmarkState;
  const scope: LandmarkScope = landmarkState?.scope || 'saudi';

  // Map DOM and instance refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const pinLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // User's placed coordinates
  const [placedLatLng, setPlacedLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [isSubmittedLocally, setIsSubmittedLocally] = useState<boolean>(false);
  const [isReadyLocally, setIsReadyLocally] = useState<boolean>(false);
  const isSubmittedRef = useRef(false);
  isSubmittedRef.current = isSubmittedLocally;

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
    return false;
  });

  const handleJoin = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      alert('يرجى إدخال اسمك أولاً');
      return;
    }
    console.log('[حدد الموقع Join Clicked]:', nickname);

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

  // Authoritative countdown for 45s timer
  const secondsLeft = useSafeCountdown(landmarkState?.roundEndsAt);

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
      room?.players.find((p) => p.id === savedPlayerId) ||
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

  const currentLandmarkPlayer = useMemo(() => {
    if (!landmarkState || !savedPlayerId) return null;
    return (
      landmarkState.players[savedPlayerId] || {
        id: savedPlayerId,
        name: nickname || propPlayerName || 'متسابق',
        score: 0,
        isReady: isReadyLocally,
        currentLat: null,
        currentLng: null,
        currentDistanceKm: null,
        currentPointsAwarded: 0,
        hasSubmitted: isSubmittedLocally,
      }
    );
  }, [landmarkState, savedPlayerId, nickname, propPlayerName, isReadyLocally, isSubmittedLocally]);

  // Current Target Landmark
  const pool = useMemo(() => getLandmarksByScope(scope), [scope]);
  const currentLandmark = useMemo(() => {
    if (!landmarkState?.currentLandmarkId) return pool[0];
    return pool.find((l) => l.id === landmarkState.currentLandmarkId) || pool[0];
  }, [landmarkState?.currentLandmarkId, pool]);

  // Ensure current player is registered in landmark state
  useEffect(() => {
    if (!room) return;
    if (!savedPlayerId || !isJoined) {
      return;
    }

    if (landmarkState && !landmarkState.players[savedPlayerId] && currentPlayer) {
      if (roomBus.isHosting(roomId)) {
        landmarkState.players[savedPlayerId] = {
          id: currentPlayer.id,
          name: currentPlayer.name,
          score: 0,
          isReady: false,
          currentLat: null,
          currentLng: null,
          currentDistanceKm: null,
          currentPointsAwarded: 0,
          hasSubmitted: false,
        };
        roomBus.saveRoom(room);
      } else {
        roomBus.joinPlayer(roomId, currentPlayer.name, currentPlayer.avatar, 'team_a');
      }
    }
  }, [room, savedPlayerId, currentPlayer, landmarkState, roomId, navigate]);

  // Listen for authoritative GAME_ENDED from TV Screen
  useEffect(() => {
    const unsub = roomBus.on('GAME_ENDED', (payload) => {
      const cleanCode = roomId.toUpperCase().replace(/^ROOM_/, '');
      const incoming = (payload.roomCode || '').toUpperCase().replace(/^ROOM_/, '');
      if (incoming === cleanCode) {
        navigate('/');
      }
    });

    return () => unsub();
  }, [roomId, navigate]);

  const currentRoundNumber = Number(landmarkState?.currentRound || 1);

  // Listen to broadcast ROUND_STARTED from both channel and roomBus
  useEffect(() => {
    const handleRoundReset = (payload?: any) => {
      console.log(`[MOBILE RESET] Round started event received: ${payload?.round || currentRoundNumber}. Resetting input states.`);
      setPlacedLatLng(null);
      setIsSubmittedLocally(false);
      setIsReadyLocally(false);
      if (pinLayerGroupRef.current) {
        pinLayerGroupRef.current.clearLayers();
      }
    };

    const unsub = roomBus.on('ROUND_STARTED', (payload) => handleRoundReset(payload?.data || payload));
    if (channel) {
      channel.on('broadcast', { event: 'ROUND_STARTED' }, ({ payload }: any) => handleRoundReset(payload));
    }
    return () => unsub();
  }, [channel, currentRoundNumber]);

  // Hard reset for Landmark on every round change
  useEffect(() => {
    console.log(`[MOBILE RESET] Round changed to: ${currentRoundNumber}. Resetting input states.`);
    setPlacedLatLng(null);
    setIsSubmittedLocally(false);
    setIsReadyLocally(false);

    if (pinLayerGroupRef.current) {
      pinLayerGroupRef.current.clearLayers();
    }

    if (mapInstanceRef.current) {
      const defaultCenter: [number, number] = scope === 'saudi' ? [24.0, 45.0] : [20.0, 0.0];
      const defaultZoom = scope === 'saudi' ? 5 : 2;
      mapInstanceRef.current.setView(defaultCenter, defaultZoom);
      mapInstanceRef.current.invalidateSize();
    }
  }, [currentRoundNumber, scope]);

  // Force Leaflet recalculation on isPlaying state
  useEffect(() => {
    if (landmarkState?.gameState === 'PLAYING' && mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [landmarkState?.gameState]);

  // Auto-submit pin if 45s timer expires and pin was placed
  useEffect(() => {
    if (landmarkState?.gameState === 'PLAYING' && secondsLeft <= 0 && !isSubmittedLocally) {
      if (placedLatLng) {
        handleSubmitPin();
      }
    }
  }, [secondsLeft, landmarkState?.gameState, isSubmittedLocally, placedLatLng]);

  // ========================================================
  // Leaflet Map Initialization & Interactive Pin Placement
  // ========================================================
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Prevent duplicate initialization in StrictMode
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const initialCenter: [number, number] = scope === 'saudi' ? [24.0, 45.0] : [20.0, 0.0];
    const initialZoom = scope === 'saudi' ? 5 : 2;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: scope === 'saudi' ? 4 : 2,
      maxZoom: 19,
      zoomControl: true,
      attributionControl: false,
      worldCopyJump: true, // Fixes marker positioning across world meridian bounds
    });

    // 100% Free OpenStreetMap Tiles (Zero API Key required)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Dedicated layer group for the player's pin:
    const pinGroup = L.layerGroup().addTo(map);
    pinLayerGroupRef.current = pinGroup;
    mapInstanceRef.current = map;

    // Map Click Handler to Place / Move Pin Unconditionally via LayerGroup
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isSubmittedRef.current) return;

      const { lat, lng } = e.latlng;
      setPlacedLatLng({ lat, lng });
      sound.playTick();

      if (pinLayerGroupRef.current) {
        pinLayerGroupRef.current.clearLayers(); // Wipe any previous pin completely

        const newPin = L.marker([lat, lng], {
          icon: createCustomPinIcon('#C68B59', 'موقعك المقترح'),
          draggable: true,
        });

        newPin.on('dragend', () => {
          const pos = newPin.getLatLng();
          if (pos) setPlacedLatLng({ lat: pos.lat, lng: pos.lng });
        });

        newPin.addTo(pinLayerGroupRef.current);
      }
    });

    // Trigger multiple invalidateSize calls to guarantee proper layout
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      map.remove();
      mapInstanceRef.current = null;
      pinLayerGroupRef.current = null;
    };
  }, [scope, landmarkState?.gameState === 'PLAYING']);

  // Handle Action Button: "تثبيت الموقع"
  const handleSubmitPin = () => {
    if (!placedLatLng || !savedPlayerId || isSubmittedLocally) return;
    sound.playClick();
    setIsSubmittedLocally(true);

    if (pinLayerGroupRef.current) {
      pinLayerGroupRef.current.eachLayer((layer: any) => {
        if (layer.dragging) {
          layer.dragging.disable();
        }
      });
    }

    const currentRoundNumber = Number(landmarkState?.currentRound || 1);

    roomBus.submitLandmarkGuess(
      roomId,
      savedPlayerId,
      placedLatLng.lat,
      placedLatLng.lng
    );

    const payload = {
      playerId: savedPlayerId,
      round: currentRoundNumber,
      coordinates: { lat: placedLatLng.lat, lng: placedLatLng.lng },
      timestamp: Date.now()
    };

    roomBus.broadcastPlayerSubmission(
      roomId,
      savedPlayerId,
      payload,
      currentRoundNumber
    );
  };

  // Handle Action Button: "أنا جاهز للجولة القادمة"
  const handleExitGame = () => {
    const confirmed = window.confirm('هل أنت متأكد من الخروج من اللعبة؟');
    if (!confirmed) return;
    sound.playClick();
    if (savedPlayerId) {
      roomBus.leavePlayer(roomId, savedPlayerId);
    }
    navigate('/');
  };

  const handleToggleReady = () => {
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
  };

  const handleReadyForNextRound = () => {
    const pid = savedPlayerId || currentPlayer?.id || currentLandmarkPlayer?.id;
    if (!pid || isReadyLocally) return;
    sound.playClick();
    setIsReadyLocally(true);
    roomBus.readyForNextLandmarkRound(roomId, pid);
  };

  const isLobby = !landmarkState || landmarkState.gameState === 'LOBBY';
  const isPlaying = landmarkState?.gameState === 'PLAYING';
  const isRevealing = landmarkState?.gameState === 'REVEALING';
  const isIntermission = landmarkState?.gameState === 'ROUND_INTERMISSION';
  const isGameOver = landmarkState?.gameState === 'GAME_OVER';

  return (
    <div className="w-full max-w-lg mx-auto h-[100dvh] flex flex-col justify-between p-3.5 overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] text-[#2C2A29] select-none"
      dir="rtl"
    >
      <MobileTopBar roomCode={room?.code || roomId} onExit={handleExitGame} points={currentLandmarkPlayer?.score || 0} title={isLobby ? 'لوبي الانتظار' : isPlaying ? `الجولة ${landmarkState?.currentRound || 1} من ${landmarkState?.totalRounds || 5}` : undefined} />

      {/* Main Content Body */}
      <main className="my-auto py-2 flex flex-col items-center justify-center w-full">
        {isLobby ? (
          /* ======================================================== */
          /* 1. LOBBY WAITING                                         */
          /* ======================================================== */
          <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-5 shadow-[4px_4px_0px_#2C2A29] text-center w-full flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] flex items-center justify-center text-white">
              <Compass className="w-7 h-7 text-white" />
            </div>

            <div>
              <h1 className="text-2xl font-black font-display text-[#000000]">حدد الموقع</h1>
              <p className="text-xs font-bold text-[#5C4033] mt-0.5">
                أنت جاهز يا {currentPlayer?.name || currentLandmarkPlayer?.name || 'متسابق'}!
              </p>
            </div>

            <LobbyRuleBox
              summary="اسحب الخريطة وضع الدبوس بأقرب نقطة ممكنة لموقع المعلم المطلوب. الأقرب جغرافياً يربح نقاط الجولة!"
              className="text-xs p-3"
            />

            <MobileReadyButton
              isReady={Boolean(currentPlayer?.isReady || currentLandmarkPlayer?.isReady || isReadyLocally)}
              onToggle={handleToggleReady}
            />

            <ShareRoomButton roomCode={room?.code || roomId} />

            <div className="text-center text-xs font-bold text-[#5C4033] bg-[#EDE7D9] px-4 py-1.5 rounded-xl border border-[#2C2A29]/20 w-full">
              الجاهزون: {(() => {
                const map = new Map<string, any>();
                Object.values(landmarkState?.players || {}).forEach((p: any) => {
                  if (p?.name) map.set(p.name.trim().toLowerCase(), p);
                });
                const list = Array.from(map.values());
                return `${list.filter(p => p.isReady).length} من ${list.length || 1}`;
              })()} متسابق
            </div>
          </div>
        ) : isPlaying ? (
          /* ======================================================== */
          /* 2. PLAYING PHASE (PIN PLACEMENT MAP)                     */
          /* ======================================================== */
          <div className="flex flex-col gap-2 w-full flex-1 min-h-0">
            {/* Top Landmark Name & 45s Timer Banner */}
            <div className="card-tactile p-3 bg-[#F7F4EC] flex items-center justify-between border-2 border-ink-950">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-olive-800" />
                <span className="text-base font-black text-ink-950 font-display truncate">
                  {currentLandmark?.name}
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-mono font-black text-sm text-ochre-700 bg-ochre-100 px-2 py-0.5 rounded border border-ochre-800">
                <Clock className="w-3.5 h-3.5" />
                <span>{secondsLeft}s</span>
              </div>
            </div>

            {/* 70% Height Responsive Leaflet Map Canvas */}
            <div className="relative w-full flex-1 min-h-[320px] rounded-2xl overflow-hidden border-2 border-[#2C2A29] shadow-inner bg-[#F7F4EC]">
              <div ref={mapContainerRef} className="w-full h-full" />

              {/* Instructions Overlay */}
              {!placedLatLng && !isSubmittedLocally && (
                <div className="absolute top-2 right-2 left-2 z-10 px-3 py-1.5 bg-[#F7F4EC]/90 border border-ink-950 rounded text-[11px] font-bold text-ink-800 text-center pointer-events-none shadow-sm">
                  انقر على الخريطة لوضع الدبوس في موقع المعلم
                </div>
              )}
            </div>

            {/* Bottom Action Area: Large Tactile Submit Button */}
            {isSubmittedLocally ? (
              <div className="p-3 bg-olive-100 border-2 border-olive-900 rounded-tactile text-center shadow-tactile-sm">
                <span className="text-xs font-black text-olive-950 block">
                  ✓ تم اعتماد موقعك بنجاح!
                </span>
                <span className="text-[11px] text-olive-800 font-bold mt-0.5 block">
                  خلك مع الشاشة الكبيرة لمشاهدة النتيجة وكشف المسافات
                </span>
              </div>
            ) : (
              <button
                onClick={handleSubmitPin}
                disabled={!placedLatLng || isSubmittedLocally}
                className={`w-full py-3.5 text-base font-black font-display rounded-tactile border-2 border-ink-950 shadow-tactile transition-all cursor-pointer ${
                  placedLatLng
                    ? 'bg-[#8A9A5B] hover:bg-[#2C2A29] text-white hover:text-[#E5E0D5] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] font-bold active:translate-y-0.5 active:shadow-[1px_1px_0px_#2C2A29] transition-all cursor-pointer'
                    : 'bg-[#EDE7D9] text-ink-400 cursor-not-allowed opacity-60'
                }`}
              >
                {placedLatLng ? 'تثبيت الموقع والاعتماد' : 'حدد موقعاً على الخريطة أولاً'}
              </button>
            )}
          </div>
        ) : isRevealing ? (
          /* ======================================================== */
          /* 3. REVEALING PHASE                                       */
          /* ======================================================== */
          <div className="card-tactile p-6 bg-[#F7F4EC] text-center w-full flex flex-col items-center gap-3 shadow-tactile-lg">
            <div className="w-14 h-14 rounded-full bg-olive-100 border-2 border-ink-950 flex items-center justify-center text-olive-800 shadow-tactile-sm animate-pulse">
              <Compass className="w-7 h-7" />
            </div>

            <h2 className="text-xl font-black text-ink-950 font-display">
              كشف الإجابات على الشاشة الكبيرة!
            </h2>

            <p className="text-xs text-ink-600 leading-relaxed">
              راقب التلفزيون في المجلس لرؤية الموقع الحقيقي ومسافات جميع المتسابقين.
            </p>
          </div>
        ) : isIntermission ? (
          /* ======================================================== */
          /* 4. ROUND INTERMISSION & READY STATE                      */
          /* ======================================================== */
          <div className="card-tactile p-6 bg-[#F7F4EC] text-center w-full flex flex-col items-center gap-4 shadow-tactile-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-olive-800 bg-olive-100 px-3 py-0.5 rounded-full border border-olive-800">
                نتيجة الجولة {landmarkState?.currentRound}
              </span>
            </div>

            {/* Distance & Points Display */}
            <div className="p-4 bg-[#F7F4EC] border-2 border-ink-950 rounded-tactile w-full flex flex-col items-center gap-1.5">
              <span className="text-xs text-ink-600 font-bold">المسافة عن الموقع الحقيقي:</span>
              <span className="text-2xl font-black font-mono text-ink-950">
                {currentLandmarkPlayer &&
                currentLandmarkPlayer.currentDistanceKm != null &&
                currentLandmarkPlayer.currentDistanceKm < 99999
                  ? `${currentLandmarkPlayer.currentDistanceKm.toLocaleString('ar-SA')} كم`
                  : 'لم يتم التثبيت'}
              </span>

              {currentLandmarkPlayer && currentLandmarkPlayer.currentPointsAwarded > 0 ? (
                <span className="text-xs font-black text-olive-900 bg-olive-200 px-3 py-1 rounded-full border border-olive-800 mt-1">
                  +{currentLandmarkPlayer.currentPointsAwarded} pt محصلة في هذه الجولة!
                </span>
              ) : (
                <span className="text-xs text-ink-500 font-bold mt-1">
                  حاول الاقتراب أكثر في الجولة القادمة!
                </span>
              )}
            </div>

            {/* Ready Action Button */}
            {isReadyLocally ? (
              <div className="p-3 bg-olive-100 border border-olive-900 rounded-tactile text-xs font-black text-olive-950 w-full">
                ✓ تم تأكيد جاهزيتك.. بانتظار بقية اللاعبين
              </div>
            ) : (
              <button
                onClick={handleReadyForNextRound}
                className="w-full py-3.5 bg-[#8A9A5B] hover:bg-[#2C2A29] text-white hover:text-[#E5E0D5] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-xl font-display font-black text-base active:translate-y-0.5 active:shadow-[1px_1px_0px_#2C2A29] transition-all cursor-pointer"
              >
                أنا جاهز للجولة القادمة ◄
              </button>
            )}
          </div>
        ) : isGameOver ? (
          /* ======================================================== */
          /* 5. FINAL PODIUM MOBILE VIEW                              */
          /* ======================================================== */
          <div className="card-tactile p-6 bg-[#F7F4EC] text-center w-full flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-ochre-100 border-2 border-ink-950 flex items-center justify-center text-ochre-800 shadow-tactile">
              <Trophy className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-ink-950 font-display">
                انتهت الجولات الخمس!
              </h2>
              <p className="text-xs text-ink-600 mt-1">
                مجموع نقاطك النهائي: {currentLandmarkPlayer?.score || 0} pt
              </p>
            </div>

            <button
              onClick={() => navigate('/')}
              className="btn-tactile-primary py-3 px-6 text-sm font-black w-full"
            >
              العودة للرئيسية
            </button>
          </div>
        ) : null}
      </main>

      {/* Mobile Footer */}
      <footer className="card-tactile p-2 bg-[#F7F4EC] text-center text-[11px] text-ink-600 font-bold flex items-center justify-between">
        <span>طق عصي — حدد الموقع</span>
        <span className="flex items-center gap-1 text-olive-800">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>متصل</span>
        </span>
      </footer>

      {/* Demo Switcher Tools */}
      <DemoSwitcher roomId={roomId} currentRole="player" />
    </div>
  );
};
