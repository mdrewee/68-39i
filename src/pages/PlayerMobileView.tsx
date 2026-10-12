import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Zap, Users, LogOut, CheckCircle2, Shuffle, Sparkles, Check, Crown, Clock } from 'lucide-react';
import { useRoom, roomBus } from '../lib/roomBus';
import { DemoSwitcher } from '../components/common/DemoSwitcher';
import { sound } from '../lib/audio';
import { Player, TeamId, HexCell } from '../types/game';
import { FlagMobileView } from './flags/FlagMobileView';
import { GeoLandmarkMobileView } from './landmarks/GeoLandmarkMobileView';
import { TrajectoryMobileView } from './trajectory/TrajectoryMobileView';
import { BlindTourismMobileView } from './tourism/BlindTourismMobileView';
import { ScattergoriesMobileView } from './words/scattergories/ScattergoriesMobileView';
import { WordleRushMobileView } from './words/wordle-rush/WordleRushMobileView';
import { PentagonClashMobileView } from './words/pentagon-clash/PentagonClashMobileView';
import { ThreeLetterWordMobileView } from './words/three-letter-word/ThreeLetterWordMobileView';
import { WhoIsAiMobileView } from './ai/who-is-ai/WhoIsAiMobileView';
import { AiLawyerMobileView } from './ai/ai-lawyer/AiLawyerMobileView';
import { TheScammerMobileView } from './ai/the-scammer/TheScammerMobileView';
import { ConspiracyMobileView } from './ai/conspiracy-maker/ConspiracyMobileView';
import { WalaKalimaMobileView } from './eshrah/WalaKalima/WalaKalimaMobileView';
import { ForbiddenWordsMobileView } from './eshrah/ForbiddenWords/ForbiddenWordsMobileView';
import { OneWordMobileView } from './eshrah/OneWord/OneWordMobileView';
import { MoveThePuppetMobileView } from './eshrah/MoveThePuppet/MoveThePuppetMobileView';
import { FootballBingoMobileView } from './football/football-bingo/FootballBingoMobileView';
import { MutualLinkMobileView } from './football/mutual-link/MutualLinkMobileView';
import { DraftMobileView } from './football/draft-5/DraftMobileView';
import { MobileTopBar } from '../components/MobileTopBar';
import { getOrCreatePlayerId, getOrCreatePlayerName, clearPlayerSession } from '../utils/playerSession';
import { useSafeCountdown } from '../hooks/useSafeCountdown';

import { supabase } from '../lib/supabase';

