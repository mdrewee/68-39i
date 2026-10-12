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
import { FootballPlayer } from '../../../data/footballMasterData';
import { searchFootballPlayers } from '../../../utils/footballSearch';
import { SecretPitchDrawer } from './components/SecretPitchDrawer';
import { sound } from '../../../lib/audio';
import { CheckCircle2, Search, Send, Clock, Shield, User, Trophy } from 'lucide-react';

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
  const [activePosition, setActivePosition] = useState<DraftPosition>('GK');
  const [activeCondition, setActiveCondition] = useState<DraftCondition | null>(null);
  const [currentPickerId, setCurrentPickerId] = useState<string>('');
  const [currentPickerName, setCurrentPickerName] = useState<string>('');
  const [draftedPlayerIds, setDraftedPlayerIds] = useState<string[]>([]);

  // Local secret squad picks
  const [myPicks, setMyPicks] = useState<Record<DraftPosition, FootballPlayer | null>>({
    GK: null,
    DEF: null,
    MID: null,
    FWD: null,
    WILDCARD: null,
  });

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

  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);
  useEffect(() => { hasJoinedRef.current = hasJoined; }, [hasJoined]);

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
    const raw = searchFootballPlayers(query, 10);
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

  // Lock In Pick
  const handleConfirmPick = useCallback((playerToLock?: FootballPlayer) => {
    const target = playerToLock || selectedPlayer;
    if (!target || !isMyTurn || phase !== 'DRAFTING') return;

    sound.playClick();

    // Update local secret squad
    setMyPicks((prev) => ({
      ...prev,
      [activePosition]: target,
    }));

    setSelectedPlayer(null);
    setQuery('');

    // Broadcast pick to TV
    broadcastEvent({
      action: 'PICK_LOCKED',
      playerId,
      playerName,
      pickedPosition: activePosition,
      pickedPlayer: target,
    });
  }, [selectedPlayer, isMyTurn, phase, activePosition, playerId, playerName, broadcastEvent]);

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
          setActivePosition(ev.activePosition || 'GK');
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
          setMyPicks({ GK: null, DEF: null, MID: null, FWD: null, WILDCARD: null });
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
              <label className="block text-xs font-black text-[#2C2A29] mb-1.5">
                اسم المتسابق
              </label>
              <input
                type="text"
                required
                maxLength={20}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="اكتب اسمك..."
                className="w-full bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl px-4 py-3 font-black text-sm text-[#2C2A29] focus:outline-none focus:bg-white"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#8A9A5B] hover:bg-[#78884E] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none py-3.5 rounded-xl font-black text-base transition-all cursor-pointer"
            >
              دخول
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full bg-[#E5E0D5] text-[#2C2A29] flex flex-col font-sans select-none overflow-x-hidden"
      dir="rtl"
    >
      {/* Mobile Top Header */}
      <header className="bg-[#E5E0D5] border-b-2 border-[#2C2A29] px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <span className="font-black text-sm text-[#2C2A29] truncate max-w-[140px]">
            {playerName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {phase === 'DRAFTING' && (
            <span className="bg-[#F7F4EC] border-2 border-[#2C2A29] px-2.5 py-0.5 rounded-lg text-xs font-black shadow-[1px_1px_0px_#2C2A29]">
              الجولة {round}/5
            </span>
          )}
          <span className="bg-[#8A9A5B] text-[#F7F4EC] border-2 border-[#2C2A29] px-2.5 py-0.5 rounded-lg text-xs font-black shadow-[1px_1px_0px_#2C2A29]">
            {roomCode}
          </span>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 flex flex-col p-4 space-y-4 max-w-md mx-auto w-full justify-between">
        {/* =======================================================
            STATE: LOBBY
            ======================================================= */}
        {phase === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-8">
            <div className="w-16 h-16 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl flex items-center justify-center text-2xl font-black text-[#2C2A29]">
              5
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-[#2C2A29]">أهلاً بك يا {playerName}!</h2>
              <p className="text-xs font-bold text-[#5C4033]">
                جهز خطتك التكتيكية واضغط على زر الجاهزية ⚡
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
          <div className="flex-1 flex flex-col space-y-4">
            {/* 1. Turn Status Banner */}
            {isMyTurn ? (
              <div className="bg-[#8A9A5B] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black leading-tight">دورك الآن للاختيار! ⚡</h3>
                  <span className="text-xs font-bold opacity-90 block">
                    المركز: {DRAFT_POSITION_NAMES[activePosition]}
                  </span>
                </div>
                <div className="flex items-center gap-1 font-mono font-black text-xl bg-[#2C2A29] text-[#F7F4EC] px-3 py-1 rounded-xl">
                  <Clock size={16} />
                  <span>{turnTimerSec}ث</span>
                </div>
              </div>
            ) : (
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#5C4033] block">الدور الحالي:</span>
                  <h3 className="text-base font-black text-[#2C2A29]">
                    دور <span className="text-[#C68B59]">{currentPickerName}</span> حالياً للاختيار...
                  </h3>
                  <span className="text-[11px] font-bold text-[#8A9A5B] mt-0.5 block">
                    المركز القادم لك: {DRAFT_POSITION_NAMES[activePosition]}
                  </span>
                </div>
                <div className="flex items-center gap-1 font-mono font-black text-base bg-[#E5E0D5] text-[#2C2A29] px-2.5 py-1 rounded-xl border border-[#2C2A29]">
                  <Clock size={14} />
                  <span>{turnTimerSec}ث</span>
                </div>
              </div>
            )}

            {/* 2. Active Round Condition Box */}
            {activeCondition && (
              <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl p-3">
                <span className="text-[10px] font-black uppercase text-[#5C4033] block">
                  شرط الجولة النشط:
                </span>
                <h4 className="text-sm font-black text-[#2C2A29]">
                  {activeCondition.title}
                </h4>
                <p className="text-xs font-bold text-[#5C4033] mt-0.5">
                  {activeCondition.description}
                </p>
              </div>
            )}

            {/* 3. Search and Selection Arena (If My Turn) */}
            {isMyTurn ? (
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl p-4 space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ابحث عن لاعب: مثلاً ميسي، مالديني، بوفون..."
                    className="w-full bg-white border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl px-4 py-3 font-black text-sm text-[#2C2A29] focus:outline-none"
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
                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 p-1">
                    {searchResults.map((player) => {
                      const isSelected = selectedPlayer?.id === player.id;
                      return (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => setSelectedPlayer(player)}
                          className={`w-full text-right p-2.5 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-[#8A9A5B] text-[#F7F4EC] border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29]'
                              : 'bg-white hover:bg-[#E5E0D5] text-[#2C2A29] border-[#2C2A29]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#E5E0D5] border border-[#2C2A29] flex items-center justify-center font-black text-xs shrink-0 overflow-hidden">
                              {player.photo ? (
                                <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
                              ) : (
                                <User size={16} />
                              )}
                            </div>
                            <div>
                              <span className="font-black text-xs block leading-tight">
                                {player.name}
                              </span>
                              <span className="text-[10px] font-bold opacity-80 block">
                                {player.position} | {player.nationality}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold opacity-75 truncate max-w-[110px]">
                            {player.clubs.slice(0, 2).join('، ')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Selected Player preview & Lock In button */}
                {selectedPlayer && (
                  <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#2C2A29]">
                        اللاعب المختار: {selectedPlayer.name}
                      </span>
                      <span className="text-[10px] font-black bg-[#8A9A5B] text-white px-2 py-0.5 rounded-lg">
                        {selectedPlayer.position}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleConfirmPick()}
                      className="w-full bg-[#8A9A5B] hover:bg-[#78884E] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <CheckCircle2 size={16} />
                      <span>تأكيد الاختيار وقفل اللاعب 🔒</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl p-6 text-center space-y-2">
                <span className="text-2xl">⏳</span>
                <h4 className="text-sm font-black text-[#2C2A29]">انتظر دورك للتجنيد</h4>
                <p className="text-xs font-bold text-[#5C4033]">
                  استغل الوقت في دراسة شروط الجولة وتجهيز الخيار الأنسب لمركزك!
                </p>
              </div>
            )}

            {/* 4. Miniature Secret Pitch Drawer (Persistent on Mobile) */}
            <SecretPitchDrawer picks={myPicks} activePosition={activePosition} />
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
                تابع شاشة العرض الرئيسية الآن لمشاهدة كشف التشكيلات والتقييم التكتيكي الذكي! ⚡
              </p>
            </div>
            <SecretPitchDrawer picks={myPicks} />
          </div>
        )}
      </main>
    </div>
  );
};
