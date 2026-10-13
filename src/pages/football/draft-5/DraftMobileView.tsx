import React, { useState, useEffect, useRef, useCallback, FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  DraftPhase,
  DraftPosition,
  DraftEventPayload,
  DRAFT_POSITION_NAMES,
} from './types';
import { DraftCondition } from '../../../data/draftConditions';
import { DRAFT_CURATED_CLUBS, DraftClub } from '../../../data/draftClubs';
import { FootballPlayer } from '../../../data/footballMasterData';
import { searchFootballPlayers } from '../../../utils/footballSearch';
import { DraftTacticalPitch } from './components/DraftTacticalPitch';
import { DraftClubPickerModal } from './components/DraftClubPickerModal';
import { sound } from '../../../lib/audio';
import { CheckCircle2, Shield, User, Trophy, Pin, RefreshCw } from 'lucide-react';

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
  const [selectedClub, setSelectedClub] = useState<DraftClub | null>(() => {
    const cached = sessionStorage.getItem('draft_player_club');
    if (cached) {
      try { return JSON.parse(cached); } catch { return null; }
    }
    return DRAFT_CURATED_CLUBS[0]; // Default: Al-Hilal
  });

  const [hasJoined, setHasJoined] = useState<boolean>(() => {
    return !!sessionStorage.getItem('draft_player_name');
  });
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isClubModalOpen, setIsClubModalOpen] = useState<boolean>(false);

  // Game Realtime State (5 Rounds Cycle)
  const [phase, setPhase] = useState<DraftPhase>('LOBBY');
  const [round, setRound] = useState<number>(1);
  const [activeCondition, setActiveCondition] = useState<DraftCondition | null>(null);
  const [currentPickerId, setCurrentPickerId] = useState<string>('');
  const [currentPickerName, setCurrentPickerName] = useState<string>('');
  const [draftedPlayerIds, setDraftedPlayerIds] = useState<string[]>([]);
  const [readyForNextRound, setReadyForNextRound] = useState<boolean>(false);

  // Local secret squad picks & conditions per slot
  const [myPicks, setMyPicks] = useState<Record<DraftPosition, FootballPlayer | null>>({
    FWD: null,
    MID: null,
    DEF_1: null,
    DEF_2: null,
    GK: null,
  });

  // Selected Target Slot on Personal Tactical Pitch (Gate for Search Bar)
  const [selectedSlotKey, setSelectedSlotKey] = useState<DraftPosition | null>(null);

  // Search & Selection State
  const [query, setQuery] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<FootballPlayer | null>(null);

  // References
  const channelRef = useRef<RealtimeChannel | null>(null);
  const playerIdRef = useRef<string>(playerId);
  const playerNameRef = useRef<string>(playerName);
  const selectedClubRef = useRef<DraftClub | null>(selectedClub);
  const hasJoinedRef = useRef<boolean>(hasJoined);
  const myPicksRef = useRef<Record<DraftPosition, FootballPlayer | null>>(myPicks);

  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);
  useEffect(() => { selectedClubRef.current = selectedClub; }, [selectedClub]);
  useEffect(() => { hasJoinedRef.current = hasJoined; }, [hasJoined]);
  useEffect(() => { myPicksRef.current = myPicks; }, [myPicks]);

  const isMyTurn = currentPickerId === playerId;

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
    if (!cleanName || !selectedClub) return;

    sound.playClick();
    sessionStorage.setItem('draft_player_id', playerId);
    sessionStorage.setItem('draft_player_name', cleanName);
    sessionStorage.setItem('draft_player_club', JSON.stringify(selectedClub));
    sessionStorage.setItem('draft_room', roomCode);
    setHasJoined(true);

    if (channelRef.current) {
      channelRef.current.track({
        id: playerId,
        name: cleanName,
        selectedClub,
        joinedAt: Date.now(),
        isReady: false,
      });
    }
  };

  // Lock In Pick into Selected Slot (either from autocomplete or custom pinned name)
  const handleConfirmPick = useCallback((playerToLock?: FootballPlayer) => {
    const target = playerToLock || selectedPlayer;
    if (!target || !selectedSlotKey || !isMyTurn || phase !== 'DRAFTING') return;

    sound.playClick();

    // 1. Update local tactical pitch
    setMyPicks((prev) => ({
      ...prev,
      [selectedSlotKey]: target,
    }));

    const slotAssigned = selectedSlotKey;
    setSelectedPlayer(null);
    setSelectedSlotKey(null); // Reset active slot gate
    setQuery('');

    // 2. Broadcast pick to TV with the chosen slot
    broadcastEvent({
      action: 'PICK_LOCKED',
      playerId,
      playerName,
      pickedPosition: slotAssigned,
      pickedPlayer: target,
      appliedCondition: activeCondition || undefined,
    });
  }, [selectedPlayer, selectedSlotKey, isMyTurn, phase, activeCondition, playerId, playerName, broadcastEvent]);

  // Custom Pinning Handler (If typed name has no matches or player prefers custom pinning)
  const handlePinCustomPlayer = () => {
    const cleanTyped = query.trim();
    if (!cleanTyped || !selectedSlotKey || !isMyTurn || phase !== 'DRAFTING') return;

    const customPlayer: FootballPlayer = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanTyped,
      aliases: [cleanTyped],
      nationality: 'غير محدد',
      nationalityCode: 'UN',
      clubs: [],
      currentClub: 'مخصص',
      position: (selectedSlotKey === 'GK' ? 'GK' : selectedSlotKey === 'MID' ? 'MID' : selectedSlotKey === 'FWD' ? 'FWD' : 'DEF'),
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

        if (ev.action === 'GAME_START') {
          setPhase('DRAFTING');
          setRound(ev.round || 1);
          setActiveCondition(ev.activeCondition || null);
          setCurrentPickerId(ev.currentPickerId || '');
          setCurrentPickerName(ev.currentPickerName || '');
          setSelectedSlotKey(null);
          setQuery('');
          setSelectedPlayer(null);
          setReadyForNextRound(false);
          setMyPicks({ FWD: null, MID: null, DEF_1: null, DEF_2: null, GK: null });
          if (ev.draftedPlayerIds) setDraftedPlayerIds(ev.draftedPlayerIds);
        } else if (ev.action === 'START_NEXT_ROUND') {
          // Advance to Round N+1 with fresh board and new conditions
          setPhase('DRAFTING');
          setRound(ev.round || (round + 1));
          setActiveCondition(ev.activeCondition || null);
          setCurrentPickerId(ev.currentPickerId || '');
          setCurrentPickerName(ev.currentPickerName || '');
          setSelectedSlotKey(null);
          setQuery('');
          setSelectedPlayer(null);
          setReadyForNextRound(false);
          setMyPicks({ FWD: null, MID: null, DEF_1: null, DEF_2: null, GK: null });
          if (ev.draftedPlayerIds) setDraftedPlayerIds(ev.draftedPlayerIds);
        } else if (ev.action === 'ROUND_ADVANCE') {
          setPhase('DRAFTING');
          setRound(ev.round || 1);
          setActiveCondition(ev.activeCondition || null);
          setCurrentPickerId(ev.currentPickerId || '');
          setCurrentPickerName(ev.currentPickerName || '');
          setSelectedSlotKey(null);
          setQuery('');
          setSelectedPlayer(null);
          if (ev.draftedPlayerIds) setDraftedPlayerIds(ev.draftedPlayerIds);
        } else if (ev.action === 'PICK_LOCKED') {
          if (ev.draftedPlayerIds) setDraftedPlayerIds(ev.draftedPlayerIds);
          if (ev.currentPickerId) {
            setCurrentPickerId(ev.currentPickerId);
            setCurrentPickerName(ev.currentPickerName || '');
          }
        } else if (ev.action === 'AI_EVALUATION_START') {
          setPhase('AI_REVEAL');
        } else if (ev.action === 'RESET_LOBBY') {
          setPhase('LOBBY');
          setRound(1);
          setIsReady(false);
          setReadyForNextRound(false);
          setMyPicks({ FWD: null, MID: null, DEF_1: null, DEF_2: null, GK: null });
        } else if (ev.action === 'KICK_PLAYER') {
          if (ev.targetPlayerId === playerIdRef.current) {
            sessionStorage.removeItem('draft_player_id');
            sessionStorage.removeItem('draft_player_name');
            sessionStorage.removeItem('draft_player_club');
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
          sessionStorage.removeItem('draft_player_name');
          sessionStorage.removeItem('draft_player_club');
          sessionStorage.removeItem('draft_room');
          navigate('/');
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && hasJoinedRef.current) {
          channel.track({
            id: playerIdRef.current,
            name: playerNameRef.current,
            selectedClub: selectedClubRef.current,
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
  }, [roomCode, playerId, round, navigate]);

  // Join Screen: Plain Brutalist input + Curated Team Logo Picker
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
            {/* Plain Brutalist Name Input */}
            <div>
              <label className="text-xs font-black text-[#5C4033] block mb-1">
                اسم المتسابق
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="اكتب اسمك..."
                className="w-full bg-white border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl px-4 py-3 font-black text-sm text-[#2C2A29] focus:outline-none"
                maxLength={20}
                required
              />
            </div>

            {/* Team Logo Picker Button */}
            <div>
              <label className="text-xs font-black text-[#5C4033] block mb-1">
                شعار الفريق (20 نادياً رسمياً)
              </label>
              <div className="flex items-center gap-3">
                {selectedClub && (
                  <div className="w-12 h-12 rounded-xl bg-white border-2 border-[#2C2A29] p-1 flex items-center justify-center shrink-0 shadow-sm">
                    <img src={selectedClub.badgeUrl} alt={selectedClub.name} className="w-full h-full object-contain" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsClubModalOpen(true)}
                  className="flex-1 bg-[#F7F4EC] border-2 border-[#2C2A29] hover:bg-[#E5E0D5] py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] cursor-pointer transition-all truncate"
                >
                  {selectedClub ? selectedClub.name : 'اختر شعار فريقك'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#8A9A5B] hover:bg-[#78884E] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none py-3.5 rounded-xl font-black text-base flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <span>دخول الغرفة</span>
            </button>
          </form>
        </div>

        {/* 20 Curated Clubs Modal */}
        <DraftClubPickerModal
          isOpen={isClubModalOpen}
          selectedClubId={selectedClub?.id}
          onSelectClub={(club) => {
            setSelectedClub(club);
            sessionStorage.setItem('draft_player_club', JSON.stringify(club));
          }}
          onClose={() => setIsClubModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full bg-[#E5E0D5] text-[#2C2A29] flex flex-col font-sans select-none overflow-x-hidden"
      dir="rtl"
    >
      {/* Top Mobile Bar */}
      <header className="w-full bg-[#E5E0D5] border-b-2 border-[#2C2A29] px-4 py-2.5 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          {selectedClub && (
            <img src={selectedClub.badgeUrl} alt={selectedClub.name} className="w-7 h-7 object-contain" />
          )}
          <div>
            <h2 className="font-black text-sm text-[#2C2A29] leading-tight">
              {playerName}
            </h2>
            <span className="text-[10px] font-bold text-[#5C4033] block">
              {selectedClub?.name || 'فريق الأحلام'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {phase === 'DRAFTING' && (
            <span className="bg-[#F7F4EC] border border-[#2C2A29] px-2 py-0.5 rounded-lg text-xs font-black text-[#2C2A29]">
              جولة {round}/5
            </span>
          )}
          <span className="font-mono text-xs font-black text-[#5C4033] bg-[#F7F4EC] px-2 py-0.5 rounded-lg border border-[#2C2A29]">
            {roomCode}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col p-3 sm:p-4 max-w-md mx-auto w-full space-y-3 justify-between">
        {/* =======================================================
            STATE: LOBBY
            ======================================================= */}
        {phase === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-6 animate-fade-in">
            {selectedClub ? (
              <div className="w-20 h-20 bg-white border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl flex items-center justify-center p-2">
                <img src={selectedClub.badgeUrl} alt={selectedClub.name} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl flex items-center justify-center text-white">
                <Shield size={32} />
              </div>
            )}

            <div className="space-y-1">
              <h3 className="text-xl font-black text-[#2C2A29]">أهلاً بك {playerName}!</h3>
              <p className="text-xs font-bold text-[#5C4033]">
                أنت جاهز لتمثيل <span className="text-[#8A9A5B] font-black">{selectedClub?.name}</span>، اضغط زر الاستعداد للمنافسة!
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
                  selectedClub: selectedClubRef.current,
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
            STATE: DRAFTING (Strict 3-Section Vertical Layout)
            ======================================================= */}
        {phase === 'DRAFTING' && (
          <div className="flex-1 flex flex-col justify-between space-y-2.5">
            {/* -----------------------------------------------------
                SECTION 1: TOP CONDITION DISPLAY CARD
                ----------------------------------------------------- */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] p-3 rounded-xl text-center shadow-[3px_3px_0px_#2C2A29]">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#8A9A5B] block mb-0.5">
                شرط الجولة الحالية
              </span>
              <h3 className="text-base sm:text-lg font-black text-[#2C2A29]">
                {activeCondition ? activeCondition.title : 'جاري سحب الشرط...'}
              </h3>
              <p className="text-[11px] font-bold text-[#5C4033] mt-0.5">
                {activeCondition?.rulePrompt}
              </p>
            </div>

            {/* -----------------------------------------------------
                SECTION 2: MIDDLE SEARCH BAR & STRICT PINNING
                ----------------------------------------------------- */}
            <div className="space-y-2">
              {/* Position Selection Notice / Indicator */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-[#2C2A29]">
                  {selectedSlotKey ? (
                    <span className="text-[#C68B59] font-black">
                      المركز المختار للبحث: [{DRAFT_POSITION_NAMES[selectedSlotKey]}]
                    </span>
                  ) : (
                    <span className="text-[#5C4033]">
                      اختر مركزاً في الملعب أولاً لتفعيله
                    </span>
                  )}
                </span>
                {isMyTurn ? (
                  <span className="text-[10px] font-black bg-[#8A9A5B] text-white px-2 py-0.5 rounded-full">
                    دورك الآن ⚡
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-[#5C4033]">
                    دور: {currentPickerName}
                  </span>
                )}
              </div>

              {/* Search Input with Position Selection Gate */}
              <div className="relative">
                <input
                  type="text"
                  disabled={!isMyTurn || !selectedSlotKey}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedPlayer(null);
                  }}
                  placeholder={
                    !isMyTurn
                      ? "انتظر دورك للتجنيد..."
                      : selectedSlotKey
                      ? "ابحث عن اللاعب وثبته..."
                      : "اضغط على مركز في الملعب أولاً"
                  }
                  className={`w-full border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl px-3.5 py-2.5 font-black text-sm transition-all focus:outline-none ${
                    !isMyTurn || !selectedSlotKey
                      ? 'bg-[#D5CFC5] text-[#8C827A] placeholder-[#8C827A] cursor-not-allowed'
                      : 'bg-white text-[#2C2A29] placeholder-[#5C4033]/60'
                  }`}
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

              {/* Name-Only Autocomplete Dropdown List */}
              {isMyTurn && selectedSlotKey && searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 p-1 bg-white rounded-xl border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29]">
                  {searchResults.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        handleConfirmPick(player);
                      }}
                      className="w-full text-right p-2 rounded-lg hover:bg-[#E5E0D5] text-[#2C2A29] border border-[#2C2A29]/10 flex items-center justify-between cursor-pointer transition-all"
                    >
                      {/* STRICTLY PLAYER NAME ONLY */}
                      <span className="font-bold text-sm leading-tight text-[#2C2A29]">
                        {player.name}
                      </span>
                      <span className="text-[10px] font-black text-[#8A9A5B]">تثبيت</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Custom Pin Button (If typed name not found in database or custom pinning) */}
              {isMyTurn && selectedSlotKey && query.trim().length > 1 && (
                <button
                  type="button"
                  onClick={handlePinCustomPlayer}
                  className="bg-[#8A9A5B] hover:bg-[#78884E] text-white p-2.5 rounded-xl font-black w-full border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Pin size={16} />
                  <span>تثبيت اللاعب: "{query.trim()}"</span>
                </button>
              )}
            </div>

            {/* -----------------------------------------------------
                SECTION 3: BOTTOM TACTICAL HALF-PITCH (~50% HEIGHT)
                ----------------------------------------------------- */}
            <div>
              <div className="flex items-center justify-between pb-1 px-1">
                <span className="text-xs font-black text-[#5C4033]">
                  نصف الملعب التكتيكي (انقر لاختيار المركز):
                </span>
                <span className="text-[10px] font-black text-[#8A9A5B]">
                  {Object.values(myPicks).filter(Boolean).length}/5 مكتمل
                </span>
              </div>

              <DraftTacticalPitch
                picks={myPicks}
                selectedPosition={selectedSlotKey}
                onSelectSlot={(pos) => {
                  sound.playClick();
                  setSelectedSlotKey(pos);
                  setQuery('');
                  setSelectedPlayer(null);
                }}
                interactive={isMyTurn}
              />
            </div>
          </div>
        )}

        {/* =======================================================
            STATE: AI REVEAL & ROUND 5 PODIUM TRANSITIONS
            ======================================================= */}
        {phase === 'AI_REVEAL' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-4 animate-fade-in">
            <div className="w-16 h-16 bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl flex items-center justify-center text-3xl text-white">
              <Trophy size={32} />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-[#2C2A29]">
                {round >= 5 ? 'اختتام المنافسة الكبرى!' : `نهاية الجولة ${round} من 5!`}
              </h2>
              <p className="text-xs font-bold text-[#5C4033] max-w-xs mx-auto">
                {round >= 5
                  ? 'شاهد شاشة العرض الرئيسية الآن لتتويج البطل النهائي!'
                  : 'تابع شاشة العرض لنتائج الجولة، واضغط الزر أدناه عند استعدادك للجولة التالية!'}
              </p>
            </div>

            {/* Next Round Ready Button (Ochre Orange bg-[#C68B59]) */}
            {round < 5 && (
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  const nextState = !readyForNextRound;
                  setReadyForNextRound(nextState);
                  broadcastEvent({
                    action: 'PLAYER_NEXT_ROUND_READY',
                    playerId: playerIdRef.current,
                    playerName: playerNameRef.current,
                    isReady: nextState,
                  });
                }}
                className={`w-full max-w-xs py-3.5 px-6 rounded-2xl font-black text-base border-3 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all flex items-center justify-center gap-2 ${
                  readyForNextRound
                    ? 'bg-[#8A9A5B] text-white'
                    : 'bg-[#C68B59] hover:bg-[#B57A48] text-white'
                }`}
              >
                <RefreshCw size={18} className={readyForNextRound ? 'animate-spin' : ''} />
                <span>{readyForNextRound ? 'بانتظار انطلاق الجولة التالية ✓' : 'جاهز للجولة التالية'}</span>
              </button>
            )}

            {/* Miniature pitch preview of player's picks */}
            <div className="w-full pt-2">
              <DraftTacticalPitch picks={myPicks} interactive={false} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
