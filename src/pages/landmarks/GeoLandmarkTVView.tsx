import { FullscreenButton } from '../../components/common/FullscreenButton';
import { GeoTopNavControls } from '../../components/common/GeoTopNavControls';
import { GeographyGameLobby } from '../../components/common/GeographyGameLobby';
import { CopyCodeButton } from '../../components/common/CopyCodeButton';
import { LobbyRuleBox } from '../../components/common/LobbyRuleBox';
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Trophy,
  RotateCcw,
  Check,
  Clock,
  Users,
  Award,
  Crown,
  LogOut,
  MapPin,
  Globe2,
  Compass,
  Play,
  Share2,
  Copy,
} from 'lucide-react';
import { useRoom, roomBus, cleanRoomCode } from '../../lib/roomBus';
import { getLandmarksByScope } from '../../data/landmarks';
import { QRCodeView } from '../../components/common/QRCodeView';
import { DemoSwitcher } from '../../components/common/DemoSwitcher';
import { useSafeCountdown } from '../../hooks/useSafeCountdown';
import { sound } from '../../lib/audio';
import { LandmarkScope, LandmarkPlayer } from '../../types/landmarkGame';

// Animated Rolling Distance Counter
const RollingDistance: React.FC<{ targetDistance: number; active: boolean }> = ({
  targetDistance,
  active,
}) => {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!active) {
      setVal(0);
      return;
    }
    let current = 0;
    const step = Math.max(1, Math.floor(targetDistance / 25));
    const timer = setInterval(() => {
      current += step;
      if (current >= targetDistance) {
        current = targetDistance;
        clearInterval(timer);
      }
      setVal(current);
      sound.playTick();
    }, 40);

    return () => clearInterval(timer);
  }, [active, targetDistance]);

  return <span className="font-mono font-black">{val.toLocaleString('ar-SA')} كم</span>;
};

// Custom Tactile SVG Marker (Zero external PNG asset dependency in Vite)
const createCustomPinIcon = (color: string, label?: string) => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
        ${label ? `<span style="background:#2C2A29; color:#FFF; font-size:11px; font-weight:bold; padding:2px 8px; border-radius:4px; margin-bottom:3px; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.3); font-family:sans-serif; border: 1.5px solid #E5E0D5;">${label}</span>` : ''}
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

