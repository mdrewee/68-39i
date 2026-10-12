import React, { useState, useEffect, useRef, useCallback, FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  DraftPhase,
  DraftPosition,
  DraftContestant,
  DraftEventPayload,
  SquadAIEvaluation,
  DraftVerdictResult,
  DRAFT_SLOTS_ORDER,
  DRAFT_POSITION_SHORT_NAMES,
} from './types';
import {
  DraftCondition,
  getRandomDraftCondition,
} from '../../../data/draftConditions';
import { FootballPlayer } from '../../../data/footballMasterData';
import { evaluateDraftSquadsWithAI } from '../../../utils/aiTacticalJudge';
import { DraftTopBar } from './components/DraftTopBar';
import { supabase } from '../../../lib/supabase';
import { sound } from '../../../lib/audio';
import {
  Users,
  Play,
  RotateCcw,
  Clock,
  Shield,
  Copy,
  Check,
  Award,
  Swords,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export const DraftTVView: FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // Core Game State
  const [phase, setPhase] = useState<DraftPhase>('LOBBY');
  const [round, setRound] = useState<number>(1); // 1 to 5 rounds
  const [activeCondition, setActiveCondition] = useState<DraftCondition | null>(null);

  // Participants & Secret Picks
  const [contestants, setContestants] = useState<DraftContestant[]>([]);
  const [usedConditions, setUsedConditions] = useState<DraftCondition[]>([]);
  const [draftedPlayerIds, setDraftedPlayerIds] = useState<string[]>([]);

  // Rotating Turn State
  const [turnOrder, setTurnOrder] = useState<string[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(30);

  // Final Two-Tier AI Evaluation Results
  const [verdictResult, setVerdictResult] = useState<DraftVerdictResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // References
  const channelRef = useRef<RealtimeChannel | null>(null);
  const phaseRef = useRef<DraftPhase>(phase);
  const roundRef = useRef<number>(round);
  const contestantsRef = useRef<DraftContestant[]>(contestants);
  const turnOrderRef = useRef<string[]>(turnOrder);
  const currentTurnIndexRef = useRef<number>(currentTurnIndex);
  const draftedPlayerIdsRef = useRef<string[]>(draftedPlayerIds);
  const activeConditionRef = useRef<DraftCondition | null>(activeCondition);
  const usedConditionsRef = useRef<DraftCondition[]>(usedConditions);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { contestantsRef.current = contestants; }, [contestants]);
  useEffect(() => { turnOrderRef.current = turnOrder; }, [turnOrder]);
  useEffect(() => { currentTurnIndexRef.current = currentTurnIndex; }, [currentTurnIndex]);
  useEffect(() => { draftedPlayerIdsRef.current = draftedPlayerIds; }, [draftedPlayerIds]);
  useEffect(() => { activeConditionRef.current = activeCondition; }, [activeCondition]);
  useEffect(() => { usedConditionsRef.current = usedConditions; }, [usedConditions]);

  // Broadcast to all clients
  const broadcastEvent = useCallback((payload: DraftEventPayload) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'draft_event',
      payload,
    });
  }, []);

  const handleCopyCode = async () => {
    sound.playClick();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(roomCode);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = roomCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Compute fair rotating turn order for round R (1-indexed)
  const computeTurnOrderForRound = (players: DraftContestant[], roundNum: number): string[] => {
    if (players.length === 0) return [];
    const n = players.length;
    const startIndex = (roundNum - 1) % n;
    const order: string[] = [];
    for (let i = 0; i < n; i++) {
      const idx = (startIndex + i) % n;
      order.push(players[idx].id);
    }
    return order;
  };

  // Host Kick Contestant
  const handleKickPlayer = useCallback((targetPlayerId: string) => {
    sound.playClick();
    broadcastEvent({ action: 'KICK_PLAYER', targetPlayerId });
    setContestants((prev) => prev.filter((p) => p.id !== targetPlayerId));
  }, [broadcastEvent]);

  // Terminate Room
  const handleTerminateRoom = useCallback(() => {
    sound.playClick();
    broadcastEvent({ action: 'ROOM_TERMINATED' });
    sessionStorage.removeItem('draft_player_id');
    sessionStorage.removeItem('draft_room');
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    navigate('/');
  }, [broadcastEvent, navigate]);

  // Start the Draft (5 rounds)
  const handleStartGame = useCallback(() => {
    if (contestantsRef.current.length < 2) {
      alert('يجب انضمام متسابقين اثنين على الأقل لبدء التحدي!');
      return;
    }

    sound.playWhistle();

    const initialRound = 1;
    const initialCondition = getRandomDraftCondition(new Set());
    const initialTurnOrder = computeTurnOrderForRound(contestantsRef.current, initialRound);
    const firstPickerId = initialTurnOrder[0];
    const firstPicker = contestantsRef.current.find((c) => c.id === firstPickerId);

    setUsedConditions([initialCondition]);
    setRound(initialRound);
    setActiveCondition(initialCondition);
    setTurnOrder(initialTurnOrder);
    setCurrentTurnIndex(0);
    setTimeLeftSec(30);
    setDraftedPlayerIds([]);
    setVerdictResult(null);
    setPhase('DRAFTING');

    broadcastEvent({
      action: 'GAME_START',
      phase: 'DRAFTING',
      round: initialRound,
      activeCondition: initialCondition,
      turnOrder: initialTurnOrder,
      currentPickerId: firstPickerId,
      currentPickerName: firstPicker?.name || '',
      draftedPlayerIds: [],
    });
  }, [broadcastEvent]);

  // Advance turn or advance round
  const handleAdvanceTurn = useCallback((updatedContestants: DraftContestant[], newDrafted: string[]) => {
    const currentOrder = turnOrderRef.current;
    const nextTurnIdx = currentTurnIndexRef.current + 1;

    // Check if current round has more turns remaining
    if (nextTurnIdx < currentOrder.length) {
      const nextPickerId = currentOrder[nextTurnIdx];
      const nextPicker = updatedContestants.find((c) => c.id === nextPickerId);

      setCurrentTurnIndex(nextTurnIdx);
      setTimeLeftSec(30);
      sound.playTick();

      broadcastEvent({
        action: 'PICK_LOCKED',
        currentPickerId: nextPickerId,
        currentPickerName: nextPicker?.name || '',
        draftedPlayerIds: newDrafted,
      });
      return;
    }

    // Current round finished! Check if we have more rounds
    const nextRound = roundRef.current + 1;
    if (nextRound <= 5) {
      const prevIds = new Set(usedConditionsRef.current.map((c) => c.id));
      const nextCondition = getRandomDraftCondition(prevIds);
      const updatedUsedConditions = [...usedConditionsRef.current, nextCondition];
      setUsedConditions(updatedUsedConditions);

      const nextTurnOrder = computeTurnOrderForRound(updatedContestants, nextRound);
      const firstPickerId = nextTurnOrder[0];
      const firstPicker = updatedContestants.find((c) => c.id === firstPickerId);

      setRound(nextRound);
      setActiveCondition(nextCondition);
      setTurnOrder(nextTurnOrder);
      setCurrentTurnIndex(0);
      setTimeLeftSec(30);
      sound.playWhistle();

      broadcastEvent({
        action: 'ROUND_ADVANCE',
        round: nextRound,
        activeCondition: nextCondition,
        turnOrder: nextTurnOrder,
        currentPickerId: firstPickerId,
        currentPickerName: firstPicker?.name || '',
        draftedPlayerIds: newDrafted,
      });
      return;
    }

    // ALL 5 ROUNDS COMPLETED! Trigger Two-Tier Secret AI Evaluation
    sound.playVictory();
    setPhase('AI_REVEAL');
    setIsEvaluating(true);

    broadcastEvent({ action: 'AI_EVALUATION_START' });

    // Execute Two-Tier Adjudication
    evaluateDraftSquadsWithAI(updatedContestants, usedConditionsRef.current).then((result) => {
      setVerdictResult(result);
      setIsEvaluating(false);
      broadcastEvent({
        action: 'AI_EVALUATION_DONE',
        evaluations: result.evaluations,
        verdictResult: result,
      });
    });
  }, [broadcastEvent]);

  // Handle Pick Locked from contestant into their chosen position
  const handleContestantPick = useCallback((
    pickerId: string,
    position: DraftPosition,
    player: FootballPlayer,
    appliedCondition?: DraftCondition
  ) => {
    // 1. Lock player globally in anti-steal list
    const updatedDrafted = [...draftedPlayerIdsRef.current, player.id];
    setDraftedPlayerIds(updatedDrafted);

    // 2. Update contestant picks and associate condition
    const updatedContestants = contestantsRef.current.map((c) => {
      if (c.id === pickerId) {
        return {
          ...c,
          picks: {
            ...c.picks,
            [position]: player,
          },
          pickConditions: {
            ...(c.pickConditions || { GK: null, DEF_1: null, DEF_2: null, MID: null, FWD: null }),
            [position]: appliedCondition || activeConditionRef.current,
          },
        };
      }
      return c;
    });
    setContestants(updatedContestants);

    // 3. Advance to next turn or next round
    handleAdvanceTurn(updatedContestants, updatedDrafted);
  }, [handleAdvanceTurn]);

  // 30-Second Turn Countdown Loop
  useEffect(() => {
    if (phase !== 'DRAFTING') return;

    const interval = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          // Turn Timeout: Auto advance
          const curPickerId = turnOrderRef.current[currentTurnIndexRef.current];
          if (curPickerId) {
            handleAdvanceTurn(contestantsRef.current, draftedPlayerIdsRef.current);
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, handleAdvanceTurn]);

  // Realtime Presence Setup
  useEffect(() => {
    if (!roomCode) return;

    const channelId = `draft5:${roomCode}`;

    const existingChannel = supabase.getChannels().find(
      (ch) => ch.topic === `realtime:${channelId}` || ch.topic === channelId
    );
    if (existingChannel) supabase.removeChannel(existingChannel);

    const channel = supabase.channel(channelId, {
      config: {
        broadcast: { self: true },
        presence: { key: 'host_tv' },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const rawEntries = Object.values(state).flat() as any[];
        const map = new Map<string, DraftContestant>();

        rawEntries.forEach((entry) => {
          if (entry.id && entry.id !== 'host_tv' && !map.has(entry.id)) {
            const existing = contestantsRef.current.find((c) => c.id === entry.id);
            map.set(entry.id, {
              id: entry.id,
              name: entry.name || '',
              isReady: entry.isReady || false,
              picks: existing ? existing.picks : { GK: null, DEF_1: null, DEF_2: null, MID: null, FWD: null },
              pickConditions: existing ? existing.pickConditions : { GK: null, DEF_1: null, DEF_2: null, MID: null, FWD: null },
            });
          }
        });

        setContestants(Array.from(map.values()));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        sound.playPlayerJoin();
        newPresences.forEach((entry: any) => {
          if (entry.id && entry.id !== 'host_tv') {
            setContestants((prev) => {
              if (prev.some((p) => p.id === entry.id)) return prev;
              return [
                ...prev,
                {
                  id: entry.id,
                  name: entry.name || '',
                  isReady: false,
                  picks: { GK: null, DEF_1: null, DEF_2: null, MID: null, FWD: null },
                  pickConditions: { GK: null, DEF_1: null, DEF_2: null, MID: null, FWD: null },
                },
              ];
            });
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((entry: any) => {
          if (entry.id) {
            setContestants((prev) => prev.filter((p) => p.id !== entry.id));
          }
        });
      })
      .on('broadcast', { event: 'draft_event' }, ({ payload }) => {
        if (!payload) return;
        const ev = payload as DraftEventPayload;

        if (ev.action === 'PLAYER_READY' && ev.playerId) {
          setContestants((prev) =>
            prev.map((p) => (p.id === ev.playerId ? { ...p, isReady: Boolean(ev.isReady) } : p))
          );
        } else if (ev.action === 'PICK_LOCKED' && ev.playerId && ev.pickedPosition && ev.pickedPlayer) {
          handleContestantPick(ev.playerId, ev.pickedPosition, ev.pickedPlayer, ev.appliedCondition);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({
            id: 'host_tv',
            name: 'شاشة العرض',
            role: 'tv',
            joinedAt: Date.now(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, handleContestantPick]);

  const joinUrl = `${window.location.origin}/room/${roomCode}/football/draft-5`;
  const currentPickerId = turnOrder[currentTurnIndex];
  const currentPicker = contestants.find((c) => c.id === currentPickerId);

  // Sorted evaluations: Higher condition count first, then overall percentage
  const evaluationsList = verdictResult ? verdictResult.evaluations : [];
  const rankedEvaluations = [...evaluationsList].sort((a, b) => {
    if (b.validConditionsCount !== a.validConditionsCount) {
      return b.validConditionsCount - a.validConditionsCount;
    }
    return b.overallPercentage - a.overallPercentage;
  });

  return (
    <div
      className="min-h-screen w-full bg-[#E5E0D5] text-[#2C2A29] flex flex-col font-sans select-none overflow-x-hidden"
      dir="rtl"
    >
      <DraftTopBar
        title="كوّن فريقك 5"
        roomCode={roomCode}
        round={phase === 'DRAFTING' ? round : undefined}
        totalRounds={5}
        timeLeft={phase === 'DRAFTING' ? timeLeftSec : undefined}
        onExit={() => setPhase('LOBBY')}
        onEndRoom={handleTerminateRoom}
      />

      {/* Progress Bar (Turn Timer) */}
      {phase === 'DRAFTING' && (
        <div className="w-full h-2.5 bg-[#D5CFC5] border-b-2 border-[#2C2A29] overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ease-linear ${
              timeLeftSec > 10 ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'
            }`}
            style={{ width: `${(timeLeftSec / 30) * 100}%` }}
          />
        </div>
      )}

      {/* Main Content Arena */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* =======================================================
            STATE 1: LOBBY
            ======================================================= */}
        {phase === 'LOBBY' && (
          <div className="flex flex-col items-center justify-center w-full max-w-4xl space-y-8 animate-fade-in">
            {/* Header Title Banner */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 bg-[#8A9A5B] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] px-4 py-1.5 rounded-xl font-black text-sm">
                <Shield size={16} />
                <span>كوّن فريقك الخماسي ⚡</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-[#2C2A29] tracking-tight">
                درافت سري وتقييم تكتيكي ذكي
              </h1>
              <p className="text-sm md:text-base font-bold text-[#5C4033]">
                اختر 5 لاعبين وفق شروط عشوائية متغيرة لكل جولة، وتناوب عادل بالدور!
              </p>
            </div>

            {/* Brutalist QR & Roster Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full bg-[#F7F4EC] border-3 border-[#2C2A29] shadow-[8px_8px_0px_#2C2A29] rounded-3xl p-6 md:p-8">
              {/* QR Section */}
              <div className="flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-[#2C2A29] rounded-2xl bg-white space-y-4">
                <div className="bg-[#F7F4EC] p-3 rounded-2xl border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29]">
                  <QRCodeSVG value={joinUrl} size={190} level="H" className="rounded-lg" />
                </div>
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <span className="text-xs font-black text-[#5C4033] block">امسح للدخول بالجوال</span>
                  <button
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-2 bg-[#F7F4EC] hover:bg-[#E5E0D5] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] px-4 py-2 rounded-xl text-lg font-black font-mono text-[#2C2A29] cursor-pointer transition-all"
                    title="اضغط لنسخ كود الغرفة"
                  >
                    {copied ? <Check size={18} className="text-[#8A9A5B]" /> : <Copy size={18} className="text-[#5C4033]" />}
                    <span>{roomCode}</span>
                    <span className="text-xs font-bold text-[#5C4033] font-sans">
                      {copied ? '(تم النسخ ✓)' : '(نسخ الكود)'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Roster & Start Button */}
              <div className="flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b-2 border-[#2C2A29]">
                    <div className="flex items-center gap-2 font-black text-lg text-[#2C2A29]">
                      <Users size={20} />
                      <span>المتسابقون ({contestants.length})</span>
                    </div>
                  </div>

                  {contestants.length === 0 ? (
                    <div className="py-12 text-center text-[#5C4033] font-bold text-sm">
                      بانتظار انضمام المتسابقين عبر مسح الكود...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1 mt-3">
                      {contestants.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 bg-[#E5E0D5] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] px-3 py-2 rounded-xl"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {p.isReady && (
                              <span className="text-[10px] bg-[#8A9A5B] text-[#F7F4EC] px-1.5 py-0.5 rounded-md font-black shrink-0">
                                جاهز ✓
                              </span>
                            )}
                            <span className="font-black text-sm text-[#2C2A29] truncate">{p.name}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleKickPlayer(p.id)}
                            className="bg-[#C68B59] hover:bg-[#2C2A29] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 transition-colors cursor-pointer"
                            title="استبعاد المتسابق"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleStartGame}
                  className="w-full mt-6 bg-[#8A9A5B] hover:bg-[#78884E] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none py-3.5 px-6 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Play size={20} className="fill-[#F7F4EC]" />
                  <span>انطلق - ابدأ الدرافت (5 جولات)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            STATE 2: DRAFTING (Strict Privacy Guarantee)
            ======================================================= */}
        {phase === 'DRAFTING' && activeCondition && (
          <div className="flex flex-col items-center justify-between w-full h-full max-w-6xl space-y-6 animate-fade-in">
            {/* Top Round Header */}
            <div className="text-center space-y-1">
              <span className="inline-block bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] px-4 py-1 rounded-xl text-xs font-black text-[#5C4033]">
                الجولة {round} من 5: اختيار وتوزيع حر على التشكيلة
              </span>
            </div>

            {/* Massive Hero Condition Card */}
            <div className="w-full max-w-3xl bg-[#F7F4EC] border-3 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-3xl p-6 md:p-8 text-center space-y-3">
              <span className="text-xs font-black uppercase text-[#8A9A5B] tracking-wider block">
                شرط الجولة الإلزامي
              </span>
              <h2 className="text-3xl md:text-5xl font-black text-[#2C2A29]">
                {activeCondition.title}
              </h2>
              <p className="text-base md:text-lg font-bold text-[#5C4033] max-w-xl mx-auto">
                {activeCondition.rulePrompt}
              </p>
            </div>

            {/* Turn Indicator Banner */}
            <div className="w-full max-w-3xl bg-[#8A9A5B] text-[#F7F4EC] border-3 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2C2A29] text-[#F7F4EC] flex items-center justify-center font-black text-xl">
                  {currentTurnIndex + 1}
                </div>
                <div>
                  <span className="text-xs font-bold opacity-80 block">الدور الحالي للتجنيد:</span>
                  <h3 className="text-2xl font-black">
                    {currentPicker?.name || 'جاري التحديد...'}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5 font-mono font-black text-2xl bg-[#2C2A29] text-[#F7F4EC] px-4 py-1.5 rounded-xl">
                <Clock size={20} />
                <span>{timeLeftSec}ث</span>
              </div>
            </div>

            {/* Secret Mystery Trackers for All Contestants */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
              {contestants.map((c) => {
                const isCurrent = c.id === currentPickerId;
                const totalPicked = Object.values(c.picks).filter(Boolean).length;

                return (
                  <div
                    key={c.id}
                    className={`border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl p-3 flex flex-col items-center justify-between text-center transition-all ${
                      isCurrent
                        ? 'bg-[#F7F4EC] ring-4 ring-[#8A9A5B]'
                        : 'bg-[#E5E0D5]'
                    }`}
                  >
                    <span className="font-black text-sm text-[#2C2A29] truncate max-w-full mb-2">
                      {c.name}
                    </span>

                    {/* 5 Mystery Boxes [ ؟ ] */}
                    <div className="grid grid-cols-5 gap-1 w-full">
                      {DRAFT_SLOTS_ORDER.map((pos) => {
                        const isLocked = Boolean(c.picks[pos]);
                        return (
                          <div
                            key={pos}
                            className={`h-9 rounded-lg border border-[#2C2A29] flex items-center justify-center text-xs font-black transition-all ${
                              isLocked
                                ? 'bg-[#8A9A5B] text-[#F7F4EC] shadow-[1px_1px_0px_#2C2A29]'
                                : 'bg-[#F7F4EC] text-[#5C4033]'
                            }`}
                          >
                            {isLocked ? '✓' : '؟'}
                          </div>
                        );
                      })}
                    </div>

                    <span className="text-[10px] font-bold text-[#5C4033] mt-2">
                      تم اختيار {totalPicked}/5
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =======================================================
            STATE 3: TWO-TIER AI VERIFICATION & TACTICAL RESOLUTION
            ======================================================= */}
        {phase === 'AI_REVEAL' && (
          <div className="flex flex-col items-center justify-center w-full max-w-6xl space-y-8 animate-fade-in text-center">
            {isEvaluating || !verdictResult ? (
              <div className="bg-[#F7F4EC] border-3 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-3xl p-12 space-y-4 max-w-xl mx-auto">
                <div className="w-16 h-16 bg-[#8A9A5B] border-2 border-[#2C2A29] rounded-2xl mx-auto flex items-center justify-center text-3xl animate-bounce text-white">
                  ⚡
                </div>
                <h2 className="text-3xl font-black text-[#2C2A29]">
                  جاري فحص الشروط والتحليل التكتيكي الذكي...
                </h2>
                <p className="text-sm font-bold text-[#5C4033]">
                  المحرك الآلي يفحص مطابقة اللاعبين للشروط الخمسة، ويجهز التقييم التكتيكي في حال التعادل!
                </p>
              </div>
            ) : (
              <div className="w-full space-y-8">
                {/* Massive Result Announcement Banner */}
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 bg-[#8A9A5B] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] px-4 py-1.5 rounded-xl font-black text-sm">
                    {verdictResult.isTie ? <Swords size={16} /> : <Award size={16} />}
                    <span>{verdictResult.isTie ? 'حسم التعادل التكتيكي المباشر' : 'نتيجة التحدي الرسمية'}</span>
                  </div>

                  <h2 className="text-3xl md:text-5xl font-black text-[#2C2A29] leading-tight">
                    {verdictResult.verdictBanner}
                  </h2>
                </div>

                {/* Champion Showcase Card */}
                <div className="bg-[#8A9A5B] text-[#F7F4EC] border-3 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-3xl p-6 max-w-2xl mx-auto space-y-2">
                  <span className="text-xs font-black uppercase tracking-wider bg-[#2C2A29] text-white px-3 py-1 rounded-full">
                    بطل الدرافت التكتيكي 🥇
                  </span>
                  <h3 className="text-3xl font-black">
                    فريق {verdictResult.winnerName}
                  </h3>
                  <div className="flex items-center justify-center gap-4 text-sm font-bold">
                    <span className="bg-[#2C2A29] px-3 py-1 rounded-xl">
                      الشروط المحققة: {rankedEvaluations[0]?.validConditionsCount || 0}/5
                    </span>
                    <span className="bg-[#2C2A29] px-3 py-1 rounded-xl font-mono">
                      القوة التكتيكية: {rankedEvaluations[0]?.overallPercentage || 0}%
                    </span>
                  </div>
                  <p className="text-sm font-bold opacity-90 pt-1">
                    "{rankedEvaluations[0]?.critiqueTitle}"
                  </p>
                </div>

                {/* Phase 1 & 2: Contestants Squads, Condition Verification & Tactical Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full text-right">
                  {rankedEvaluations.map((ev, idx) => {
                    const contestant = contestants.find((c) => c.id === ev.playerId);
                    const picks = contestant?.picks;
                    const isWinner = ev.playerId === verdictResult.winnerId;

                    return (
                      <div
                        key={ev.playerId}
                        className={`border-3 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-2xl p-5 space-y-4 flex flex-col justify-between ${
                          isWinner ? 'bg-[#F7F4EC] ring-4 ring-[#8A9A5B]' : 'bg-[#F7F4EC]'
                        }`}
                      >
                        <div>
                          {/* Card Header: Name + Conditions Fulfilled Badge */}
                          <div className="flex items-center justify-between pb-3 border-b-2 border-[#2C2A29]">
                            <div>
                              <span className="text-xs font-black text-[#8A9A5B]">
                                المركز #{idx + 1}
                              </span>
                              <h4 className="text-xl font-black text-[#2C2A29]">
                                {ev.playerName}
                              </h4>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-black bg-[#8A9A5B] text-white px-2.5 py-1 rounded-xl border border-[#2C2A29]">
                                {ev.validConditionsCount}/5 شروط
                              </span>
                              <span className="text-[11px] font-mono font-black text-[#5C4033] mt-1">
                                {ev.overallPercentage}% قوة
                              </span>
                            </div>
                          </div>

                          {/* 5 Players Verification List with Conditions */}
                          <div className="space-y-2 my-3">
                            <span className="text-[10px] font-black uppercase text-[#5C4033] block">
                              فحص شروط التشكيلة:
                            </span>
                            {DRAFT_SLOTS_ORDER.map((pos) => {
                              const p = picks ? picks[pos] : null;
                              const ver = ev.conditionVerifications.find((v) => v.position === pos);
                              const isValid = ver?.isValid ?? false;

                              return (
                                <div
                                  key={pos}
                                  className={`p-2 rounded-xl border text-xs space-y-0.5 ${
                                    isValid
                                      ? 'bg-[#E5E0D5] border-[#8A9A5B]'
                                      : 'bg-[#F2DEDE] border-[#C68B59]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between font-black">
                                    <span className="text-[#2C2A29]">
                                      {DRAFT_POSITION_SHORT_NAMES[pos]}: {p?.name || 'فارغ'}
                                    </span>
                                    <span className={`flex items-center gap-1 font-bold ${isValid ? 'text-[#8A9A5B]' : 'text-[#C68B59]'}`}>
                                      {isValid ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                      <span>{isValid ? 'محقق ✓' : 'غير محقق ✗'}</span>
                                    </span>
                                  </div>
                                  {ver?.conditionTitle && (
                                    <span className="text-[10px] font-bold text-[#5C4033] block">
                                      الشرط: {ver.conditionTitle} ({ver.reason})
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Tactical Line Ratings (Head-to-Head breakdown) */}
                          <div className="grid grid-cols-5 gap-1 text-center py-2 bg-[#E5E0D5] rounded-xl border border-[#2C2A29]">
                            <div>
                              <span className="text-[9px] font-bold block text-[#5C4033]">حراسة</span>
                              <span className="text-xs font-black">{ev.ratings.gk}%</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold block text-[#5C4033]">دفاع</span>
                              <span className="text-xs font-black">{ev.ratings.defense}%</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold block text-[#5C4033]">وسط</span>
                              <span className="text-xs font-black">{ev.ratings.midfield}%</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold block text-[#5C4033]">هجوم</span>
                              <span className="text-xs font-black">{ev.ratings.attack}%</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold block text-[#5C4033]">انسجام</span>
                              <span className="text-xs font-black">{ev.ratings.synergy}%</span>
                            </div>
                          </div>

                          {/* Tactical Commentary */}
                          <p className="text-xs font-bold text-[#5C4033] mt-3 leading-relaxed">
                            {ev.detailedBreakdown.tacticalSummary}
                          </p>
                        </div>

                        {/* Strengths Tags */}
                        <div className="flex flex-wrap gap-1 pt-2 border-t border-[#E5E0D5]">
                          {ev.detailedBreakdown.strengths.map((str, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-[10px] font-black bg-[#8A9A5B] text-white px-2 py-0.5 rounded-md"
                            >
                              ✓ {str}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reset / Return to Lobby Button */}
                <button
                  onClick={() => {
                    sound.playClick();
                    setPhase('LOBBY');
                    setRound(1);
                    setDraftedPlayerIds([]);
                    setVerdictResult(null);
                    broadcastEvent({ action: 'RESET_LOBBY' });
                  }}
                  className="bg-[#F7F4EC] hover:bg-white text-[#2C2A29] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none py-3.5 px-8 rounded-xl font-black text-base flex items-center gap-2 mx-auto cursor-pointer transition-all"
                >
                  <RotateCcw size={18} />
                  <span>العودة للغرفة</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
