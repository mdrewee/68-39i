import React, { useState, useEffect, useRef, useCallback, FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  DraftPhase,
  DraftPosition,
  DraftEventPayload,
  DRAFT_POSITION_NAMES,
  DRAFT_POSITION_SHORT_NAMES,
  DRAFT_SLOTS_ORDER,
} from './types';
import { DraftCondition } from '../../../data/draftConditions';
import { FootballPlayer } from '../../../data/footballMasterData';
import { searchFootballPlayers } from '../../../utils/footballSearch';
import { SecretPitchDrawer } from './components/SecretPitchDrawer';
import { sound } from '../../../lib/audio';
import { CheckCircle2, Clock, Shield, User, Trophy, Pin } from 'lucide-react';

export const DraftMobileView: FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // Player Profile
  const [playerId] = useState<string>(() => {
    return sessionStorage.getItem('draft_player_id') || `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  });
  const [playerName, setPlayerName] = useState<string>(() => {
    return sessionStorage.getItem('draft_player_name') || '';
  });
  const [hasJoined, setHasJoined] = useState<boolean>(() => {
    return !!sessionStorage.getItem('draft_player_name');
  });
  const [isReady, setIsReady] = useState<boolean>(false);

  // Game Realtime State
  const [phase, setPhase] = useState<DraftPhase>('LOBBY');
  const [round, setRound] = useState<number>(1);
  const [activeCondition, setActiveCondition] = useState<DraftCondition | null>(null);
  const [currentPickerId, setCurrentPickerId] = useState<string>('');
  const [currentPickerName, setCurrentPickerName] = useState<string>('');
  const [draftedPlayerIds, setDraftedPlayerIds] = useState<string[]>([]);

  // Local secret squad picks & conditions per slot
  const [myPicks, setMyPicks] = useState<Record<DraftPosition, FootballPlayer | null>>({
    GK: null,
    DEF_1: null,
    DEF_2: null,
    MID: null,
    FWD: null,
  });

  const [myConditions, setMyConditions] = useState<Record<DraftPosition, DraftCondition | null>>({
    GK: null,
    DEF_1: null,
    DEF_2: null,
    MID: null,
    FWD: null,
  });

  // Selected Target Slot on Personal Board (Default: first vacant slot)
  const [targetSlot, setTargetSlot] = useState<DraftPosition | null>(null);

  // Turn Timer
  const [turnTimerSec, setTurnTimerSec] = useState<number>(30);

  // Search & Selection State
  const [query, setQuery] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<FootballPlayer | null>(null);

  // References
  const channelRef = useRef<RealtimeChannel | null>(null);
  const playerIdRef = useRef<string>(playerId);
  const playerNameRef = useRef<string>(playerName);
  const hasJoinedRef = useRef<boolean>(hasJoined);
  const myPicksRef = useRef<Record<DraftPosition, FootballPlayer | null>>(myPicks);

  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);
  useEffect(() => { hasJoinedRef.current = hasJoined; }, [hasJoined]);
  useEffect(() => { myPicksRef.current = myPicks; }, [myPicks]);

  const isMyTurn = currentPickerId === playerId;

  // Compute remaining vacant slots on contestant's board
  const emptySlots = React.useMemo(() => {
    return DRAFT_SLOTS_ORDER.filter((pos) => !myPicks[pos]);
  }, [myPicks]);

  // Keep targetSlot pointing to a valid empty slot
  useEffect(() => {
    if (!targetSlot || myPicks[targetSlot]) {
      setTargetSlot(emptySlots[0] || null);
    }
  }, [emptySlots, myPicks, targetSlot]);

  // Realtime Broadcast helper
  const broadcastEvent = useCallback((payload: DraftEventPayload) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'draft_event',
      payload,
    });
  }, []);

  // Filter players with strict Anti-Steal Mechanism
  const searchResults = React.useMemo(() => {
    if (!query.trim()) return [];
    const raw = searchFootballPlayers(query, 12);
    // Exclude globally drafted players
    return raw.filter((p) => !draftedPlayerIds.includes(p.id));
  }, [query, draftedPlayerIds]);

  // Turn Countdown Loop
  useEffect(() => {
    if (phase !== 'DRAFTING') return;
    const interval = setInterval(() => {
      setTurnTimerSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, currentPickerId]);

  // Handle Turn Change Sound
  useEffect(() => {
    if (isMyTurn && phase === 'DRAFTING') {
      sound.playWhistle();
    }
  }, [isMyTurn, phase]);

  // Join Room
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = playerName.trim();
    if (!cleanName) return;

    sound.playClick();
    sessionStorage.setItem('draft_player_id', playerId);
    sessionStorage.setItem('draft_player_name', cleanName);
    sessionStorage.setItem('draft_room', roomCode);
    setHasJoined(true);

    if (channelRef.current) {
      channelRef.current.track({
        id: playerId,
        name: cleanName,
        joinedAt: Date.now(),
        isReady: false,
      });
    }
  };

  // Lock In Pick into Selected Slot (either from autocomplete or custom pinned name)
  const handleConfirmPick = useCallback((playerToLock?: FootballPlayer) => {
    const target = playerToLock || selectedPlayer;
    if (!target || !targetSlot || !isMyTurn || phase !== 'DRAFTING') return;

    sound.playClick();

    // 1. Update local secret squad & record condition attached to this slot
    setMyPicks((prev) => ({
      ...prev,
      [targetSlot]: target,
    }));

    setMyConditions((prev) => ({
      ...prev,
      [targetSlot]: activeCondition,
    }));

    setSelectedPlayer(null);
    setQuery('');

    // 2. Broadcast pick to TV with the chosen slot
    broadcastEvent({
      action: 'PICK_LOCKED',
      playerId,
      playerName,
      pickedPosition: targetSlot,
      pickedPlayer: target,
      appliedCondition: activeCondition || undefined,
    });
  }, [selectedPlayer, targetSlot, isMyTurn, phase, activeCondition, playerId, playerName, broadcastEvent]);

  // Custom Pinning Handler (If typed name has no matches or player prefers custom pinning)
  const handlePinCustomPlayer = () => {
    const cleanTyped = query.trim();
    if (!cleanTyped || !targetSlot || !isMyTurn || phase !== 'DRAFTING') return;

    const customPlayer: FootballPlayer = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanTyped,
      aliases: [cleanTyped],
      nationality: 'غير محدد',
      nationalityCode: 'UN',
      clubs: [],
      currentClub: 'مخصص',
      position: (targetSlot === 'GK' ? 'GK' : targetSlot === 'MID' ? 'MID' : targetSlot === 'FWD' ? 'FWD' : 'DEF'),
      traits: [],
      trophies: [],
    };

    handleConfirmPick(customPlayer);
  };

  // Supabase Channel
  useEffect(() => {
    if (!roomCode) return;

    const channelId = `draft5:${roomCode}`;

    const channel = supabase.channel(channelId, {
      config: {
        broadcast: { self: true },
        presence: { key: playerId },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {})
      .on('broadcast', { event: 'draft_event' }, ({ payload }) => {
        if (!payload) return;
        const ev = payload as DraftEventPayload;

        if (ev.action === 'GAME_START' || ev.action === 'ROUND_ADVANCE') {
          setPhase('DRAFTING');
          setRound(ev.round || 1);
          setActiveCondition(ev.activeCondition || null);
          setCurrentPickerId(ev.currentPickerId || '');
          setCurrentPickerName(ev.currentPickerName || '');
          setTurnTimerSec(30);
          setQuery('');
          setSelectedPlayer(null);
          if (ev.draftedPlayerIds) setDraftedPlayerIds(ev.draftedPlayerIds);
        } else if (ev.action === 'PICK_LOCKED') {
          if (ev.draftedPlayerIds) setDraftedPlayerIds(ev.draftedPlayerIds);
          if (ev.currentPickerId) {
            setCurrentPickerId(ev.currentPickerId);
            setCurrentPickerName(ev.currentPickerName || '');
            setTurnTimerSec(30);
          }
        } else if (ev.action === 'AI_EVALUATION_START') {
          setPhase('AI_REVEAL');
        } else if (ev.action === 'RESET_LOBBY') {
          setPhase('LOBBY');
          setRound(1);
          setIsReady(false);
          setMyPicks({ GK: null, DEF_1: null, DEF_2: null, MID: null, FWD: null });
          setMyConditions({ GK: null, DEF_1: null, DEF_2: null, MID: null, FWD: null });
        } else if (ev.action === 'KICK_PLAYER') {
          if (ev.targetPlayerId === playerIdRef.current) {
            sessionStorage.removeItem('draft_player_id');
            sessionStorage.removeItem('draft_player_name');
            sessionStorage.removeItem('draft_room');
            if (channelRef.current) {
              channelRef.current.untrack();
              supabase.removeChannel(channelRef.current);
            }
            alert('تم استبعادك من الغرفة بواسطة المضيف');
            navigate('/', { replace: true });
          }
        } else if (ev.action === 'ROOM_TERMINATED') {
          sessionStorage.removeItem('draft_player_id');
          sessionStorage.removeItem('draft_room');
          navigate('/');
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && hasJoinedRef.current) {
          channel.track({
            id: playerIdRef.current,
            name: playerNameRef.current,
            joinedAt: Date.now(),
            isReady: false,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, playerId, navigate]);

  // Join Screen
  if (!hasJoined) {
    return (
      <div
        className="min-h-screen w-full bg-[#E5E0D5] text-[#2C2A29] flex flex-col justify-center items-center p-4 font-sans select-none"
        dir="rtl"
      >
        <div className="w-full max-w-sm bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-black text-[#2C2A29]">كوّن فريقك 5</h1>
            <p className="text-xs font-bold text-[#5C4033]">
              غرفة: <span className="font-mono font-black">{roomCode}</span>
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="text-xs font-black text-[#5C4033] block mb-1">
                اسم المتسابق
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="اكتب اسمك للمنافسة..."
                className="w-full bg-white border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl px-4 py-3 font-black text-sm text-[#2C2A29] focus:outline-none"
                maxLength={20}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#8A9A5B] hover:bg-[#78884E] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none py-3.5 rounded-xl font-black text-base flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <span>دخول الغرفة</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full bg-[#E5E0D5] text-[#2C2A29] flex flex-col font-sans select-none"
      dir="rtl"
    >
      {/* Mobile Top Bar */}
      <header className="w-full bg-[#E5E0D5] border-b-2 border-[#2C2A29] px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#8A9A5B] border border-[#2C2A29] flex items-center justify-center text-white font-black text-xs">
            5
          </div>
          <div>
            <h2 className="font-black text-sm text-[#2C2A29] leading-tight">
              كوّن فريقك الخماسي
            </h2>
            <span className="text-[10px] font-bold text-[#5C4033] block">
              {playerName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {phase === 'DRAFTING' && (
            <span className="bg-[#F7F4EC] border border-[#2C2A29] px-2.5 py-1 rounded-lg text-xs font-black text-[#2C2A29]">
              جولة {round}/5
            </span>
          )}
          <span className="font-mono text-xs font-black text-[#5C4033] bg-[#F7F4EC] px-2 py-1 rounded-lg border border-[#2C2A29]">
            {roomCode}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full space-y-4">
        {/* =======================================================
            STATE: LOBBY
            ======================================================= */}
        {phase === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-6 animate-fade-in">
            <div className="w-16 h-16 bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl flex items-center justify-center text-white">
              <Shield size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-[#2C2A29]">أهلاً بك {playerName}!</h3>
              <p className="text-xs font-bold text-[#5C4033]">
                أنت في غرفة الانتظار، اضغط زر الاستعداد وانتظر بدء الجولة الأولى من شاشة العرض.
              </p>
            </div>

            {/* Primary Olivine Green Ready Button */}
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                const nextReady = !isReady;
                setIsReady(nextReady);
                broadcastEvent({
                  action: 'PLAYER_READY',
                  playerId: playerIdRef.current,
                  playerName: playerNameRef.current,
                  isReady: nextReady,
                });
              }}
              className={`w-full max-w-xs py-4 px-6 rounded-2xl font-black text-lg border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2 ${
                isReady
                  ? 'bg-[#8A9A5B] text-[#F7F4EC]'
                  : 'bg-[#F7F4EC] text-[#2C2A29] hover:bg-white'
              }`}
            >
              <CheckCircle2 size={22} className={isReady ? 'text-[#F7F4EC]' : 'text-[#8A9A5B]'} />
              <span>{isReady ? 'أنا جاهز ✓' : 'أنا جاهز'}</span>
            </button>
          </div>
        )}

        {/* =======================================================
            STATE: DRAFTING
            ======================================================= */}
        {phase === 'DRAFTING' && (
          <div className="flex-1 flex flex-col space-y-3.5">
            {/* 1. Turn Status Banner */}
            {isMyTurn ? (
              <div className="bg-[#8A9A5B] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black leading-tight">دورك الآن للاختيار! ⚡</h3>
                  <span className="text-xs font-bold opacity-90 block">
                    اختر لاعباً وحدد المركز الذي تريده على تشكيلتك
                  </span>
                </div>
                <div className="flex items-center gap-1 font-mono font-black text-lg bg-[#2C2A29] text-[#F7F4EC] px-3 py-1 rounded-xl shrink-0">
                  <Clock size={16} />
                  <span>{turnTimerSec}ث</span>
                </div>
              </div>
            ) : (
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#5C4033] block">الدور الحالي:</span>
                  <h3 className="text-sm font-black text-[#2C2A29]">
                    دور <span className="text-[#C68B59]">{currentPickerName}</span> حالياً للتجنيد...
                  </h3>
                  <span className="text-[11px] font-bold text-[#8A9A5B] mt-0.5 block">
                    جهز خيارك في المركز الذي تفضله!
                  </span>
                </div>
                <div className="flex items-center gap-1 font-mono font-black text-sm bg-[#E5E0D5] text-[#2C2A29] px-2.5 py-1 rounded-xl border border-[#2C2A29] shrink-0">
                  <Clock size={14} />
                  <span>{turnTimerSec}ث</span>
                </div>
              </div>
            )}

            {/* 2. Visual Squad Board Pitch Grid (Always Visible) */}
            <SecretPitchDrawer
              picks={myPicks}
              selectedPosition={targetSlot}
              onSelectSlot={(pos) => setTargetSlot(pos)}
              interactive={isMyTurn}
            />

            {/* 3. Active Round Condition Box */}
            {activeCondition && (
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl p-3">
                <span className="text-[10px] font-black uppercase text-[#8A9A5B] block">
                  شرط الجولة الإلزامي:
                </span>
                <h4 className="text-base font-black text-[#2C2A29] mt-0.5">
                  {activeCondition.title}
                </h4>
                <p className="text-xs font-bold text-[#5C4033] mt-0.5">
                  {activeCondition.rulePrompt}
                </p>
              </div>
            )}

            {/* 4. Search and Selection Arena (If My Turn) */}
            {isMyTurn ? (
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl p-4 space-y-3">
                {/* Slot Selector: Radio Pills of Vacant Slots */}
                <div>
                  <span className="text-xs font-black text-[#5C4033] block mb-1.5">
                    اختر المركز المراد وضعه فيه:
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {DRAFT_SLOTS_ORDER.map((slotPos) => {
                      const isOccupied = Boolean(myPicks[slotPos]);
                      const isTarget = targetSlot === slotPos;
                      const label = DRAFT_POSITION_SHORT_NAMES[slotPos];

                      return (
                        <button
                          key={slotPos}
                          type="button"
                          disabled={isOccupied}
                          onClick={() => setTargetSlot(slotPos)}
                          className={`py-1.5 px-1 rounded-xl text-xs font-black border-2 transition-all cursor-pointer ${
                            isOccupied
                              ? 'bg-[#D5CFC5] border-[#2C2A29] text-[#8C827A] opacity-50 cursor-not-allowed'
                              : isTarget
                              ? 'bg-[#8A9A5B] border-[#2C2A29] text-white shadow-[2px_2px_0px_#2C2A29]'
                              : 'bg-white border-[#2C2A29] text-[#2C2A29] hover:bg-[#E5E0D5]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Input Search Field (Clean Name-Only Autocomplete) */}
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelectedPlayer(null);
                    }}
                    placeholder="ابحث بالاسم: مثلاً ميسي، مالديني، كانتي..."
                    className="w-full bg-white border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl px-4 py-3 font-black text-sm text-[#2C2A29] focus:outline-none"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setSelectedPlayer(null);
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#5C4033]"
                    >
                      مسح
                    </button>
                  )}
                </div>

                {/* Name-Only Autocomplete Suggestions List */}
                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1 p-1 bg-white rounded-xl border-2 border-[#2C2A29]">
                    {searchResults.map((player) => {
                      const isSelected = selectedPlayer?.id === player.id;
                      return (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => {
                            setSelectedPlayer(player);
                            setQuery(player.name);
                          }}
                          className={`w-full text-right p-2.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-[#8A9A5B] text-[#F7F4EC] border-[#2C2A29] shadow-[1px_1px_0px_#2C2A29]'
                              : 'bg-[#F7F4EC] hover:bg-[#E5E0D5] text-[#2C2A29] border-[#2C2A29]'
                          }`}
                        >
                          {/* STRICTLY NAME ONLY */}
                          <span className="font-bold text-base leading-tight">
                            {player.name}
                          </span>
                          {isSelected && <CheckCircle2 size={16} className="text-white shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Custom Pinning Button (تثبيت اللاعب إذا لم يظهر) */}
                {query.trim().length > 1 && (
                  <button
                    type="button"
                    onClick={handlePinCustomPlayer}
                    className="bg-[#8A9A5B] hover:bg-[#78884E] text-white p-3 rounded-xl font-black w-full border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Pin size={16} />
                    <span>تثبيت اللاعب: "{query.trim()}"</span>
                  </button>
                )}

                {/* Selected Player preview & Lock In button */}
                {selectedPlayer && targetSlot && (
                  <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#2C2A29]">
                        اللاعب: {selectedPlayer.name}
                      </span>
                      <span className="text-[10px] font-black bg-[#C68B59] text-white px-2 py-0.5 rounded-lg">
                        المركز: {DRAFT_POSITION_NAMES[targetSlot]}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleConfirmPick()}
                      className="w-full bg-[#8A9A5B] hover:bg-[#78884E] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <CheckCircle2 size={16} />
                      <span>تثبيت في التشكيلة 🔒</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl p-6 text-center space-y-2">
                <span className="text-2xl">⏳</span>
                <h4 className="text-sm font-black text-[#2C2A29]">انتظر دورك للتجنيد</h4>
                <p className="text-xs font-bold text-[#5C4033]">
                  استغل الوقت في دراسة شرط الجولة وتحديد المركز الذي ترغب في ملئه بتشكيلتك!
                </p>
              </div>
            )}
          </div>
        )}

        {/* =======================================================
            STATE: AI REVEAL & MATCH OVER
            ======================================================= */}
        {phase === 'AI_REVEAL' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8">
            <div className="w-16 h-16 bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl flex items-center justify-center text-3xl text-white">
              <Trophy size={32} />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-[#2C2A29]">اكتمل الدرافت بالكامل!</h2>
              <p className="text-xs font-bold text-[#5C4033]">
                تابع شاشة العرض الرئيسية الآن لمشاهدة فحص الشروط وإعلان بطل التحدي! ⚡
              </p>
            </div>
            <SecretPitchDrawer picks={myPicks} />
          </div>
        )}
      </main>
    </div>
  );
};