export const GeoLandmarkTVView: React.FC = () => {
  const params = useParams();
  const roomCode = (params.code || params.roomId || params.id || '').trim().toUpperCase() || 'TAQ1';
  const roomId = roomCode;

  useEffect(() => {
    console.log(`[DEBUG Mount] Room: "${roomCode}" | Component: "GeoLandmarkTVView" | Path: "${window.location.pathname}"`);
    if (!roomCode) {
      console.error('[RoomCode Error]: roomCode is empty or undefined on mount in GeoLandmarkTVView!');
    }
  }, [roomCode]);
  const navigate = useNavigate();
  const { room } = useRoom(roomId);

  

  const landmarkState = room?.landmarkState;
  const scope: LandmarkScope = landmarkState?.scope || 'saudi';

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Authoritative countdown for 45s timer
  const secondsLeft = useSafeCountdown(landmarkState?.roundEndsAt);

  // List of players (merge room.players and landmarkState.players deduplicated by normalized name)
  const playersList = useMemo(() => {
    const map = new Map<string, LandmarkPlayer>();
    const roomPlayers = room?.players || [];
    const lmPlayers = landmarkState?.players || {};

    roomPlayers.forEach((rp) => {
      if (!rp || !rp.name || rp.id === 'host_tv') return;
      const key = rp.name.trim().toLowerCase();
      const existingLm = lmPlayers[rp.id];
      map.set(key, existingLm || {
        id: rp.id,
        name: rp.name,
        score: 0,
        isReady: Boolean(rp.isReady),
        currentLat: null,
        currentLng: null,
        currentDistanceKm: null,
        currentPointsAwarded: 0,
        hasSubmitted: false,
      });
    });

    Object.values(lmPlayers).forEach((lp) => {
      if (!lp || !lp.name || lp.id === 'host_tv') return;
      const key = lp.name.trim().toLowerCase();
      if (map.has(key)) {
        const prev = map.get(key)!;
        map.set(key, {
          ...prev,
          ...lp,
          isReady: Boolean(prev.isReady || lp.isReady),
          hasSubmitted: Boolean(prev.hasSubmitted || lp.hasSubmitted),
          score: Math.max(prev.score || 0, lp.score || 0),
        });
      } else {
        map.set(key, lp);
      }
    });

    return Array.from(map.values());
  }, [room?.players, landmarkState?.players]);

  // Current Target Landmark
  const pool = useMemo(() => getLandmarksByScope(scope), [scope]);
  const currentLandmark = useMemo(() => {
    if (!landmarkState?.currentLandmarkId) return pool[0];
    return pool.find((l) => l.id === landmarkState.currentLandmarkId) || pool[0];
  }, [landmarkState?.currentLandmarkId, pool]);

  // Readiness tracking for intermission
  const [readyPlayerIds, setReadyPlayerIds] = useState<Set<string>>(new Set());
  const readyPlayerIdsRef = useRef<Set<string>>(readyPlayerIds);
  readyPlayerIdsRef.current = readyPlayerIds;

  // Game state flags
  const isLobby = !landmarkState || landmarkState.gameState === 'LOBBY';
  const isPlaying = landmarkState?.gameState === 'PLAYING';
  const isRevealing = landmarkState?.gameState === 'REVEALING';
  const isIntermission = landmarkState?.gameState === 'ROUND_INTERMISSION';
  const isGameOver = landmarkState?.gameState === 'GAME_OVER';

  // Room code copy state
  const [copiedCode, setCopiedCode] = useState(false);
  const copyRoomCode = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    sound.playClick();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Register TV as authoritative host
  useEffect(() => {
    const unregister = roomBus.registerHost(roomId);
    return () => unregister();
  }, [roomId]);

  // Ensure landmark game initialized
  useEffect(() => {
    if (room && (!room.landmarkState || room.selectedGameId !== 'geo-pin-landmark')) {
      roomBus.initLandmarkGame(roomId, 'saudi');
    }
  }, [room, roomId]);

  // Listen for player round readiness in intermission via roomBus events
  useEffect(() => {
    const unsubSubmission = roomBus.on('PLAYER_SUBMISSION', (payload) => {
      const cleanCode = roomId.toUpperCase().replace(/^ROOM_/, '');
      const incoming = (payload.roomCode || '').toUpperCase().replace(/^ROOM_/, '');
      if (incoming === cleanCode) {
        const data = payload.data || payload;
        const coords = data?.coordinates || data?.answer?.coordinates || (data?.answer?.lat !== undefined ? data?.answer : undefined);
        if (coords && coords.lat !== undefined && coords.lng !== undefined && data.playerId) {
          console.log('[Landmark Guess Received]:', data);
          roomBus.submitLandmarkGuess(cleanCode, data.playerId, coords.lat, coords.lng);
        }
      }
    });

    return () => unsubSubmission();
  }, [roomId]);

  useEffect(() => {
    const unsubscribe = roomBus.on('PLAYER_ROUND_READY', (payload) => {
      const cleanCode = roomId.toUpperCase().replace(/^ROOM_/, '');
      const incomingCode = (payload.roomCode || '').toUpperCase().replace(/^ROOM_/, '');
      if (incomingCode === cleanCode) {
        const { playerId, roundIndex } = payload.data || {};
        if (
          landmarkState?.gameState === 'ROUND_INTERMISSION' &&
          roundIndex === landmarkState.currentRound &&
          playerId
        ) {
          setReadyPlayerIds((prev) => {
            const next = new Set(prev);
            next.add(playerId);

            const activePlayers = playersList.filter((p) => p.isReady !== false);
            if (activePlayers.length > 0 && next.size >= activePlayers.length) {
              setTimeout(() => {
                roomBus.tvStartNextLandmarkRound(roomId, (landmarkState?.currentRound || 1) + 1);
                setReadyPlayerIds(new Set());
              }, 400);
            }
            return next;
          });
        }
      }
    });

    return () => unsubscribe();
  }, [roomId, landmarkState?.gameState, landmarkState?.currentRound, playersList]);

  // Synchronize ready player IDs directly from landmarkState.roundReadyPlayers (SSOT fallback)
  useEffect(() => {
    if (landmarkState?.gameState !== 'ROUND_INTERMISSION') return;

    const readyMap = landmarkState.roundReadyPlayers || {};
    const readyIds = Object.keys(readyMap).filter((k) => readyMap[k]);
    if (readyIds.length === 0) return;

    setReadyPlayerIds((prev) => {
      let hasNew = false;
      const next = new Set(prev);
      readyIds.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          hasNew = true;
        }
      });
      if (!hasNew) return prev;

      const activePlayers = playersList.filter((p) => p.isReady !== false);
      if (activePlayers.length > 0 && next.size >= activePlayers.length) {
        setTimeout(() => {
          roomBus.tvStartNextLandmarkRound(roomId, (landmarkState?.currentRound || 1) + 1);
          setReadyPlayerIds(new Set());
        }, 400);
      }
      return next;
    });
  }, [landmarkState?.gameState, landmarkState?.roundReadyPlayers, landmarkState?.currentRound, playersList, roomId]);

  // Reset ready set on round change
  useEffect(() => {
    setReadyPlayerIds(new Set());
  }, [landmarkState?.currentRound, landmarkState?.gameState]);

  // ========================================================
  // Leaflet Map Initialization & Lifecycle
  // ========================================================
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // React StrictMode protection: remove any leftover instance before mounting
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const centerLat = scope === 'saudi' ? 24.0 : 20.0;
    const centerLng = scope === 'saudi' ? 45.0 : 0.0;
    const zoom = scope === 'saudi' ? 5 : 2;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom,
      minZoom: scope === 'saudi' ? 4 : 2,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,
    });

    // 100% Free OpenStreetMap Tiles (Zero API Key required)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Custom Clean Zoom control top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    markersLayerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    // Fix 0px container collapse with delayed size recalculation
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [scope, !isLobby && !isGameOver]);

  // Update map view & markers on Game State changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    if (landmarkState?.gameState === 'PLAYING') {
      // Recenter to initial scope bounds
      const centerLat = scope === 'saudi' ? 24.0 : 20.0;
      const centerLng = scope === 'saudi' ? 45.0 : 0.0;
      const zoom = scope === 'saudi' ? 5 : 2;
      map.setView([centerLat, centerLng], zoom, { animate: true });
    }

    if (
      landmarkState?.gameState === 'REVEALING' ||
      landmarkState?.gameState === 'ROUND_INTERMISSION'
    ) {
      if (!currentLandmark) return;

      const allLatLngs: [number, number][] = [[currentLandmark.lat, currentLandmark.lng]];

      // 1. Authentic Target Pin (Olivine Green #8A9A5B)
      const authenticPin = createCustomPinIcon('#8A9A5B', `${currentLandmark.name} (الموقع الحقيقي)`);

      L.marker([currentLandmark.lat, currentLandmark.lng], {
        icon: authenticPin,
        zIndexOffset: 1000,
      }).addTo(layerGroup);

      // 2. Drop Player Pins & Dashed Distance Lines
      playersList.forEach((p) => {
        if (p.hasSubmitted && p.currentLat !== null && p.currentLng !== null) {
          allLatLngs.push([p.currentLat, p.currentLng]);

          // Player Pin (Ochre Yellow #C68B59)
          const distLabel = p.currentDistanceKm !== null ? `${p.name}: ${p.currentDistanceKm.toLocaleString('ar-SA')} كم` : p.name;
          const playerPin = createCustomPinIcon('#C68B59', distLabel);

          L.marker([p.currentLat, p.currentLng], {
            icon: playerPin,
            zIndexOffset: 500,
          }).addTo(layerGroup);

          // Dashed Polyline connecting to Authentic Pin
          L.polyline(
            [
              [p.currentLat, p.currentLng],
              [currentLandmark.lat, currentLandmark.lng],
            ],
            {
              color: '#C68B59',
              weight: 3,
              opacity: 0.85,
              dashArray: '8, 8',
            }
          ).addTo(layerGroup);
        }
      });

      // Smooth cinematic zoom and pan (flyToBounds) into the cluster
      if (allLatLngs.length > 0) {
        const bounds = L.latLngBounds(allLatLngs);
        map.flyToBounds(bounds, {
          padding: [80, 80],
          maxZoom: scope === 'saudi' ? 9 : 6,
          duration: 1.8,
          easeLinearity: 0.25,
        });
      }

      // Ensure layout is refreshed
      map.invalidateSize();
    }
  }, [landmarkState?.gameState, currentLandmark, playersList, scope]);

  // Submission statistics
  const submittedCount = useMemo(() => {
    return playersList.filter((p) => p.hasSubmitted).length;
  }, [playersList]);

  // Sorted winners for the round
  const roundRankings = useMemo(() => {
    return [...playersList]
      .filter((p) => p.currentDistanceKm !== null && p.currentDistanceKm < 99999)
      .sort((a, b) => (a.currentDistanceKm || 0) - (b.currentDistanceKm || 0));
  }, [playersList]);

  // Overall Match Leaderboard
  const totalLeaderboard = useMemo(() => {
    return [...playersList].sort((a, b) => b.score - a.score);
  }, [playersList]);

  const handleScopeSelect = (newScope: LandmarkScope) => {
    roomBus.setLandmarkScope(roomId, newScope);
  };

  const handleStartGame = () => {
    sound.playClick();
    if (playersList.length === 1) {
      roomBus.addMockPlayer(roomId);
    }
    setTimeout(() => {
      roomBus.tvStartNextLandmarkRound(roomId, 1);
    }, 100);
  };

  const handleResetToLobby = () => {
    sound.playClick();
    roomBus.resetLandmarkToLobby(roomId);
  };

  const handleKickPlayer = useCallback(async (targetPlayerId: string, playerName: string) => {
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
  }, [roomId]);

  const handleEndGame = () => {
    if (window.confirm('هل أنت متأكد من إنهاء اللعبة لجميع الأجهزة والعودة للرئيسية؟')) {
      roomBus.endGame(roomId);
      navigate('/');
    }
  };

  if (isLobby) {
    return (
      <GeographyGameLobby
        gameTitle="حدد الموقع"
        gameCategory="فئة الجغرافيا • ٥ جولات"
        icon={<Compass className="w-7 h-7 text-white" />}
        ruleSummary="يظهر اسم معلم بارز، ويتسابق اللاعبون على تحديد موقعه على الخريطة بدقة. الأقرب جغرافياً يربح نقاط الجولة!"
        roomCode={roomId}
        players={playersList}
        onStartGame={handleStartGame}
        onExitGame={handleEndGame}
        onKickPlayer={handleKickPlayer}
        canStart={playersList.length >= 1}
        customSlot={
          <div className="w-full max-w-2xl bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-4 shadow-[4px_4px_0px_#2C2A29]">
            <h2 className="text-base font-black text-[#000000] font-display text-center mb-3">
              اختر مسار المعالم للجلسة
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleScopeSelect('saudi')}
                className={`p-3.5 rounded-xl border-2 flex flex-col items-center gap-1.5 text-center transition-all cursor-pointer ${
                  scope === 'saudi'
                    ? 'bg-[#8A9A5B] text-white border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29]'
                    : 'bg-[#EDE7D9] text-[#000000] border-[#2C2A29] hover:bg-[#F7F4EC]'
                }`}
              >
                <MapPin className="w-6 h-6" />
                <span className="text-sm font-black font-display">معالم المملكة العربية السعودية</span>
                {scope === 'saudi' && (
                  <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded-full">المسار المختار</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleScopeSelect('world')}
                className={`p-3.5 rounded-xl border-2 flex flex-col items-center gap-1.5 text-center transition-all cursor-pointer ${
                  scope === 'world'
                    ? 'bg-[#8A9A5B] text-white border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29]'
                    : 'bg-[#EDE7D9] text-[#000000] border-[#2C2A29] hover:bg-[#F7F4EC]'
                }`}
              >
                <Globe2 className="w-6 h-6" />
                <span className="text-sm font-black font-display">معالم العالم الشهيرة</span>
                {scope === 'world' && (
                  <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded-full">المسار المختار</span>
                )}
              </button>
            </div>
          </div>
        }
      />
    );
  }

  return (
    <div
      className="h-screen w-screen h-[100dvh] overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] text-[#2C2A29] flex flex-col justify-between p-4 md:p-6 select-none"
      dir="rtl"
    >
      {/* Top TV Navigation Bar */}
      <header className="flex items-center justify-between border-b-2 border-[#2C2A29]/20 pb-3 gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#C68B59] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] duration-150 ease-out hover:-translate-y-1 flex items-center justify-center text-white font-bold">
              <Compass className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black font-display text-[#000000] leading-tight">
                طق عصي — حدد الموقع
              </span>
              <span className="text-xs font-bold text-[#5C4033]">
                {scope === 'saudi' ? 'معالم المملكة العربية السعودية' : 'معالم العالم الشهيرة'}
              </span>
            </div>
          </a>

          {!isLobby && (
            <div className="flex items-center gap-2 px-3 py-1 bg-[#C68B59] text-white border-2 border-[#2C2A29] rounded-xl shadow-[3px_3px_0px_#2C2A29] text-xs font-bold">
              <span>الجولة {landmarkState?.currentRound || 1} من 5</span>
            </div>
          )}
        </div>

        {/* Strictly HIDE room code during active gameplay on TV screen */}
        <GeoTopNavControls
          roomCode={roomId}
          showRoomCode={false}
            showFullscreen={true}
          exitActionType="return_lobby"
          exitLabel="العودة للوبي"
          onReturnToLobby={handleResetToLobby}
        />
      </header>

      {/* ======================================================== */}
      {/* 1. LOBBY VIEW (اختيار المسار وقائمة اللاعبين)               */}
      {/* ======================================================== */}
      {isLobby ? (
        <main className="my-auto py-6 max-w-5xl mx-auto w-full flex flex-col gap-6">
          {/* Prominent Giant Room Code Banner */}
          <div className="card-tactile p-6 bg-[#F7F4EC] flex flex-col md:flex-row items-center justify-between gap-6 border-3 border-ink-950 shadow-tactile-lg">
            <div className="flex flex-col gap-2 text-right">
              <span className="text-xs font-bold text-olive-800 bg-olive-100 px-3 py-0.5 rounded-full inline-block w-fit">
                طور التحدي الجغرافي
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-ink-950 font-display">
                حدد الموقع على الخريطة
              </h1>
              <p className="text-xs text-ink-600 max-w-md leading-relaxed">
                يظهر اسم معلم بارز، ويتسابق اللاعبون على تحديد موقعه على الخريطة بدقة. الأقرب جغرافياً يحصد أعلى النقاط!
              </p>
            </div>

            {/* Prominent Clear Copyable Code */}
            <div className="flex flex-col items-center justify-center p-4 bg-[#F7F4EC] border-2 border-ink-950 rounded-tactile shadow-tactile text-center gap-2">
              <span className="text-xs font-bold text-ink-600">رمز الغرفة المباشر:</span>
              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-3xl sm:text-4xl tracking-widest text-ochre-800">
                  {roomId}
                </span>
                <button
                  onClick={copyRoomCode}
                  className="p-2.5 bg-[#EDE7D9] hover:bg-sand-300 border-2 border-ink-950 rounded-tactile shadow-tactile-sm transition-all flex items-center gap-1.5 text-xs font-black cursor-pointer"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-olive-700" /> : <Copy className="w-4 h-4 text-ink-800" />}
                  <span>{copiedCode ? 'تم النسخ! ✓' : 'نسخ الرمز'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <QRCodeView
                url={`${typeof window !== 'undefined' ? window.location.origin : ''}/room/${roomId}/join`}
                size={120}
              />
              <span className="text-[11px] font-bold text-ink-600 mt-1">
                امسح الكود بجوالك للانضمام
              </span>
            </div>
          </div>

          {/* Scope Track Selector Card */}
          <div className="card-tactile p-6 bg-[#F7F4EC] flex flex-col gap-4">
            <h2 className="text-xl font-black text-ink-950 font-display text-center">
              اختر مسار المعالم للجلسة
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Option 1: Saudi Arabia */}
              <button
                onClick={() => handleScopeSelect('saudi')}
                className={`p-5 rounded-tactile border-3 flex flex-col items-center gap-2 text-center transition-all cursor-pointer ${
                  scope === 'saudi'
                    ? 'bg-olive-100 border-olive-900 shadow-tactile text-olive-950'
                    : 'bg-[#F7F4EC] border-sand-400 hover:bg-[#EDE7D9] text-ink-800'
                }`}
              >
                <MapPin className="w-8 h-8 text-olive-800" />
                <span className="text-lg font-black font-display">معالم المملكة العربية السعودية</span>
                {scope === 'saudi' && (
                  <span className="text-[11px] font-black bg-olive-200 px-3 py-0.5 rounded-full border border-olive-800 text-olive-950 mt-1">
                    المسار المختار
                  </span>
                )}
              </button>

              {/* Option 2: World */}
              <button
                onClick={() => handleScopeSelect('world')}
                className={`p-5 rounded-tactile border-3 flex flex-col items-center gap-2 text-center transition-all cursor-pointer ${
                  scope === 'world'
                    ? 'bg-ochre-100 border-ochre-900 shadow-tactile text-ochre-950'
                    : 'bg-[#F7F4EC] border-sand-400 hover:bg-[#EDE7D9] text-ink-800'
                }`}
              >
                <Globe2 className="w-8 h-8 text-ochre-800" />
                <span className="text-lg font-black font-display">معالم العالم الشهيرة</span>
                {scope === 'world' && (
                  <span className="text-[11px] font-black bg-ochre-200 px-3 py-0.5 rounded-full border border-ochre-800 text-ochre-950 mt-1">
                    المسار المختار
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Connected Players List & Start Game Footer */}
          <div className="card-tactile p-5 bg-[#F7F4EC] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-ink-600">المتسابقون (سولو - {playersList.length}):</span>
              {playersList.length === 0 ? (
                <span className="text-xs text-ochre-800 font-bold">بانتظار المتسابقين (أو ابدأ مباشرة للتجربة)...</span>
              ) : (
                playersList.map((p) => (
                  <span
                    key={p.id}
                    className="px-3 py-1 rounded-full bg-[#EDE7D9] border border-ink-950 text-xs font-black text-ink-950 shadow-tactile-sm"
                  >
                    {p.name}
                  </span>
                ))
              )}
            </div>

            <button
              onClick={handleStartGame}
              className="py-3 px-8 text-base font-black flex items-center gap-2 rounded-tactile border-2 border-ink-950 shadow-tactile transition-all bg-olive-500 hover:bg-olive-600 text-sand-50 cursor-pointer active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>ابدأ التحدي (5 جولات)</span>
            </button>
          </div>
        </main>
      ) : isGameOver ? (
        /* ======================================================== */
        /* 2. FINAL PODIUM VIEW (منصة التتويج النهائية)               */
        /* ======================================================== */
        <main className="my-auto py-8 max-w-4xl mx-auto w-full flex flex-col items-center gap-6">
          <div className="card-tactile p-8 bg-[#F7F4EC] w-full text-center flex flex-col items-center gap-4 shadow-tactile-xl">
            <div className="w-20 h-20 rounded-full bg-ochre-100 border-3 border-ink-950 flex items-center justify-center text-ochre-800 shadow-tactile-lg">
              <Trophy className="w-10 h-10" />
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-ink-950 font-display">
                منصة التتويج النهائية
              </h1>
              <p className="text-xs text-ink-600 mt-1">
                اكتملت الجولات الخمس وتم تحديد خبير الجغرافيا الأول للمجلس!
              </p>
            </div>

            {/* Top 3 Podium Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mt-4">
              {totalLeaderboard.slice(0, 3).map((p, idx) => (
                <div
                  key={p.id}
                  className={`p-5 rounded-tactile border-3 flex flex-col items-center gap-2 shadow-tactile ${
                    idx === 0
                      ? 'bg-olive-100 border-olive-900 text-olive-950 sm:-translate-y-2'
                      : idx === 1
                      ? 'bg-ochre-100 border-ochre-900 text-ochre-950'
                      : 'bg-[#F7F4EC] border-sand-400 text-ink-900'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {idx === 0 && <Crown className="w-5 h-5 text-olive-800" />}
                    <span className="text-xs font-black">
                      {idx === 0 ? 'المركز الأول' : idx === 1 ? 'المركز الثاني' : 'المركز الثالث'}
                    </span>
                  </div>
                  <h3 className="text-xl font-black font-display truncate max-w-[160px]">
                    {p.name}
                  </h3>
                  <div className="text-2xl font-black font-mono mt-1">
                    {p.score} <span className="text-xs font-bold font-sans">pt</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleResetToLobby}
              className="bg-[#8A9A5B] text-white border-2 border-[#2C2A29]/25 shadow-[0_4px_0_#2C2A29] active:translate-y-1 active:shadow-[0_0px_0_#2C2A29] transition-all font-bold cursor-pointer py-3.5 px-8 text-base font-display font-black mt-4 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>لعبة جديدة</span>
            </button>
          </div>
        </main>
      ) : (
        /* ======================================================== */
        /* 3. ACTIVE GAMEPLAY & REVEAL (الخريطة + لوحة التقييم)      */
        /* ======================================================== */
        <main className="my-auto py-2 grid lg:grid-cols-12 gap-5 items-stretch max-w-7xl mx-auto w-full">
          {/* Main Left/Center: Interactive Map (8 Cols) */}
          <section className="lg:col-span-8 flex flex-col gap-3">
            {/* Top Prominent Landmark Name Banner */}
            <div className="card-tactile p-4 bg-[#F7F4EC] flex items-center justify-between border-2 border-ink-950">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-tactile bg-olive-500 border-2 border-ink-950 flex items-center justify-center text-sand-50 shadow-tactile-sm">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-ink-600 block">
                    المعلم المطلوب تحديده (الجولة {landmarkState?.currentRound}/5):
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-ink-950 font-display">
                    {currentLandmark?.name}
                  </h2>
                </div>
              </div>

              {/* Status / Countdown */}
              {isPlaying && (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-ink-600">الوقت المتبقي:</span>
                    <span className="font-mono font-black text-2xl text-ochre-700">
                      {secondsLeft}s
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Leaflet Map Canvas Container */}
            <div className="card-tactile p-1.5 bg-[#F7F4EC] border-2 border-ink-950 h-[55vh] md:h-[650px] min-h-[350px] relative overflow-hidden">
              <div ref={mapContainerRef} className="w-full h-full rounded-tactile z-0" style={{ minHeight: '350px' }} />

              {/* Live Submission Counter Overlay during Playing */}
              {isPlaying && (
                <div className="absolute top-4 left-4 z-10 px-4 py-2 bg-[#F7F4EC]/95 border-2 border-ink-950 rounded-tactile shadow-tactile text-xs font-black text-ink-950 flex items-center gap-2">
                  <Users className="w-4 h-4 text-olive-800" />
                  <span>
                    تم التثبيت: {submittedCount} / {playersList.length} لاعبين
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Right Column: Live Results, Rankings & Next Round (4 Cols) */}
          <section className="lg:col-span-4 flex flex-col gap-4">
            {/* Round Summary Card */}
            <div className="card-tactile p-5 bg-[#F7F4EC] flex flex-col gap-4 flex-1">
              <div className="flex items-center justify-between border-b border-sand-300 pb-2">
                <h3 className="text-base font-black text-ink-950 font-display">
                  {isPlaying
                    ? 'بانتظار تثبيت المواقع'
                    : isRevealing
                    ? 'كشف المسافات والنقاط'
                    : 'استراحة الجولة'}
                </h3>
                <span className="text-xs font-mono font-bold text-ink-600">
                  الجولة {landmarkState?.currentRound} / 5
                </span>
              </div>

              {isPlaying ? (
                <div className="flex flex-col gap-3 my-auto">
                  <p className="text-xs text-ink-600 leading-relaxed text-center">
                    يقوم اللاعبون الآن بوضع الدبوس وتثبيت الإحداثيات على شاشات هواتفهم..
                  </p>

                  <div className="flex flex-col gap-1.5 mt-2">
                    {playersList.map((p) => (
                      <div
                        key={p.id}
                        className={`p-2.5 rounded-tactile border-2 flex items-center justify-between text-xs transition-all ${
                          p.hasSubmitted
                            ? 'bg-olive-50 border-olive-900 text-olive-950'
                            : 'bg-[#F7F4EC] border-sand-300 text-ink-600'
                        }`}
                      >
                        <span className="font-bold">{p.name}</span>
                        <span className="text-[11px] font-black">
                          {p.hasSubmitted ? '✓ تم التثبيت' : 'جاري التحديد...'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Reveal / Intermission Rankings */
                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-black text-olive-900 bg-olive-100 px-3 py-1 rounded-full border border-olive-800 text-center">
                    ترتيب الأقرب للمعلم في هذه الجولة:
                  </span>

                  <div className="flex flex-col gap-2">
                    {roundRankings.map((p, idx) => (
                      <div
                        key={p.id}
                        className={`p-3 rounded-tactile border-2 flex items-center justify-between text-xs shadow-tactile-sm ${
                          idx === 0
                            ? 'bg-olive-100 border-olive-900 text-olive-950 font-black'
                            : idx === 1
                            ? 'bg-ochre-100 border-ochre-900 text-ochre-950 font-bold'
                            : 'bg-[#F7F4EC] border-sand-400 text-ink-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-ink-950 text-sand-50 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-black text-sm">{p.name}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <RollingDistance
                            targetDistance={p.currentDistanceKm || 0}
                            active={isRevealing || isIntermission}
                          />
                          {p.currentPointsAwarded > 0 && (
                            <span className="px-2 py-0.5 rounded bg-olive-700 text-sand-50 font-mono font-bold text-[11px]">
                              +{p.currentPointsAwarded}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Intermission Next Round Trigger */}
                  {isIntermission && (
                    <div className="mt-4 pt-3 border-t border-sand-300 flex flex-col gap-2 text-center">
                      <span className="text-xs font-black text-ochre-900 bg-ochre-100 px-3 py-1 rounded-full border border-ochre-800">
                        جاهز للجولة القادمة: {readyPlayerIds.size} / {playersList.length} لاعبين
                      </span>
                      <p className="text-[11px] text-ink-600">
                        اضغط على "أنا جاهز" من جوالك للانتقال للجولة التالية فوراً.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {/* Footer info */}
      <footer className="card-tactile p-2.5 bg-[#F7F4EC] text-center text-xs text-ink-600 font-bold flex items-center justify-between">
        <span>طق عصي — حدد الموقع الجغرافي</span>
        <span className="font-mono text-ink-950">غرفة: {roomId}</span>
      </footer>

      {/* Demo Switcher Tools */}
      <DemoSwitcher roomId={roomId} currentRole="tv" />
    </div>
  );
};