export const PlayerMobileView: React.FC = () => {
  const params = useParams();
  const roomCode = (params.code || params.roomId || params.id || '').trim().toUpperCase() || 'TAQ1';
  const roomId = roomCode;
  const navigate = useNavigate();

  const isSubscribedRef = React.useRef(false);
  const [activeChannel, setActiveChannel] = useState<any>(null);

  // If user opened /room/:code/play directly without joining or entering name, redirect to join
  useEffect(() => {
    const hasPlayer =
      sessionStorage.getItem(`taghesi_player_${roomCode}`) ||
      sessionStorage.getItem('party_player_id') ||
      sessionStorage.getItem('taq_session_player_name');
    if (!hasPlayer) {
      navigate(`/room/${roomCode}/join`, { replace: true });
    }
  }, [roomCode, navigate]);

  // Ensure room state exists locally as a fallback so view renders immediately
  useEffect(() => {
    if (roomCode && !roomBus.getRoom(roomCode)) {
      roomBus.createRoom(roomCode);
    }
  }, [roomCode]);

  const [playerId] = useState<string>(() => getOrCreatePlayerId());
  const [playerName] = useState<string>(() => getOrCreatePlayerName('متسابق'));

  // Readable String Logging
  useEffect(() => {
    console.log(`[DEBUG Mount] Room: "${roomCode}" | Player: "${playerId}" | Path: "${window.location.pathname}"`);
  }, [roomCode, playerId]);

  // Strict Singleton Guard for Supabase Channel (useRef)
  useEffect(() => {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    if (!cleanCode || !playerId) return;

    // Prevent multiple executions in StrictMode or re-render loops
    if (isSubscribedRef.current) return;
    isSubscribedRef.current = true;

    console.log(`[STABLE MOUNT] Starting single connection for room: "${cleanCode}" | Player: "${playerId}"`);

    // Clean up any existing channel with matching topic from Supabase client cache
    const channelName = `room:${cleanCode.trim().toUpperCase()}`;
    const existingChannels = supabase.getChannels().filter(
      (ch: any) => ch.topic === `realtime:${channelName}` || ch.topic === channelName || ch.topic === `room_${cleanCode}` || ch.topic === `realtime:room_${cleanCode}`
    );
    existingChannels.forEach((existing: any) => {
      try {
        supabase.removeChannel(existing);
      } catch (e) {
        console.warn('[Channel Remove Warn]:', e);
      }
    });

    // Create fresh channel and chain all listeners BEFORE calling subscribe()
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: true, ack: true },
          presence: { key: playerId }
        }
      })
      .on('presence', { event: 'sync' }, () => {
        try {
          const state = channel.presenceState();
          const allPresences = Object.values(state).flat() as any[];
          const playersMap = new Map<string, any>();

          allPresences.forEach((entry) => {
            if (entry.id && entry.id !== 'host_tv') {
              playersMap.set(entry.id, entry);
            }
          });

          const uniquePlayerList = Array.from(playersMap.values());
          roomBus.syncPresencePlayers(cleanCode, uniquePlayerList);
        } catch (err) {
          console.warn('[Presence Sync Error]:', err);
        }
      })
      .on('broadcast', { event: 'PLAYER_READY_UPDATE' }, ({ payload }) => {
        if (!payload || !payload.playerId) return;
        roomBus.emit('PLAYER_READY_UPDATE', cleanCode, payload);
        const r = roomBus.getRoom(cleanCode);
        if (r) {
          const p = r.players.find(
            (pl) => pl.id === payload.playerId || (payload.name && pl.name?.trim().toLowerCase() === payload.name?.trim().toLowerCase())
          );
          if (p) {
            p.isReady = Boolean(payload.isReady);
            if (r.flagState?.players[p.id]) r.flagState.players[p.id].isReady = p.isReady;
            if (r.landmarkState?.players[p.id]) r.landmarkState.players[p.id].isReady = p.isReady;
            if (r.trajectoryState?.players[p.id]) r.trajectoryState.players[p.id].isReady = p.isReady;
            if (r.tourismState?.players[p.id]) r.tourismState.players[p.id].isReady = p.isReady;
            roomBus.writeLocal(r);
          }
        }
      })
      .on('broadcast', { event: 'PLAYER_SUBMISSION' }, ({ payload }) => {
        if (!payload || !payload.playerId) return;
        roomBus.emit('PLAYER_SUBMISSION', cleanCode, payload);
      })
      .on('broadcast', { event: 'ROUND_STARTED' }, ({ payload }) => {
        roomBus.emit('ROUND_STARTED', cleanCode, payload);
      })
      .on('broadcast', { event: 'SCATTERGORIES_SUBMIT' }, ({ payload }) => {
        if (payload) roomBus.emit('SCATTERGORIES_SUBMIT', cleanCode, payload);
      })
      .on('broadcast', { event: 'SCATTERGORIES_GRACE' }, ({ payload }) => {
        if (payload) roomBus.emit('SCATTERGORIES_GRACE', cleanCode, payload);
      })
      .on('broadcast', { event: 'SCATTERGORIES_RESULTS' }, ({ payload }) => {
        if (payload) roomBus.emit('SCATTERGORIES_RESULTS', cleanCode, payload);
      })
      .on('broadcast', { event: 'WORDLE_GUESS' }, ({ payload }) => {
        if (payload) roomBus.emit('WORDLE_GUESS', cleanCode, payload);
      })
      .on('broadcast', { event: 'PLAYER_SOLVED_WORDLE' }, ({ payload }) => {
        if (payload) roomBus.emit('PLAYER_SOLVED_WORDLE', cleanCode, payload);
      })
      .on('broadcast', { event: 'WORDLE_GRACE' }, ({ payload }) => {
        if (payload) roomBus.emit('WORDLE_GRACE', cleanCode, payload);
      })
      .on('broadcast', { event: 'WORDLE_ROUND_ENDED' }, ({ payload }) => {
        if (payload) roomBus.emit('WORDLE_ROUND_ENDED', cleanCode, payload);
      })
      .on('broadcast', { event: 'CLAIM_WORD' }, ({ payload }) => {
        if (payload) roomBus.emit('CLAIM_WORD', cleanCode, payload);
      })
      .on('broadcast', { event: 'WORD_CLAIMED' }, ({ payload }) => {
        if (payload) roomBus.emit('WORD_CLAIMED', cleanCode, payload);
      })
      .on('broadcast', { event: 'WORD_CLAIM_REJECTED' }, ({ payload }) => {
        if (payload) roomBus.emit('WORD_CLAIM_REJECTED', cleanCode, payload);
      })
      .on('broadcast', { event: 'PENTAGON_ROUND_ENDED' }, ({ payload }) => {
        if (payload) roomBus.emit('PENTAGON_ROUND_ENDED', cleanCode, payload);
      })
      .on('broadcast', { event: 'LETTER_ROULETTE_STARTED' }, ({ payload }) => {
        if (payload) roomBus.emit('LETTER_ROULETTE_STARTED', cleanCode, payload);
      })
      .on('broadcast', { event: 'ADMIN_CLAIMED' }, ({ payload }) => {
        if (payload) roomBus.emit('ADMIN_CLAIMED', cleanCode, payload);
      })
      .on('broadcast', { event: 'ROUND_STOPPED_BY_PLAYER' }, ({ payload }) => {
        if (payload) roomBus.emit('ROUND_STOPPED_BY_PLAYER', cleanCode, payload);
      })
      .on('broadcast', { event: 'WORDLE_ROUND_WON' }, ({ payload }) => {
        if (payload) roomBus.emit('WORDLE_ROUND_WON', cleanCode, payload);
      })
      .on('broadcast', { event: 'WORDLE_ALL_LOST' }, ({ payload }) => {
        if (payload) roomBus.emit('WORDLE_ALL_LOST', cleanCode, payload);
      })
      .on('broadcast', { event: 'RETURN_TO_LOBBY' }, ({ payload }) => {
        roomBus.emit('RETURN_TO_LOBBY', cleanCode, payload);
      })
      .on('broadcast', { event: 'ADMIN_REQUEST_SUBMITTED' }, ({ payload }) => {
        if (payload) roomBus.emit('ADMIN_REQUEST_SUBMITTED', cleanCode, payload);
      })
      .on('broadcast', { event: 'ADMIN_REQUEST_RESOLVED' }, ({ payload }) => {
        if (payload) roomBus.emit('ADMIN_REQUEST_RESOLVED', cleanCode, payload);
      })
      .on('broadcast', { event: 'ADMIN_ADVANCE_NEXT_ROUND' }, ({ payload }) => {
        if (payload) roomBus.emit('ADMIN_ADVANCE_NEXT_ROUND', cleanCode, payload);
      })
      .on('broadcast', { event: 'SCATTERGORIES_ADMIN_VETO' }, ({ payload }) => {
        if (payload) roomBus.emit('SCATTERGORIES_ADMIN_VETO', cleanCode, payload);
      })
      .on('broadcast', { event: 'GAME_TERMINATED' }, () => {
        sessionStorage.removeItem('taq_session_player_id');
        localStorage.removeItem('taq_room_code');
        try {
          sessionStorage.removeItem(`taghesi_player_${cleanCode}`);
          localStorage.removeItem(`taghesi_player_${cleanCode}`);
        } catch {}
        alert('تم إنهاء اللعبة من قِبل المضيف.');
        navigate('/');
      })
      .on('broadcast', { event: 'ROOM_TERMINATED' }, () => {
        sessionStorage.removeItem('taq_session_player_id');
        localStorage.removeItem('taq_room_code');
        try {
          sessionStorage.removeItem(`taghesi_player_${cleanCode}`);
          localStorage.removeItem(`taghesi_player_${cleanCode}`);
        } catch {}
        alert('تم إنهاء اللعبة من قِبل المضيف.');
        navigate('/');
      })
      .on('broadcast', { event: 'PLAYER_KICKED' }, ({ payload }) => {
        if (payload?.playerId === playerId) {
          console.warn('[EJECTED] You have been kicked from the room by the host.');

          // 1. Unsubscribe from channel
          supabase.removeChannel(channel);

          // 2. Clear room session data
          sessionStorage.removeItem('taq_session_player_id');
          localStorage.removeItem('taq_room_code');

          // 3. Show ejection alert and redirect to home
          alert('تم استبعادك من الغرفة من قِبل المضيف.');
          navigate('/');
        }
      })
      .on('broadcast', { event: 'room_event' }, ({ payload }) => {
        if (payload?.type === 'STATE_UPDATED' && payload.data) {
          roomBus.writeLocal(payload.data);
          roomBus.dispatchLocal(payload);
        }
      })
      .subscribe(async (status) => {
        console.log(`[CHANNEL STATUS]: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log('[Mobile] Subscribed, requesting current room state...');
          await channel.track({
            id: playerId,
            name: playerName,
            isReady: false,
            joinedAt: Date.now(),
          });
          try {
            channel.send({
              type: 'broadcast',
              event: 'REQUEST_ROOM_STATE',
              payload: { playerId }
            });
            channel.send({
              type: 'broadcast',
              event: 'REQUEST_PHASE_SYNC',
              payload: { playerId }
            });
            channel.send({
              type: 'broadcast',
              event: 'room_event',
              payload: {
                roomCode: cleanCode,
                type: 'REQUEST_ROOM_STATE',
                data: {},
                timestamp: Date.now(),
              },
            });
          } catch (e) {
            console.warn('[Request room state warn]:', e);
          }
        }
      });

    setActiveChannel(channel);

    // Share active channel with roomBus to avoid duplicate channels
    roomBus.registerChannel(cleanCode, channel);

    const unsubKick = roomBus.on('PLAYER_KICKED', (evt) => {
      const kickedId = evt?.data?.playerId || evt?.data;
      if (kickedId === playerId) {
        console.warn('[EJECTED via roomBus] You have been kicked from the room by the host.');
        try {
          supabase.removeChannel(channel);
        } catch {}
        sessionStorage.removeItem('taq_session_player_id');
        localStorage.removeItem('taq_room_code');
        alert('تم استبعادك من الغرفة من قِبل المضيف.');
        navigate('/');
      }
    });

    const unsubTerminated = roomBus.on('GAME_TERMINATED', () => {
      sessionStorage.removeItem('taq_session_player_id');
      localStorage.removeItem('taq_room_code');
      try {
        sessionStorage.removeItem(`taghesi_player_${cleanCode}`);
        localStorage.removeItem(`taghesi_player_${cleanCode}`);
      } catch {}
      alert('تم إنهاء اللعبة من قِبل المضيف.');
      navigate('/');
    });

    return () => {
      isSubscribedRef.current = false;
      setActiveChannel(null);
      supabase.removeChannel(channel);
      unsubKick();
      unsubTerminated();
    };
  }, [roomCode, playerId, playerName, navigate]);

  const [loadingFailsafe, setLoadingFailsafe] = useState(false);

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

  // Prevent mounting/destroying ClassicBuzzerMobileView before room state is retrieved
  if (!room && !loadingFailsafe) {
    return (
      <div className="w-full h-[100dvh] flex items-center justify-center bg-[#E5E0D5] text-[#2C2A29] font-bold select-none">
        جاري الاتصال بالغرفة...
      </div>
    );
  }

  const path = window.location.pathname;

  if (activeRoom.selectedGameId === 'geo-flag-color' || path.includes('flags')) {
    return <FlagMobileView channel={activeChannel} roomCode={roomCode} playerId={playerId} playerName={playerName} />;
  }
  if (activeRoom.selectedGameId === 'geo-pin-landmark' || path.includes('geo-')) {
    return <GeoLandmarkMobileView channel={activeChannel} roomCode={roomCode} playerId={playerId} playerName={playerName} />;
  }
  if (activeRoom.selectedGameId === 'geo-trajectory' || path.includes('trajectory')) {
    return <TrajectoryMobileView channel={activeChannel} roomCode={roomCode} playerId={playerId} playerName={playerName} />;
  }
  if (activeRoom.selectedGameId === 'geo-blind-tourism' || path.includes('tourism')) {
    return <BlindTourismMobileView channel={activeChannel} roomCode={roomCode} playerId={playerId} playerName={playerName} />;
  }
  if (activeRoom.selectedGameId === 'scattergories' || path.includes('scattergories')) {
    return <ScattergoriesMobileView channel={activeChannel} roomCode={roomCode} playerId={playerId} playerName={playerName} />;
  }
  if (activeRoom.selectedGameId === 'wordle-rush' || path.includes('wordle-rush')) {
    return <WordleRushMobileView channel={activeChannel} roomCode={roomCode} playerId={playerId} playerName={playerName} />;
  }
  if (activeRoom.selectedGameId === 'pentagon-clash' || path.includes('pentagon-clash')) {
    return <PentagonClashMobileView channel={activeChannel} roomCode={roomCode} playerId={playerId} playerName={playerName} />;
  }
  if (
    activeRoom.selectedGameId === 'three-letter-word' ||
    activeRoom.selectedGameId === 'kalim-stack' ||
    path.includes('three-letter-word') ||
    path.includes('kalim-stack')
  ) {
    return <ThreeLetterWordMobileView />;
  }
  const isConspiracyMakerGame =
    activeRoom.selectedGameId === 'conspiracy-maker' ||
    path.includes('conspiracy-maker');

  if (isConspiracyMakerGame) {
    return <ConspiracyMobileView />;
  }

  const isTheScammerGame =
    activeRoom.selectedGameId === 'the-scammer' ||
    path.includes('the-scammer') ||
    Boolean((activeRoom as any)?.scammerState);

  if (isTheScammerGame) {
    return <TheScammerMobileView channel={activeChannel} roomCode={roomCode} playerId={playerId} playerName={playerName} onLeaveRoom={() => navigate('/')} />;
  }

  const isAiLawyerGame =
    activeRoom.selectedGameId === 'ai-lawyer' ||
    path.includes('ai-lawyer') ||
    Boolean((activeRoom as any)?.courtState);

  if (isAiLawyerGame) {
    return <AiLawyerMobileView channel={activeChannel} roomCode={roomCode} playerId={playerId} playerName={playerName} onLeaveRoom={() => navigate('/')} />;
  }

  const isWhoIsAiGame =
    activeRoom.selectedGameId === 'who-is-ai' ||
    activeRoom.selectedGameId === 'ai-room' ||
    path.includes('who-is-ai') ||
    path.includes('ai-room') ||
    path.includes('/ai/') ||
    Boolean((activeRoom as any)?.whoIsAiState) ||
    Boolean((activeRoom as any)?.aiRoomState);

  if (isWhoIsAiGame) {
    return <WhoIsAiMobileView channel={activeChannel} roomCode={roomCode} playerId={playerId} playerName={playerName} onLeaveRoom={() => navigate('/')} />;
  }

  if (
    activeRoom.selectedGameId === 'wala-kalima' ||
    path.includes('wala-kalima')
  ) {
    return <WalaKalimaMobileView />;
  }
  if (
    activeRoom.selectedGameId === 'forbidden-words' ||
    path.includes('forbidden-words')
  ) {
    return <ForbiddenWordsMobileView />;
  }
  if (
    activeRoom.selectedGameId === 'one-word' ||
    path.includes('one-word')
  ) {
    return <OneWordMobileView />;
  }
  if (
    activeRoom.selectedGameId === 'move-the-puppet' ||
    path.includes('move-the-puppet')
  ) {
    return <MoveThePuppetMobileView />;
  }
  if (
    activeRoom.selectedGameId === 'football-bingo' ||
    path.includes('football-bingo')
  ) {
    return <FootballBingoMobileView />;
  }
  if (
    activeRoom.selectedGameId === 'mutual-link' ||
    path.includes('mutual-link')
  ) {
    return <MutualLinkMobileView />;
  }
  if (
    activeRoom.selectedGameId === 'draft-5' ||
    path.includes('draft-5')
  ) {
    return <DraftMobileView />;
  }

  // Fallbacks based on active states if selectedGameId is not explicitly set
  if (activeRoom.flagState && !activeRoom.landmarkState && !activeRoom.trajectoryState && !activeRoom.tourismState) {
    return <FlagMobileView channel={activeChannel} roomCode={roomCode} playerId={playerId} playerName={playerName} />;
  }
  if (activeRoom.landmarkState && !activeRoom.trajectoryState && !activeRoom.tourismState) {
    return <GeoLandmarkMobileView channel={activeChannel} roomCode={roomCode} playerId={playerId} playerName={playerName} />;
  }
  if (activeRoom.trajectoryState && !activeRoom.tourismState) {
    return <TrajectoryMobileView channel={activeChannel} roomCode={roomCode} playerId={playerId} playerName={playerName} />;
  }
  if (activeRoom.tourismState) {
    return <BlindTourismMobileView channel={activeChannel} roomCode={roomCode} playerId={playerId} playerName={playerName} />;
  }

  return <ClassicBuzzerMobileView roomId={roomId} />;
};

const ClassicBuzzerMobileView: React.FC<{ roomId: string }> = ({ roomId }) => {
  const navigate = useNavigate();
  const { room, greenFlashPlayerId } = useRoom(roomId);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

  // Wizard state
  const [guestName, setGuestName] = useState('');
  const [joinStep, setJoinStep] = useState<1 | 2>(1);

  // Screen WakeLock
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch {
          // ignore
        }
      }
    };
    requestWakeLock();
    return () => {
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  // Restore player identity
  useEffect(() => {
    const saved = sessionStorage.getItem(`taghesi_player_${roomId}`);
    if (saved) {
      try {
        const p = JSON.parse(saved) as Player;
        setCurrentPlayer(p);
      } catch {
        // ignore
      }
    }
  }, [roomId]);

  // Keep player sync in room
  useEffect(() => {
    if (room && currentPlayer) {
      const match = room.players.find((p) => p.id === currentPlayer.id);
      if (match) {
        setCurrentPlayer(match);
      }
    }
  }, [room, currentPlayer]);

  const buzzerLock = room?.buzzerLock;
  const safeCountdown = useSafeCountdown(buzzerLock?.endsAt ?? null);
  const displaySeconds = buzzerLock?.endsAt ? safeCountdown : (buzzerLock?.countdownRemaining ?? 0);
  const isBuzzerUnlocked = buzzerLock?.status === 'unlocked';
  const isBuzzed = buzzerLock?.status === 'buzzed';
  const isWinnerOfBuzzer = isBuzzed && buzzerLock?.buzzedPlayerId === currentPlayer?.id;
  const isMyTeamReboundTurn = isBuzzed && !isWinnerOfBuzzer && buzzerLock?.buzzedTeam === currentPlayer?.team;
  const isOpponentBuzzed = isBuzzed && buzzerLock?.buzzedTeam !== currentPlayer?.team;

  // Haptic feedback
  useEffect(() => {
    if (isWinnerOfBuzzer && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  }, [isWinnerOfBuzzer]);

  // Step 1: Submit Name
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    sound.playClick();
    handleFinalJoin('team_a');
  };

  // Step 2: Join
  const handleFinalJoin = (team: TeamId) => {
    sound.playClick();
    const p = roomBus.joinPlayer(roomId, guestName.trim(), 'dallah', team);
    if (p) {
      sessionStorage.setItem(`taghesi_player_${roomId}`, JSON.stringify(p));
      roomBus.trackPlayerPresence(roomId, p);
      setCurrentPlayer(p);
    }
  };

  // Auto-balance Random Team
  const handleRandomTeamJoin = () => {
    const teamACount = room?.players.filter((p) => p.team === 'team_a').length || 0;
    const teamBCount = room?.players.filter((p) => p.team === 'team_b').length || 0;
    const targetTeam: TeamId = teamACount <= teamBCount ? 'team_a' : 'team_b';
    handleFinalJoin(targetTeam);
  };

  const handleBuzzerPress = () => {
    if (!currentPlayer || !isBuzzerUnlocked) return;
    roomBus.pressBuzzer(roomId, currentPlayer.id);
  };

  const handleClaimRebound = () => {
    if (!currentPlayer) return;
    sound.playClick();
    roomBus.claimReboundTurn(roomId, currentPlayer.id);
  };

  const handlePickNextCell = (cellId: string) => {
    if (!currentPlayer) return;
    sound.playClick();
    roomBus.pickNextCell(roomId, currentPlayer.id, cellId);
  };

  const handleLeave = () => {
    sound.playClick();
    if (currentPlayer) {
      roomBus.leavePlayer(roomId, currentPlayer.id);
    }
    navigate('/');
  };

  const isGreenFlashActive = greenFlashPlayerId === currentPlayer?.id;
  const isMyTurnToPickCell = room?.cellPickerPlayerId === currentPlayer?.id;
  const hasExistingHost = room?.hostConnected || !!room?.hostPlayerId;

  // ========================================================
  // Step 0: Not Joined yet -> Clean Wizard (Name -> Team)
  // ========================================================
  if (!currentPlayer) {
    return (
      <div className="min-h-screen bg-grain flex flex-col justify-between p-4 max-w-md mx-auto select-none">
        <header className="flex items-center justify-between border-b-2 border-ink-950 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-tactile bg-olive-500 border-2 border-ink-950 shadow-tactile-sm flex items-center justify-center text-sand-50 font-black text-xs">
              طق
            </span>
            <span className="text-lg font-black text-ink-950 font-display">طق عصي</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 bg-sand-200 border border-ink-950 rounded">
              غرفة: {roomId}
            </span>
          </div>
        </header>

        <main className="my-auto py-4">
          <div className="card-tactile p-6 bg-sand-50 flex flex-col gap-5">
            <form onSubmit={handleStep1Submit} className="flex flex-col gap-4">
              <div className="text-center">
                <span className="text-xs font-bold text-olive-800 bg-olive-100 px-3 py-0.5 rounded-full">
                  تسجيل الدخول
                </span>
                <h2 className="text-2xl font-black text-ink-950 font-display mt-1.5">
                  اكتب اسمك المستعار
                </h2>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-900 mb-1">اسمك في اللعبة:</label>
                <input
                  type="text"
                  autoFocus
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="مثال: فهد، نورة، أبو سعود..."
                  maxLength={16}
                  className="w-full text-base font-bold py-3.5 px-3 rounded-tactile border-2 border-ink-950 bg-sand-100 focus:outline-none focus:ring-2 focus:ring-olive-500 shadow-tactile-sm"
                />
              </div>

              <button type="submit" className="btn-tactile-primary py-3.5 text-base mt-2 font-display">
                انضم للعبة فوراً ◄
              </button>
            </form>
          </div>
        </main>

        <footer className="text-center text-xs text-ink-500 py-3">
          طق عصي — منصة ألعاب تفاعلية
        </footer>
      </div>
    );
  }

  const isTeamA = currentPlayer.team === 'team_a';

  // ========================================================
  // GREEN FLASH FULLSCREEN OVERLAY ON CORRECT ANSWER
  // ========================================================
  if (isGreenFlashActive) {
    return (
      <div className="min-h-screen bg-olive-500 flex flex-col items-center justify-center p-6 text-sand-50 animate-pulse select-none">
        <div className="w-24 h-24 rounded-full bg-sand-50 border-4 border-ink-950 flex items-center justify-center text-olive-700 shadow-tactile-xl my-4">
          <Check className="w-14 h-14 stroke-[3.5]" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-black font-display tracking-tight text-sand-50 text-center">
          صح عليك!
        </h1>
        <p className="text-base text-sand-100 font-bold mt-2 text-center">
          احتسبت الخلية لفريقك، وتأهلت لاختيار الحرف القادم!
        </p>
      </div>
    );
  }

  // ========================================================
  // Active Player Controller
  // ========================================================
  return (
    <div className="h-screen h-[100dvh] overflow-hidden bg-[#E5E0D5] bg-[radial-gradient(#C8C1B2_0.75px,transparent_0.75px)] [background-size:24px_24px] flex flex-col justify-between max-w-md mx-auto p-4 select-none">
      <MobileTopBar roomCode={roomId} playerName={currentPlayer.name} onLeaveRoom={handleLeave} />
      {/* Top Header */}
      <header className="card-tactile p-3 bg-sand-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="text-base font-black text-ink-950 truncate max-w-[160px]">
              {currentPlayer.name}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              <span
                className={`w-3.5 h-3.5 rounded-none inline-block shadow-sm ${
                  isTeamA ? 'bg-olive-600 border border-olive-900' : 'bg-ochre-500 border border-ochre-800'
                }`}
              ></span>
              <span className={isTeamA ? 'text-olive-900 font-black' : 'text-ochre-900 font-black'}>
                {isTeamA ? 'الفريق الأول' : 'الفريق الثاني'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-sand-200 border border-ink-950 rounded font-mono text-xs font-bold">
            {roomId}
          </span>
          <button
            onClick={handleLeave}
            title="مغادرة"
            className="px-2.5 py-1.5 rounded-xl bg-[#C68B59] hover:bg-[#2C2A29] text-white hover:text-[#E5E0D5] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] font-bold text-xs flex items-center gap-1 transition-all duration-150 ease-out hover:-translate-y-1 active:translate-y-0.5 active:shadow-[1px_1px_0px_#2C2A29] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="my-auto py-4 flex flex-col items-center justify-center gap-5 w-full">
        {/* ======================================================== */}
        {/* CASE A: Winner Picks Next Cell (Full 5x5 Hex Board)      */}
        {/* ======================================================== */}
        {isMyTurnToPickCell ? (
          <div className="w-full flex flex-col items-center gap-3">
            <div className="card-tactile p-5 bg-olive-50 border-3 border-olive-800 text-center w-full shadow-tactile-lg">
              <div className="inline-flex items-center gap-1 text-xs font-black text-olive-900 bg-olive-200 px-3 py-0.5 rounded-full mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>دورك لاختيار الحرف القادم!</span>
              </div>
              <h2 className="text-xl font-black text-ink-950 font-display">
                اختر الخلية القادمة للمجلس
              </h2>
              <p className="text-xs text-ink-600 mt-0.5">
                الخلايا المستحوذ عليها معطلة بالرمادي. انقر على أي حرف متاح لبدء التنافس حوله!
              </p>

              {/* Full 5x5 Board Grid for Selection: Claimed cells are dark-gray and disabled */}
              <div className="grid grid-cols-5 gap-2 mt-4 max-h-72 overflow-y-auto p-1.5">
                {room?.hexGrid.map((c) => {
                  const isOwned = c.owner !== 'none';
                  return (
                    <button
                      key={c.id}
                      disabled={isOwned}
                      onClick={() => !isOwned && handlePickNextCell(c.id)}
                      className={`p-1.5 min-h-[56px] rounded-tactile border-2 flex flex-col items-center justify-center transition-colors duration-150 ${
                        isOwned
                          ? 'bg-[#2A2825] text-stone-500 border-ink-950 opacity-40 cursor-not-allowed line-through'
                          : 'bg-sand-50 hover:bg-olive-100 text-ink-950 border-ink-950 shadow-tactile-sm cursor-pointer'
                      }`}
                    >
                      <span className="text-xs md:text-sm leading-tight text-center px-1 font-semibold max-w-full break-words line-clamp-2">
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : room?.status === 'lobby' ? (
          /* ======================================================== */
          /* CASE B: In Lobby Waiting                                 */
          /* ======================================================== */
          <div className="w-full flex flex-col items-center gap-4">
            <div className="card-tactile p-6 bg-sand-50 text-center w-full flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-sand-200 border-2 border-ink-950 flex items-center justify-center text-ink-700 shadow-tactile-sm">
                <Users className="w-6 h-6" />
              </div>

              <h2 className="text-xl font-black text-ink-950 font-display">
                أنت جاهز يا {currentPlayer.name}!
              </h2>

              <div
                className={`px-3 py-1 rounded-full border text-xs font-black ${
                  isTeamA
                    ? 'bg-olive-100 text-olive-900 border-olive-800'
                    : 'bg-ochre-100 text-ochre-900 border-ochre-800'
                }`}
              >
                انضممت إلى {isTeamA ? 'الفريق الأول' : 'الفريق الثاني'}
              </div>

              <p className="text-xs text-ink-600 max-w-xs leading-relaxed mt-1">
                بانتظار بدء اللعبة من المقدم.. راقب الشاشة الكبيرة في المجلس!
              </p>
            </div>
          </div>
        ) : isWinnerOfBuzzer ? (
          /* ======================================================== */
          /* CASE C: Winner of Buzzer (3s / 5s Countdown or Frozen)   */
          /* ======================================================== */
          <div className="w-full flex flex-col items-center gap-4">
            <div className="card-tactile p-6 bg-olive-100 border-olive-900 text-center w-full shadow-tactile-lg">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-olive-200 border border-olive-800 text-olive-900 text-xs font-black mb-2">
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>دورك للإجابة!</span>
              </div>

              {buzzerLock?.isFrozen ? (
                <>
                  <h2 className="text-2xl font-black text-ochre-950 font-display">
                    انتهى الوقت!
                  </h2>
                  <p className="text-xs text-ochre-800 mt-1 font-bold">
                    بانتظار تقييم المقدم في المجلس (✅ صح أو ❌ خطأ)
                  </p>
                  <div className="w-20 h-20 rounded-full border-4 border-ochre-900 bg-sand-50 flex items-center justify-center mx-auto my-3 shadow-tactile-sm">
                    <span className="text-4xl font-black font-mono text-ochre-950">0</span>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-black text-ink-950 font-display">
                    جاوب بصوتك! معك {displaySeconds} ثوانٍ
                  </h2>
                  <p className="text-xs text-ink-700 mt-1">
                    تكلّم بصوت عالٍ ليسمعك المقدم في المجلس ويحكم إجابتك.
                  </p>
                  <div className="w-24 h-24 rounded-full border-4 border-olive-900 bg-sand-50 flex items-center justify-center mx-auto my-3 shadow-tactile-sm">
                    <span className="text-5xl font-black font-mono text-olive-950">
                      {displaySeconds}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : buzzerLock?.lockedTeamId === currentPlayer?.team ? (
          /* ======================================================== */
          /* CASE D1: My Team Locked Out (Rebound to Opponent)        */
          /* ======================================================== */
          <div className="w-full flex flex-col items-center gap-4">
            <div className="card-tactile p-6 bg-sand-200 border-sand-400 text-center w-full opacity-90">
              <span className="text-xs font-black text-ochre-900 bg-ochre-100 px-3 py-1 rounded-full border border-ochre-800 mb-2 inline-block">
                تم قفل فريقكم (ارتداد)
              </span>

              <h2 className="text-xl font-black text-ink-800 font-display mt-1">
                الفرصة تحولت للفريق الآخر!
              </h2>

              <p className="text-xs text-ink-600 mt-1">
                إجابة غير صحيحة من فريقكم.. السؤال متاح الآن للفريق المنافس لمدة 5 ثوانٍ.
              </p>

              <div className="w-16 h-16 rounded-full border-2 border-sand-400 bg-sand-100 flex items-center justify-center mx-auto my-3 text-ink-600 font-mono font-bold text-2xl">
                {displaySeconds}s
              </div>
            </div>
          </div>
        ) : isMyTeamReboundTurn ? (
          /* ======================================================== */
          /* CASE D2: My Team Rebound Turn (5s countdown)              */
          /* ======================================================== */
          <div className="w-full flex flex-col items-center gap-4">
            <div className="card-tactile p-6 bg-olive-100 border-olive-900 text-center w-full shadow-tactile-lg">
              <span className="text-xs font-black text-olive-950 bg-olive-200 px-3 py-1 rounded-full border border-olive-800 uppercase tracking-widest mb-2 inline-block">
                دور فريقكم للإجابة! (ارتداد — 5 ثوانٍ)
              </span>

              {buzzerLock?.isFrozen ? (
                <>
                  <h2 className="text-2xl font-black text-ochre-950 font-display">
                    انتهى الوقت!
                  </h2>
                  <p className="text-xs text-ochre-800 mt-1 font-bold">
                    بانتظار تقييم المقدم في المجلس (✅ صح أو ❌ خطأ)
                  </p>
                  <div className="w-20 h-20 rounded-full border-4 border-ochre-900 bg-sand-50 flex items-center justify-center mx-auto my-3 shadow-tactile-sm">
                    <span className="text-4xl font-black font-mono text-ochre-950">0</span>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-black text-ink-950 font-display mt-1">
                    جاوبوا بصوتكم! ({displaySeconds} ثوانٍ)
                  </h2>
                  <p className="text-xs text-ink-700 mt-1 font-semibold">
                    تكلّم بصوت عالٍ ليسمعك المقدم، أو اضغط لتثبيت اسمك
                  </p>

                  <div className="w-20 h-20 rounded-full border-4 border-olive-900 bg-sand-50 flex items-center justify-center mx-auto my-3 shadow-tactile-sm">
                    <span className="text-4xl font-black font-mono text-olive-950">
                      {displaySeconds}
                    </span>
                  </div>

                  <button
                    onClick={handleClaimRebound}
                    className="w-full py-3 bg-olive-600 hover:bg-olive-700 text-sand-50 font-black rounded-tactile border-2 border-ink-950 shadow-tactile-sm text-sm transition-colors cursor-pointer"
                  >
                    أنا المتحدث للإجابة!
                  </button>
                </>
              )}
            </div>
          </div>
        ) : isOpponentBuzzed ? (
          /* ======================================================== */
          /* CASE E: Opponent Team Turn                               */
          /* ======================================================== */
          <div className="w-full flex flex-col items-center gap-4">
            <div className="card-tactile p-6 bg-sand-200 border-sand-400 text-center w-full opacity-90">
              <span className="text-xs font-bold text-ink-500 uppercase tracking-widest mb-1 block">
                تم قفل الجرس (المحاولة {buzzerLock?.attemptNumber || 1})
              </span>

              <h2 className="text-xl font-black text-ink-800 font-display">
                {buzzerLock?.buzzedPlayerName}
              </h2>

              <p className="text-xs text-ink-600 mt-1">
                {buzzerLock?.isFrozen
                  ? 'انتهى الوقت! بانتظار قرار المقدم للتحويل أو القبول..'
                  : 'استمع لجواب الفريق المنافس.. إذا أخطأوا ستتاح لفريقك فرصة الإجابة بـ 5 ثوانٍ فوراً!'}
              </p>

              <div className="w-16 h-16 rounded-full border-2 border-sand-400 bg-sand-100 flex items-center justify-center mx-auto my-3 text-ink-600 font-mono font-bold text-2xl">
                {displaySeconds}s
              </div>
            </div>
          </div>
        ) : isBuzzerUnlocked ? (
          /* ======================================================== */
          /* CASE F: Buzzer is Unlocked (Huge Thumb Button)           */
          /* ======================================================== */
          <div className="w-full flex flex-col items-center gap-4">
            <div className="text-center flex flex-col items-center gap-1">
              {buzzerLock?.attemptPhase === 'REBOUND_TEAM_B' ? (
                <span className="text-xs font-black text-ochre-950 bg-ochre-100 px-3 py-1 rounded-full border border-ochre-800 shadow-sm">
                  فرصة ارتداد لفريقكم! (5 ثوانٍ)
                </span>
              ) : (
                room?.activeQuestion?.letter && (
                  <span className="text-sm font-black text-olive-950 bg-olive-100 px-3 py-1 rounded-full border border-olive-800 shadow-sm">
                    الخلية المتنافس عليها: {room.activeQuestion.letter}
                  </span>
                )
              )}
              <span className="text-xs font-black text-olive-800">
                {buzzerLock?.attemptPhase === 'REBOUND_TEAM_B'
                  ? 'اكبس الجرس فوراً للارتداد!'
                  : 'السؤال جاهز — اكبس الجرس الآن!'}
              </span>
            </div>

            <button
              onClick={handleBuzzerPress}
              className={`w-64 h-64 rounded-full border-4 border-ink-950 flex flex-col items-center justify-center gap-2 select-none shadow-tactile-xl cursor-pointer transition-colors ${
                isTeamA
                  ? 'bg-olive-500 hover:bg-olive-600 text-sand-50'
                  : 'bg-ochre-500 hover:bg-ochre-600 text-sand-50'
              }`}
            >
              <Zap className="w-20 h-20 fill-current" strokeWidth={2} />
              <span className="text-2xl font-black font-display tracking-tight">
                {buzzerLock?.attemptPhase === 'REBOUND_TEAM_B' ? 'اضغط للارتداد!' : 'اضغط الجرس!'}
              </span>
              <span className="text-[11px] font-bold bg-ink-950/20 px-3 py-0.5 rounded-full">
                {buzzerLock?.attemptPhase === 'REBOUND_TEAM_B'
                  ? `${displaySeconds || 5}s للإجابة`
                  : 'أسرع واحد يجاوب (3 ثوانٍ)'}
              </span>
            </button>
          </div>
        ) : (
          /* ======================================================== */
          /* CASE G: Idle / Reading Question                          */
          /* ======================================================== */
          <div className="w-full flex flex-col items-center gap-4">
            <div className="card-tactile p-6 bg-sand-50 text-center w-full flex flex-col items-center gap-3">
              {room?.activeCellId ? (
                <>
                  <span className="text-xs font-bold text-olive-800 bg-olive-100 px-3 py-0.5 rounded-full border border-olive-800/20">
                    الخلية المختارة: {room.activeQuestion?.letter}
                  </span>
                  <h2 className="text-xl font-black text-ink-950 font-display">
                    المقدم يقرأ السؤال..
                  </h2>
                  <p className="text-xs text-ink-600 max-w-xs leading-relaxed">
                    سيفتح الجرس فور انتهاء المقدم من القراءة، خلك جاهز للكبس السريع!
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-black text-ink-950 font-display">
                    بانتظار اختيار الخلية..
                  </h2>
                  <p className="text-xs text-ink-600 max-w-xs leading-relaxed">
                    تابع الشاشة الكبيرة في المجلس لمعرفة الحرف المختار.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="card-tactile p-2.5 bg-sand-50 text-center text-xs text-ink-600 font-bold flex items-center justify-between">
        <span>كود الغرفة: <span className="font-mono text-ink-950">{roomId}</span></span>
        <span className="text-[11px] text-olive-800 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>منع قفل الشاشة مفعل</span>
        </span>
      </footer>

      {/* Demo Switcher */}
      <DemoSwitcher roomId={roomId} currentRole="player" />
    </div>
  );
};

