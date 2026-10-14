import React, { useState, useEffect, useRef, useCallback, FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  DraftPhase,
  DraftPosition,
  PlayerSquad,
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
  ArrowRight,
} from 'lucide-react';

export const DraftTVView: FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // Core Game State (Strictly 5 Rounds)
  const TOTAL_ROUNDS = 5;
  const [phase, setPhase] = useState<DraftPhase>('LOBBY');
  const [round, setRound] = useState<number>(1);
  const [activeCondition, setActiveCondition] = useState<DraftCondition | null>(null);

  // Participants & Secret Picks
  const [contestants, setContestants] = useState<DraftContestant[]>([]);
  const [allSquads, setAllSquads] = useState<Record<string, PlayerSquad>>({});
  const persistentSquadsRef = useRef<Record<string, PlayerSquad>>({});
  const allSquadsRef = useRef<Record<string, PlayerSquad>>({});
  useEffect(() => {
    allSquadsRef.current = allSquads;
    persistentSquadsRef.current = { ...persistentSquadsRef.current, ...allSquads };
  }, [allSquads]);
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

  // Cumulative Wins across the 5 rounds
  const [roundWins, setRoundWins] = useState<Record<string, number>>({});

  // Live Toast Notification on TV
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

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

  const isSubscribedRef = useRef<boolean>(false);

  // Broadcast to all clients (Guarded against calling .send() before SUBSCRIBED)
  const broadcastEvent = useCallback((payload: DraftEventPayload) => {
    if (!channelRef.current || !isSubscribedRef.current) {
      console.warn('[Realtime TV] Cannot send event - channel not SUBSCRIBED yet:', payload.action);
      return;
    }
    channelRef.current.send({
      type: 'broadcast',
      event: 'draft_event',
      payload,
    });
    channelRef.current.send({
      type: 'broadcast',
      event: 'draft_action',
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

  // Compute fair rotating turn order for round/condition R (1-indexed)
  // Shifts starting index so the same player NEVER picks first every time
  const computeTurnOrderForRound = (players: DraftContestant[], roundNum: number): string[] => {
    if (!players || players.length === 0) return [];
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

  // Start the Draft (starts Round 1 of 5)
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
    setAllSquads({});
    persistentSquadsRef.current = {};
    setVerdictResult(null);
    setPhase('DRAFTING');

    // Reset contestant picks for fresh match
    const freshContestants = contestantsRef.current.map((c) => ({
      ...c,
      picks: { FWD: null, MID: null, DEF_1: null, DEF_2: null, GK: null },
      pickConditions: { FWD: null, MID: null, DEF_1: null, DEF_2: null, GK: null },
      readyForNextRound: false,
    }));
    setContestants(freshContestants);

    broadcastEvent({
      action: 'GAME_START',
      phase: 'DRAFTING',
      round: initialRound,
      totalRounds: TOTAL_ROUNDS,
      activeCondition: initialCondition,
      turnOrder: initialTurnOrder,
      currentPickerId: firstPickerId,
      currentPickerName: firstPicker?.name || '',
      draftedPlayerIds: [],
    });
  }, [broadcastEvent]);

  // Advance turn or complete 5 picks in the current round
  const handleAdvanceTurn = useCallback((updatedContestants: DraftContestant[], newDrafted: string[]) => {
    const currentOrder = turnOrderRef.current;
    const nextTurnIdx = currentTurnIndexRef.current + 1;

    // Check if current round has more turns remaining (everyone needs to pick 5 slots)
    // Total picks across all players = contestants.length * 5
    const totalPicksMade = updatedContestants.reduce(
      (acc, c) => acc + Object.values(c.picks).filter(Boolean).length,
      0
    );
    const totalPicksRequired = updatedContestants.length * 5;

    if (totalPicksMade < totalPicksRequired) {
      // Check if all players have taken 1 pick for the current condition
      const currentRoundPickCount = totalPicksMade % updatedContestants.length;
      if (currentRoundPickCount === 0) {
        // Condition advanced! Condition round index = (totalPicksMade / players.length) + 1
        const nextConditionRound = Math.floor(totalPicksMade / updatedContestants.length) + 1;
        const rotatedOrder = computeTurnOrderForRound(updatedContestants, nextConditionRound);
        const prevIds = new Set(usedConditionsRef.current.map((c) => c.id));
        const nextCondition = getRandomDraftCondition(prevIds);
        const nextPickerId = rotatedOrder[0];
        const nextPicker = updatedContestants.find((c) => c.id === nextPickerId);

        setUsedConditions((prev) => [...prev, nextCondition]);
        setActiveCondition(nextCondition);
        setTurnOrder(rotatedOrder);
        setCurrentTurnIndex(0);
        setTimeLeftSec(30);
        sound.playWhistle();

        broadcastEvent({
          action: 'ROUND_ADVANCE',
          activeCondition: nextCondition,
          turnOrder: rotatedOrder,
          currentPickerId: nextPickerId,
          currentPickerName: nextPicker?.name || '',
          draftedPlayerIds: newDrafted,
        });
        return;
      }

      // Rotate turn to next contestant in current turn order
      const actualNextIdx = nextTurnIdx % currentOrder.length;
      const nextPickerId = currentOrder[actualNextIdx];
      const nextPicker = updatedContestants.find((c) => c.id === nextPickerId);

      setCurrentTurnIndex(actualNextIdx);
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

    // ALL 5 SLOTS COMPLETED FOR EVERYONE! Trigger End-of-Draft Handshake & Evaluation
    sound.playVictory();
    setPhase('AI_REVEAL');
    setIsEvaluating(true);

    // Broadcast DRAFT_FINISHED so all mobile clients push their latest full squads immediately
    broadcastEvent({ action: 'DRAFT_FINISHED' });
    broadcastEvent({ action: 'AI_EVALUATION_START' });

    // Execute Two-Tier Adjudication after a brief timeout (allowing mobile PUSH_FINAL_SQUAD packets to arrive)
    setTimeout(() => {
      const currentPersisted = { ...persistentSquadsRef.current, ...allSquadsRef.current };
      const latestContestants = contestantsRef.current.length > 0 ? contestantsRef.current : updatedContestants;

      const mergedContestants: DraftContestant[] = latestContestants.map((c) => {
        const sq = currentPersisted[c.id];
        const mergedPicks = { ...c.picks };
        const mergedConds = { ...(c.pickConditions || { FWD: null, MID: null, DEF_1: null, DEF_2: null, GK: null }) };

        if (sq && sq.slots) {
          (Object.keys(sq.slots) as DraftPosition[]).forEach((pos) => {
            const slot = sq.slots[pos];
            if (slot && !mergedPicks[pos]) {
              mergedPicks[pos] = {
                id: 'synced_' + pos + '_' + c.id,
                name: slot.playerName,
                aliases: [slot.playerName],
                nationality: 'غير محدد',
                nationalityCode: 'UN',
                clubs: [],
                currentClub: 'مخصص',
                position: pos === 'GK' ? 'GK' : pos === 'MID' ? 'MID' : pos === 'FWD' ? 'FWD' : 'DEF',
                traits: [],
                trophies: [],
              };
              if (!mergedConds[pos]) {
                mergedConds[pos] = {
                  id: slot.conditionId || 'c_general',
                  title: slot.conditionTitle || 'شرط معتمد',
                  rulePrompt: slot.conditionTitle || 'شرط معتمد',
                };
              }
            }
          });
        }

        return {
          ...c,
          selectedClub: c.selectedClub || sq?.selectedClub || null,
          picks: mergedPicks,
          pickConditions: mergedConds,
        };
      });

      evaluateDraftSquadsWithAI(mergedContestants, usedConditionsRef.current).then((result) => {
        setVerdictResult(result);
        setIsEvaluating(false);

        // Record win for current round winner
        if (result.winnerId) {
          setRoundWins((prev) => ({
            ...prev,
            [result.winnerId]: (prev[result.winnerId] || 0) + 1,
          }));
        }

        broadcastEvent({
          action: 'AI_EVALUATION_DONE',
          evaluations: result.evaluations,
          verdictResult: result,
        });
      });
    }, 700);
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
            ...(c.pickConditions || { FWD: null, MID: null, DEF_1: null, DEF_2: null, GK: null }),
            [position]: appliedCondition || activeConditionRef.current,
          },
        };
      }
      return c;
    });
    setContestants(updatedContestants);

    // 3. Advance to next turn or finish round
    handleAdvanceTurn(updatedContestants, updatedDrafted);
  }, [handleAdvanceTurn]);

  // Start Next Round (Round N+1 of 5)
  const handleAdvanceToNextRound = useCallback(() => {
    const nextRound = roundRef.current + 1;
    if (nextRound > TOTAL_ROUNDS) return;

    sound.playWhistle();

    const nextCondition = getRandomDraftCondition(new Set());
    const nextTurnOrder = computeTurnOrderForRound(contestantsRef.current, nextRound);
    const firstPickerId = nextTurnOrder[0];
    const firstPicker = contestantsRef.current.find((c) => c.id === firstPickerId);

    // Reset contestant boards for Round N+1
    const freshContestants = contestantsRef.current.map((c) => ({
      ...c,
      picks: { FWD: null, MID: null, DEF_1: null, DEF_2: null, GK: null },
      pickConditions: { FWD: null, MID: null, DEF_1: null, DEF_2: null, GK: null },
      readyForNextRound: false,
    }));

    setContestants(freshContestants);
    setUsedConditions([nextCondition]);
    setRound(nextRound);
    setActiveCondition(nextCondition);
    setTurnOrder(nextTurnOrder);
    setCurrentTurnIndex(0);
    setTimeLeftSec(30);
    setDraftedPlayerIds([]);
    setVerdictResult(null);
    setPhase('DRAFTING');

    broadcastEvent({
      action: 'START_NEXT_ROUND',
      phase: 'DRAFTING',
      round: nextRound,
      totalRounds: TOTAL_ROUNDS,
      activeCondition: nextCondition,
      turnOrder: nextTurnOrder,
      currentPickerId: firstPickerId,
      currentPickerName: firstPicker?.name || '',
      draftedPlayerIds: [],
    });
  }, [broadcastEvent]);

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

    const channelId = `room_${roomCode}_presence`;

    const existingChannel = supabase.getChannels().find(
      (ch) => ch.topic === `realtime:${channelId}` || ch.topic === channelId
    );
    if (existingChannel) supabase.removeChannel(existingChannel);

    const channel = supabase.channel(channelId, {
      config: {
        broadcast: { self: false },
        presence: { key: 'host_tv' },
      },
    });

    const syncConnectedPlayers = () => {
      const state = channel.presenceState();
      const playerList: any[] = [];
      const seenIds = new Set<string>();

      Object.values(state).forEach((presences: any) => {
        if (Array.isArray(presences)) {
          presences.forEach((p) => {
            if (p && p.id && p.id !== 'host_tv' && !seenIds.has(p.id)) {
              seenIds.add(p.id);
              playerList.push(p);
            }
          });
        }
      });

      console.log('[TV PRESENCE SYNC] Total Connected Players:', playerList.length, playerList);

      setContestants((prev) => {
        const existingMap = new Map(prev.map((c) => [c.id, c]));
        return playerList.map((entry) => {
          const existing = existingMap.get(entry.id);
          const club = entry.selectedClub || (entry.teamName && entry.teamLogo ? { id: entry.teamId || 'club', name: entry.teamName, league: '', country: '', badgeUrl: entry.teamLogo } : existing?.selectedClub) || null;
          return {
            id: entry.id,
            name: entry.name || existing?.name || 'متسابق',
            isReady: entry.isReady !== undefined ? Boolean(entry.isReady) : (existing?.isReady || false),
            selectedClub: club,
            picks: existing ? existing.picks : { FWD: null, MID: null, DEF_1: null, DEF_2: null, GK: null },
            pickConditions: existing ? existing.pickConditions : { FWD: null, MID: null, DEF_1: null, DEF_2: null, GK: null },
            readyForNextRound: existing?.readyForNextRound || false,
          };
        });
      });
    };

    const handleIncomingDraftEvent = (payload: any) => {
      if (!payload) return;
      const ev = payload as DraftEventPayload;

      if (ev.action === 'LIVE_PICK_COMMITTED') {
        const pId = ev.playerId;
        const sKey = ev.slotKey;
        if (pId && sKey) {
          const playerObj = ev.player || {
            name: ev.pickedPlayerName || 'لاعب',
            photo: '',
            conditionTitle: ev.conditionTitle || '',
            conditionPrompt: '',
          };

          setAllSquads((prev) => {
            const current = prev[pId] || {
              playerId: pId,
              playerName: ev.playerName || '',
              teamLogo: ev.teamLogo,
              selectedClub: ev.selectedClub,
              slots: {},
            };
            return {
              ...prev,
              [pId]: {
                ...current,
                slots: {
                  ...current.slots,
                  [sKey]: {
                    playerName: playerObj.name,
                    playerPhoto: playerObj.photo,
                    conditionTitle: playerObj.conditionTitle,
                    conditionPrompt: playerObj.conditionPrompt,
                  },
                },
              },
            };
          });

          // Also update contestant picks directly
          setContestants((prev) =>
            prev.map((c) => {
              if (c.id !== pId) return c;
              return {
                ...c,
                picks: {
                  ...c.picks,
                  [sKey]: {
                    id: `picked_${playerObj.name}`,
                    name: playerObj.name,
                    photo: playerObj.photo,
                    aliases: [playerObj.name],
                    nationality: '',
                    nationalityCode: '',
                    clubs: [],
                    currentClub: '',
                    position: sKey === 'GK' ? 'GK' : sKey === 'MID' ? 'MID' : sKey === 'FWD' ? 'FWD' : 'DEF',
                    traits: [],
                    trophies: [],
                  },
                },
                pickConditions: {
                  ...(c.pickConditions || { FWD: null, MID: null, DEF_1: null, DEF_2: null, GK: null }),
                  [sKey]: {
                    id: `c_${Date.now()}`,
                    title: playerObj.conditionTitle,
                    rulePrompt: playerObj.conditionPrompt || playerObj.conditionTitle,
                    description: '',
                    rarity: 'common',
                  },
                },
              };
            })
          );

          const posName = DRAFT_POSITION_SHORT_NAMES[sKey] || sKey;
          showToast(`⚡ ${ev.playerName || 'متسابق'} ضم ${playerObj.name} في مركز ${posName}!`);
          sound.playCellClaimed();
        }
      } else if ((ev.action === 'PLAYER_READY' || (ev.action as string) === 'UPDATE_TEAM') && ev.playerId) {
        setContestants((prev) =>
          prev.map((p) => (p.id === ev.playerId ? { ...p, isReady: ev.isReady !== undefined ? Boolean(ev.isReady) : p.isReady, selectedClub: ev.selectedClub || p.selectedClub } : p))
        );
      } else if (ev.action === 'PLAYER_READY' && ev.playerId) {
        setContestants((prev) =>
          prev.map((p) => (p.id === ev.playerId ? { ...p, isReady: Boolean(ev.isReady), selectedClub: ev.selectedClub || p.selectedClub } : p))
        );
      } else if (ev.action === 'PLAYER_NEXT_ROUND_READY' && ev.playerId) {
        sound.playClick();
        setContestants((prev) =>
          prev.map((p) => (p.id === ev.playerId ? { ...p, readyForNextRound: Boolean(ev.isReady) } : p))
        );
      } else if (ev.action === 'PLAYER_LOCKED') {
        const targetName = ev.lockedPlayerName || ev.pickedPlayerName;
        const picker = ev.pickerName || ev.playerName || 'متسابق';
        if (targetName) {
          sound.playNotification();
          showToast(`قام ${picker} باختيار ${targetName}!`);
        }
      } else if (ev.action === 'PLAYER_PICKED' || ev.action === 'PICK_LOCKED') {
        if (ev.playerId && ev.slotKey && ev.pickedPlayerName) {
          const pId = ev.playerId;
          const sKey = ev.slotKey;
          const pName = ev.pickedPlayerName;
          const cId = ev.conditionId || '';
          const cTitle = ev.conditionTitle || '';
          setAllSquads((prev) => {
            const current = prev[pId] || {
              playerId: pId,
              playerName: ev.playerName || '',
              teamLogo: ev.teamLogo,
              selectedClub: ev.selectedClub,
              slots: {},
            };
            return {
              ...prev,
              [pId]: {
                ...current,
                teamLogo: ev.teamLogo || current.teamLogo,
                selectedClub: ev.selectedClub || current.selectedClub,
                slots: {
                  ...current.slots,
                  [sKey]: {
                    playerName: pName,
                    conditionId: cId,
                    conditionTitle: cTitle,
                  },
                },
              },
            };
          });
        }
        if (ev.playerId && ev.pickedPosition && ev.pickedPlayer) {
          handleContestantPick(ev.playerId, ev.pickedPosition, ev.pickedPlayer, ev.appliedCondition);
        }
      } else if ((ev.action === 'DRAFT_COMPLETE' || ev.action === 'PUSH_FINAL_SQUAD') && ev.playerId && ev.squad) {
        const pId = ev.playerId;
        const incomingSquad = ev.squad;
        persistentSquadsRef.current[pId] = incomingSquad;
        setAllSquads((prev) => ({
          ...prev,
          [pId]: incomingSquad,
        }));
        // Also update contestant picks directly
        setContestants((prev) =>
          prev.map((c) => {
            if (c.id !== pId) return c;
            const newPicks = { ...c.picks };
            const newConds = { ...(c.pickConditions || { FWD: null, MID: null, DEF_1: null, DEF_2: null, GK: null }) };
            (Object.keys(incomingSquad.slots || {}) as DraftPosition[]).forEach((pos) => {
              const sl = incomingSquad.slots[pos];
              if (sl && !newPicks[pos]) {
                newPicks[pos] = {
                  id: 'squad_' + pos + '_' + pId,
                  name: sl.playerName,
                  aliases: [sl.playerName],
                  nationality: 'غير محدد',
                  nationalityCode: 'UN',
                  clubs: [],
                  currentClub: 'مخصص',
                  position: pos === 'GK' ? 'GK' : pos === 'MID' ? 'MID' : pos === 'FWD' ? 'FWD' : 'DEF',
                  traits: [],
                  trophies: [],
                };
                newConds[pos] = {
                  id: sl.conditionId || 'c_general',
                  title: sl.conditionTitle || 'شرط معتمد',
                  rulePrompt: sl.conditionTitle || 'شرط معتمد',
                };
              }
            });
            return {
              ...c,
              selectedClub: c.selectedClub || incomingSquad.selectedClub || null,
              picks: newPicks,
              pickConditions: newConds,
            };
          })
        );
      }
    };

    channel
      .on('presence', { event: 'sync' }, syncConnectedPlayers)
      .on('presence', { event: 'join' }, () => {
        sound.playPlayerJoin();
        syncConnectedPlayers();
      })
      .on('presence', { event: 'leave' }, () => {
        syncConnectedPlayers();
      })
      .on('broadcast', { event: 'draft_event' }, ({ payload }) => handleIncomingDraftEvent(payload))
      .on('broadcast', { event: 'draft_action' }, ({ payload }) => handleIncomingDraftEvent(payload))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[TV] Subscribed to presence channel successfully.');
          isSubscribedRef.current = true;
          channel.track({
            id: 'host_tv',
            name: 'شاشة العرض',
            role: 'tv',
            joinedAt: Date.now(),
          });
          syncConnectedPlayers();
        } else {
          isSubscribedRef.current = false;
        }
      });

    channelRef.current = channel;

    return () => {
      isSubscribedRef.current = false;
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

  // Podium champion after Round 5
  const grandPodiumChampion = Object.entries(roundWins).sort((a, b) => b[1] - a[1])[0];
  const grandChampionContestant = grandPodiumChampion
    ? contestants.find((c) => c.id === grandPodiumChampion[0])
    : contestants[0];

  return (
    <div
      className="min-h-screen w-full bg-[#E5E0D5] text-[#2C2A29] flex flex-col font-sans select-none overflow-x-hidden relative"
      dir="rtl"
    >
      {/* Live Toast Notification on TV */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-[#2C2A29] text-[#F7F4EC] border-2 border-[#E5E0D5] py-2.5 px-6 rounded-2xl font-black text-lg shadow-[4px_4px_0px_#C68B59] flex items-center gap-3">
            <span className="text-xl">🔔</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      <DraftTopBar
        title="كوّن فريقك 5"
        roomCode={roomCode}
        round={phase === 'DRAFTING' ? round : undefined}
        totalRounds={TOTAL_ROUNDS}
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
                      بانتظار انضمام المتسابقين واختيار شعارات أنديتهم...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto p-1 mt-3">
                      {contestants.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 bg-[#E5E0D5] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] px-3.5 py-2.5 rounded-2xl"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {p.selectedClub ? (
                              <div className="w-10 h-10 rounded-xl bg-white border border-[#2C2A29] p-1 flex items-center justify-center shrink-0 shadow-sm">
                                <img src={p.selectedClub.badgeUrl} alt={p.selectedClub.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-[#2C2A29]/10 border border-[#2C2A29] flex items-center justify-center shrink-0 font-bold text-xs text-[#5C4033]">
                                ⚽
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-black text-sm text-[#2C2A29] block truncate">{p.name}</span>
                              <span className="text-[11px] font-bold text-[#5C4033] block truncate">
                                {p.selectedClub ? p.selectedClub.name : 'فريق افتراضي'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-2.5 py-1 rounded-xl font-black border border-[#2C2A29] ${
                              p.isReady ? 'bg-[#8A9A5B] text-white' : 'bg-[#F7F4EC] text-[#5C4033]'
                            }`}>
                              {p.isReady ? 'جاهز ✓' : 'في الانتظار'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleKickPlayer(p.id)}
                              className="bg-[#C68B59] hover:bg-[#2C2A29] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-black transition-colors cursor-pointer border border-[#2C2A29]"
                              title="استبعاد المتسابق"
                            >
                              ×
                            </button>
                          </div>
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
                  <span>انطلق - ابدأ الجولة الأولى (من 5)</span>
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

            {/* Massive Hero Condition Card (Clean Condition Without Examples) */}
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
                {currentPicker?.selectedClub ? (
                  <div className="w-11 h-11 rounded-xl bg-white p-1 border-2 border-[#2C2A29] shrink-0">
                    <img src={currentPicker.selectedClub.badgeUrl} alt="" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-[#2C2A29] text-[#F7F4EC] flex items-center justify-center font-black text-xl">
                    {currentTurnIndex + 1}
                  </div>
                )}
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

            {/* Live Multi-Pitch Grid (Abolish Secret TV Mode) */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-black text-[#2C2A29] flex items-center gap-2">
                  <Users size={22} className="text-[#8A9A5B]" />
                  <span>تشكيلات المتسابقين المباشرة (Multi-Pitch Live Grid):</span>
                </h3>
                <span className="text-xs font-black bg-[#8A9A5B] text-white px-3 py-1 rounded-full border border-[#2C2A29] shadow-sm">
                  بث مباشر لحظي ⚡
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {contestants.map((c) => {
                  const isCurrent = c.id === currentPickerId;
                  const squad = allSquads[c.id];
                  const totalPicked = Object.values(c.picks).filter(Boolean).length;

                  return (
                    <div
                      key={c.id}
                      className={`bg-[#F7F4EC] border-3 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-2xl p-4 flex flex-col justify-between transition-all ${
                        isCurrent ? 'ring-4 ring-[#8A9A5B]' : ''
                      }`}
                    >
                      {/* Header: Contestant Name + Club Logo Badge */}
                      <div className="flex items-center justify-between pb-3 border-b-2 border-[#2C2A29] mb-3">
                        <div className="flex items-center gap-2.5">
                          {c.selectedClub && (
                            <img src={c.selectedClub.badgeUrl} alt="" className="w-8 h-8 object-contain shrink-0" />
                          )}
                          <div>
                            <h4 className="font-black text-base text-[#2C2A29] leading-tight">
                              {c.name}
                            </h4>
                            <span className="text-[10px] font-bold text-[#5C4033] block">
                              {c.selectedClub?.name || 'فريق الأحلام'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black bg-[#E5E0D5] text-[#2C2A29] px-2.5 py-1 rounded-xl border border-[#2C2A29]">
                            {totalPicked}/5
                          </span>
                          {isCurrent && (
                            <span className="bg-[#8A9A5B] text-white text-[11px] font-black px-2.5 py-1 rounded-xl border border-[#2C2A29]">
                              دوره الآن 🎯
                            </span>
                          )}
                        </div>
                      </div>

                      {/* The 5 Formation Slots */}
                      <div className="space-y-2">
                        {DRAFT_SLOTS_ORDER.map((pos) => {
                          const pickPlayer = c.picks[pos];
                          const slotData = squad?.slots?.[pos];
                          const pName = pickPlayer?.name || slotData?.playerName;
                          const pPhoto = pickPlayer?.photo || slotData?.playerPhoto;
                          const condTitle = slotData?.conditionTitle || c.pickConditions?.[pos]?.title;
                          const isFilled = Boolean(pName);
                          const posLabel = DRAFT_POSITION_SHORT_NAMES[pos];

                          return (
                            <div key={pos} className="w-full">
                              {isFilled ? (
                                <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] p-2.5 rounded-xl flex items-center justify-between gap-2 shadow-sm">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-white border border-[#2C2A29] flex items-center justify-center overflow-hidden shrink-0">
                                      {pPhoto ? (
                                        <img src={pPhoto} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-xs font-black text-[#5C4033]">{posLabel.charAt(0)}</span>
                                      )}
                                    </div>
                                    <div className="min-w-0 text-right">
                                      <span className="text-xs sm:text-sm font-black text-[#2C2A29] block truncate">
                                        {pName}
                                      </span>
                                      {condTitle && (
                                        <span className="text-[10px] font-bold text-[#8A9A5B] block truncate">
                                          شرط: {condTitle}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <span className="text-[11px] font-black bg-[#8A9A5B] text-white px-2.5 py-0.5 rounded-lg border border-[#2C2A29] shrink-0">
                                    {posLabel}
                                  </span>
                                </div>
                              ) : (
                                <div className="border-2 border-dashed border-[#2C2A29]/40 bg-white/40 rounded-xl p-2.5 flex items-center justify-between text-xs text-[#5C4033]/70 font-bold">
                                  <span className="text-[11px]">{posLabel} - فارغ</span>
                                  <span className="text-[10px] font-mono opacity-60">[{pos}]</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
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
                  المحرك الآلي يفحص مطابقة اللاعبين للشروط الخمسة، ويحدد الأخطاء بدقة!
                </p>
              </div>
            ) : (
              <div className="w-full space-y-8">
                {/* Massive Result Announcement Banner */}
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 bg-[#8A9A5B] text-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] px-4 py-1.5 rounded-xl font-black text-sm">
                    {verdictResult.isTie ? <Swords size={16} /> : <Award size={16} />}
                    <span>{verdictResult.isTie ? 'حسم التعادل التكتيكي المباشر' : `نتيجة الجولة ${round} من ${TOTAL_ROUNDS}`}</span>
                  </div>

                  <h2 className="text-3xl md:text-5xl font-black text-[#2C2A29] leading-tight">
                    {verdictResult.verdictBanner}
                  </h2>

                  {/* Tie-Break Detailed Line Analysis Callout */}
                  {verdictResult.tieBreakAnalysis && (
                    <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-2xl p-4 max-w-2xl mx-auto text-sm font-bold text-[#2C2A29] shadow-sm">
                      {verdictResult.tieBreakAnalysis}
                    </div>
                  )}
                </div>

                {/* Champion Showcase Card */}
                <div className="bg-[#8A9A5B] text-[#F7F4EC] border-3 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-3xl p-6 max-w-2xl mx-auto space-y-2">
                  <span className="text-xs font-black uppercase tracking-wider bg-[#2C2A29] text-white px-3 py-1 rounded-full">
                    {round >= 5 ? 'بطل الدرافت النهائي 🥇' : `بطل الجولة ${round} 🥇`}
                  </span>
                  <div className="flex items-center justify-center gap-3">
                    {verdictResult.winnerClub && (
                      <img src={verdictResult.winnerClub.badgeUrl} alt="" className="w-9 h-9 object-contain" />
                    )}
                    <h3 className="text-3xl font-black">
                      فريق {verdictResult.winnerName}
                    </h3>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-sm font-bold pt-1">
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

                {/* Line-by-Line Showdown Section (المقارنة التكتيكية المباشرة بين الخطوط) */}
                <div className="bg-[#F7F4EC] border-3 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-2xl p-5 w-full text-right space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-[#2C2A29] pb-3">
                    <h3 className="text-xl font-black text-[#2C2A29] flex items-center gap-2">
                      <Swords size={22} className="text-[#8A9A5B]" />
                      <span>المقارنة التكتيكية المباشرة بين الخطوط (Line-by-Line Showdown):</span>
                    </h3>
                    <span className="text-xs font-bold text-[#5C4033]">
                      مقارنة تحليلية لقوة كل خط بين التشكيلات
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 1. Attack Line */}
                    <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#2C2A29] block">خط الهجوم (Attack)</span>
                        <span className="text-[10px] bg-[#8A9A5B] text-white px-1.5 py-0.5 rounded font-black">حسم هجومي</span>
                      </div>
                      <div className="space-y-1.5">
                        {rankedEvaluations.map((ev) => (
                          <div key={ev.playerId} className="flex items-center justify-between text-xs font-bold">
                            <span className="truncate max-w-[120px]">{ev.playerName}</span>
                            <span className="font-mono font-black bg-[#F7F4EC] px-2 py-0.5 rounded border border-[#2C2A29]">
                              {ev.ratings.attack}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 2. Midfield Line */}
                    <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#2C2A29] block">خط الوسط (Midfield)</span>
                        <span className="text-[10px] bg-[#8A9A5B] text-white px-1.5 py-0.5 rounded font-black">تحكم وصناعة</span>
                      </div>
                      <div className="space-y-1.5">
                        {rankedEvaluations.map((ev) => (
                          <div key={ev.playerId} className="flex items-center justify-between text-xs font-bold">
                            <span className="truncate max-w-[120px]">{ev.playerName}</span>
                            <span className="font-mono font-black bg-[#F7F4EC] px-2 py-0.5 rounded border border-[#2C2A29]">
                              {ev.ratings.midfield}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. Defense Line */}
                    <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#2C2A29] block">خط الدفاع (Defense)</span>
                        <span className="text-[10px] bg-[#8A9A5B] text-white px-1.5 py-0.5 rounded font-black">صلابة وتغطية</span>
                      </div>
                      <div className="space-y-1.5">
                        {rankedEvaluations.map((ev) => (
                          <div key={ev.playerId} className="flex items-center justify-between text-xs font-bold">
                            <span className="truncate max-w-[120px]">{ev.playerName}</span>
                            <span className="font-mono font-black bg-[#F7F4EC] px-2 py-0.5 rounded border border-[#2C2A29]">
                              {ev.ratings.defense}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 4. Goalkeeping Line */}
                    <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#2C2A29] block">حراسة المرمى (GK)</span>
                        <span className="text-[10px] bg-[#8A9A5B] text-white px-1.5 py-0.5 rounded font-black">ردات فعل وأمان</span>
                      </div>
                      <div className="space-y-1.5">
                        {rankedEvaluations.map((ev) => (
                          <div key={ev.playerId} className="flex items-center justify-between text-xs font-bold">
                            <span className="truncate max-w-[120px]">{ev.playerName}</span>
                            <span className="font-mono font-black bg-[#F7F4EC] px-2 py-0.5 rounded border border-[#2C2A29]">
                              {ev.ratings.gk}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Squads Verification Cards Side by Side with Explicit Error Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full text-right">
                  {rankedEvaluations.map((ev, idx) => {
                    const contestant = contestants.find((c) => c.id === ev.playerId);
                    const squadBackup = allSquads[ev.playerId];
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
                          {/* Card Header: Name + Club Badge + Conditions Met */}
                          <div className="flex items-center justify-between pb-3 border-b-2 border-[#2C2A29]">
                            <div className="flex items-center gap-2">
                              {ev.selectedClub && (
                                <img src={ev.selectedClub.badgeUrl} alt="" className="w-8 h-8 object-contain shrink-0" />
                              )}
                              <div>
                                <span className="text-xs font-black text-[#8A9A5B]">
                                  المركز #{idx + 1}
                                </span>
                                <h4 className="text-lg font-black text-[#2C2A29] leading-tight">
                                  {ev.playerName}
                                </h4>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-black bg-[#8A9A5B] text-white px-2.5 py-1 rounded-xl border border-[#2C2A29]">
                                {ev.validConditionsCount}/5 شروط
                              </span>
                              <span className="text-[11px] font-mono font-black text-[#5C4033] mt-0.5">
                                {ev.overallPercentage}% قوة
                              </span>
                            </div>
                          </div>

                          {/* 5 Players Verification List with Explicit Condition & Position Badges */}
                          <div className="space-y-2.5 my-3">
                            <span className="text-[10px] font-black uppercase text-[#5C4033] block">
                              فحص مطابقة الشروط والمراكز:
                            </span>
                            {DRAFT_SLOTS_ORDER.map((pos) => {
                              const p = picks ? picks[pos] : null;
                              const ver = ev.conditionVerifications.find((v) => v.position === pos);
                              const isValid = ver?.isValid ?? false;
                              const isPosValid = ver?.isPositionValid ?? true;
                              const playerName = p?.name || squadBackup?.slots?.[pos]?.playerName || ver?.playerName || 'لم يحدد';
                              const condTitle = ver?.conditionTitle || squadBackup?.slots?.[pos]?.conditionTitle || contestant?.pickConditions?.[pos]?.title || 'شرط الجولة';
                              const reasonText = ver?.reason || (isValid ? 'حقق الشرط المطلوب بنجاح.' : 'لم يتم استيفاء معايير الشرط.');
                              const posReasonText = ver?.positionReason || (isPosValid ? 'المركز سليم وتمركز تكتيكي مناسب.' : 'المركز غير مطابق!');

                              return (
                                <div
                                  key={pos}
                                  className="bg-[#E5E0D5] border-2 border-[#2C2A29] p-2.5 rounded-xl mb-2 text-right shadow-sm space-y-1.5"
                                >
                                  {/* Slot Position Name and Two Badges */}
                                  <div className="flex items-center justify-between">
                                    <span className="font-black text-xs text-[#2C2A29]">
                                      {DRAFT_POSITION_SHORT_NAMES[pos]}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      {/* Condition Badge */}
                                      <span
                                        className={`text-[11px] font-black px-2 py-0.5 rounded border border-[#2C2A29] ${
                                          isValid ? 'bg-[#8A9A5B] text-white' : 'bg-[#C68B59] text-white'
                                        }`}
                                      >
                                        {isValid ? '✓ الشرط محقق' : '✗ الشرط غير محقق'}
                                      </span>
                                      {/* Position Badge */}
                                      <span
                                        className={`text-[11px] font-black px-2 py-0.5 rounded border border-[#2C2A29] ${
                                          isPosValid ? 'bg-[#8A9A5B] text-white' : 'bg-[#C68B59] text-white'
                                        }`}
                                      >
                                        {isPosValid ? '✓ المركز سليم' : '✗ المركز خاطئ'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="font-black text-sm text-[#2C2A29]">
                                    {playerName}
                                  </div>

                                  <div className="text-[11px] font-bold text-[#2C2A29]/80">
                                    الشرط المطلوب: {condTitle}
                                  </div>

                                  {/* Analytical Notes */}
                                  <div className="space-y-1 pt-1">
                                    <div className="text-[11px] font-bold text-[#2C2A29] bg-[#F7F4EC] p-1.5 rounded border border-[#2C2A29]/30">
                                      {reasonText}
                                    </div>
                                    {!isPosValid && (
                                      <div className="text-[11px] font-bold text-[#2C2A29] bg-[#F7F4EC] p-1.5 rounded border border-[#C68B59]">
                                        {posReasonText}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Tactical Line Ratings (Head-to-Head Line Comparison) */}
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

                {/* Round Controls */}
                <div className="flex items-center justify-center gap-4 pt-4">
                  {round < TOTAL_ROUNDS ? (
                    <button
                      onClick={handleAdvanceToNextRound}
                      className="bg-[#C68B59] hover:bg-[#B57A48] text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none py-3.5 px-8 rounded-xl font-black text-base flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <ArrowRight size={18} />
                      <span>بدء الجولة التالية ({round + 1} من {TOTAL_ROUNDS})</span>
                    </button>
                  ) : (
                    <div className="text-center space-y-3">
                      <div className="bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] px-6 py-3 rounded-2xl font-black text-xl">
                        🏆 منصة التتويج الكبرى: {grandChampionContestant?.name} توج بطلاً للدرافت!
                      </div>
                      <button
                        onClick={() => {
                          sound.playClick();
                          setPhase('LOBBY');
                          setRound(1);
                          setDraftedPlayerIds([]);
                          setVerdictResult(null);
                          setRoundWins({});
                          broadcastEvent({ action: 'RESET_LOBBY' });
                        }}
                        className="bg-[#F7F4EC] hover:bg-white text-[#2C2A29] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] py-3 px-6 rounded-xl font-black text-sm flex items-center gap-2 mx-auto cursor-pointer"
                      >
                        <RotateCcw size={16} />
                        <span>إعادة اللعبة والعودة للوبي</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
