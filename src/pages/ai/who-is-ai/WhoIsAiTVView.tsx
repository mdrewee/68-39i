// src/pages/ai/who-is-ai/WhoIsAiTVView.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  Play,
  RotateCcw,
  Clock,
  HelpCircle,
  Copy,
  Check,
  Maximize,
  Minimize,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Bot
} from 'lucide-react';
import { useRoom, roomBus, cleanRoomCode } from '../../../lib/roomBus';
import { sound } from '../../../lib/audio';
import { supabase } from '../../../lib/supabase';
import { AVATARS_POOL, getAvatarById } from './avatars';
import {
  WhoIsAiPhase,
  Suspect,
  RoomQuestion,
  RoomAnswer,
  VoteSubmission,
  RoundScoreResult,
  WhoIsAiGameState
} from './types';
import { QRCodeView } from '../../../components/common/QRCodeView';
import { VerticalSinglePageQABoard } from './components/VerticalSinglePageQABoard';
import { GameTopBar } from './components/GameTopBar';
import { generateContextualAiQuestion } from './services/aiQuestionGenerator';
import { RouletteReveal } from './components/RouletteReveal';
import { calculateRoundScores, formatPt } from './services/scoringConfig';
import { generateAiQuestion, generateAiAnswers } from './services/aiAnswerEngine';

const TOTAL_ROUNDS = 3;
const QUESTION_TIMER_SECONDS = 35;
const ANSWER_TIMER_SECONDS = 60;
const VOTING_TIMER_SECONDS = 30;

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const WhoIsAiTVView: React.FC = () => {
  const params = useParams();
  const rawCode = (params.code || params.roomId || params.id || '').trim().toUpperCase() || 'TAQ1';
  const roomId = cleanRoomCode(rawCode);
  const navigate = useNavigate();

  const { room } = useRoom(roomId);
  const activeRoom = room || roomBus.getRoom(roomId) || roomBus.createRoom(roomId);

  useEffect(() => {
    if (activeRoom && activeRoom.selectedGameId !== 'who-is-ai') {
      activeRoom.selectedGameId = 'who-is-ai';
      roomBus.saveRoom(activeRoom);
      roomBus.emit('STATE_UPDATED', roomId, activeRoom);
    }
  }, [roomId, activeRoom]);

  // Connected players excluding TV
  const players = useMemo(() => {
    return (activeRoom.players || []).filter((p) => p && p.id && p.id !== 'host_tv');
  }, [activeRoom.players]);
  const canStartGame = players.length >= 2;

  // Game States
  const [phase, setPhase] = useState<WhoIsAiPhase>('LOBBY');
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const [questions, setQuestions] = useState<RoomQuestion[]>([]);
  const [answers, setAnswers] = useState<RoomAnswer[]>([]);
  const [votes, setVotes] = useState<VoteSubmission[]>([]);
  const [scoreResult, setScoreResult] = useState<RoundScoreResult | null>(null);
  const [cumulativeScores, setCumulativeScores] = useState<Record<string, number>>({});
  const [aiCumulativeScore, setAiCumulativeScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [currentShowcaseIndex, setCurrentShowcaseIndex] = useState<number>(0);

  // Submissions tracking
  const [submittedQuestionPlayerIds, setSubmittedQuestionPlayerIds] = useState<string[]>([]);
  const [submittedAnswerPlayerIds, setSubmittedAnswerPlayerIds] = useState<string[]>([]);
  const [readyPlayersMap, setReadyPlayersMap] = useState<Record<string, boolean>>({});
  const [readyPlayerIds, setReadyPlayerIds] = useState<Set<string>>(new Set());

  // TopBar controls
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const channelRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const phaseRef = useRef<WhoIsAiPhase>(phase);
  const suspectsRef = useRef<Suspect[]>(suspects);
  const questionsRef = useRef<RoomQuestion[]>(questions);
  const answersRef = useRef<RoomAnswer[]>(answers);
  const votesRef = useRef<VoteSubmission[]>(votes);
  const cumulativeScoresRef = useRef<Record<string, number>>(cumulativeScores);
  const aiCumulativeScoreRef = useRef<number>(aiCumulativeScore);
  const aiGeneratingRef = useRef<boolean>(false);
  const aiGeneratedRef = useRef<boolean>(false);

  const triggerAiGeneration = useCallback(async () => {
    if (aiGeneratingRef.current || aiGeneratedRef.current) return;
    const curSuspects = suspectsRef.current;
    const aiSuspect = curSuspects.find((s) => s.isAi);
    if (!aiSuspect) return;

    aiGeneratingRef.current = true;
    try {
      const curQuestions = questionsRef.current;
      const curAnswers = answersRef.current;
      const aiAnswersMap = await generateAiAnswers(
        aiSuspect.avatarName,
        curQuestions,
        curAnswers
      );

      setAnswers((prev) => {
        const updated = [...prev];
        curQuestions.forEach((q) => {
          const ansText = aiAnswersMap[q.id] || 'ما أدري والله بس الوضع مريب';
          if (!updated.some((a) => a.questionId === q.id && a.responderAvatarId === aiSuspect.avatarId)) {
            updated.push({
              questionId: q.id,
              responderAvatarId: aiSuspect.avatarId,
              responderAvatarName: aiSuspect.avatarName,
              text: ansText,
              isAi: true
            });
          }
        });
        answersRef.current = updated;
        return updated;
      });
      aiGeneratedRef.current = true;
    } finally {
      aiGeneratingRef.current = false;
    }
  }, []);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { suspectsRef.current = suspects; }, [suspects]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { votesRef.current = votes; }, [votes]);
  useEffect(() => { cumulativeScoresRef.current = cumulativeScores; }, [cumulativeScores]);
  useEffect(() => { aiCumulativeScoreRef.current = aiCumulativeScore; }, [aiCumulativeScore]);

  // Broadcast helper
  const broadcastToRoom = useCallback((event: string, payload: any) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event,
        payload
      });
    }
  }, []);

  // Broadcast Authoritative Game Sync
  const broadcastSyncState = useCallback((targetPlayerId?: string) => {
    const curSuspects = suspectsRef.current;
    const curQuestions = questionsRef.current;
    const curAnswers = answersRef.current;
    const curPhase = phaseRef.current;

    // Build player avatar mapping: playerId -> avatarId
    const playerAvatarMap: Record<string, string> = {};
    curSuspects.forEach((s) => {
      if (s.realPlayerId) {
        playerAvatarMap[s.realPlayerId] = s.avatarId;
      }
    });

    // Mask suspects list for players (hide isAi and real identity during gameplay)
    const publicSuspects = curSuspects.map((s) => ({
      avatarId: s.avatarId,
      avatarName: s.avatarName,
      iconName: s.iconName,
      bgTone: s.bgTone,
      isAi: curPhase === 'REVEAL' ? s.isAi : false,
      realPlayerName: curPhase === 'REVEAL' ? s.realPlayerName : undefined
    }));

    const payload = {
      phase: curPhase,
      round: currentRound,
      totalRounds: TOTAL_ROUNDS,
      suspects: publicSuspects,
      playerAvatarMap,
      questions: curQuestions.map((q) => ({
        id: q.id,
        text: q.text,
        askerAvatarId: q.askerAvatarId,
        askerAvatarName: q.askerAvatarName
      })),
      answers: curAnswers,
      currentShowcaseIndex,
      scoreResult: curPhase === 'REVEAL' ? scoreResult : null,
      cumulativeScores: cumulativeScoresRef.current,
      aiCumulativeScore: aiCumulativeScoreRef.current,
      targetPlayerId
    };

    broadcastToRoom('WHO_IS_AI_STATE_SYNC', payload);
  }, [broadcastToRoom, currentRound, currentShowcaseIndex, scoreResult]);

  const handleIncomingQuestion = (payload: any) => {
    if (!payload || (phaseRef.current !== 'QUESTIONS' && phaseRef.current !== 'QUESTION_INPUT')) return;
    const playerId = payload.playerId;
    const text = (payload.questionText || payload.text || '').trim();
    if (!playerId || !text) return;

    sound.playClick();
    setSubmittedQuestionPlayerIds((prev) => {
      if (prev.includes(playerId)) return prev;
      return [...prev, playerId];
    });

    setQuestions((prev) => {
      const suspect = suspectsRef.current.find((s) => s.realPlayerId === playerId);
      if (!suspect) return prev;

      const exists = prev.some((q) => q.realPlayerId === playerId);
      if (exists) {
        return prev.map((q) => (q.realPlayerId === playerId ? { ...q, text } : q));
      }
      return [
        ...prev,
        {
          id: `q_${playerId}`,
          text,
          askerAvatarId: suspect.avatarId,
          askerAvatarName: suspect.avatarName,
          isAi: false,
          realPlayerId: playerId
        }
      ];
    });
  };

  // Realtime Channel Setup
  useEffect(() => {
    const channelName = `room:${roomId.trim().toUpperCase()}`;
    const existingChannels = supabase.getChannels().filter(
      (ch: any) =>
        ch.topic === `realtime:${channelName}` ||
        ch.topic === channelName ||
        ch.topic === `realtime:who_is_ai_${roomId}` ||
        ch.topic === `who_is_ai_${roomId}`
    );
    existingChannels.forEach((existing: any) => {
      try {
        supabase.removeChannel(existing);
      } catch (e) {
        console.warn('[Channel Remove Warn]:', e);
      }
    });

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true, ack: true }
      }
    });

    channel
      .on('broadcast', { event: 'REQUEST_ROOM_STATE' }, ({ payload }: { payload: any }) => {
        console.log('[TV] Received REQUEST_ROOM_STATE from', payload?.playerId);
        if (phaseRef.current !== 'LOBBY') {
          const playerAssignments: Record<string, any> = {};
          suspectsRef.current.forEach((s) => {
            if (s.realPlayerId) {
              playerAssignments[s.realPlayerId] = {
                id: s.avatarId,
                name: s.avatarName,
                iconName: s.iconName,
                icon: s.iconName,
                bgTone: s.bgTone
              };
            }
          });
          const aiSuspect = suspectsRef.current.find((s) => s.isAi);
          const aiAvatar = aiSuspect ? {
            id: aiSuspect.avatarId,
            name: aiSuspect.avatarName,
            iconName: aiSuspect.iconName,
            icon: aiSuspect.iconName,
            bgTone: aiSuspect.bgTone
          } : null;

          channel.send({
            type: 'broadcast',
            event: 'ROOM_STATE_SYNC',
            payload: {
              phase: phaseRef.current,
              assignments: playerAssignments,
              aiAvatar,
              questions: questionsRef.current.map((q) => ({
                id: q.id,
                text: q.text,
                askerAvatarId: q.askerAvatarId,
                askerAvatarName: q.askerAvatarName
              }))
            }
          });
        }
        broadcastSyncState(payload?.playerId);
      })
      .on('broadcast', { event: 'REQUEST_PHASE_SYNC' }, ({ payload }: { payload: any }) => {
        const requestingPlayerId = payload?.playerId;
        broadcastSyncState(requestingPlayerId);
      })
      .on('broadcast', { event: 'PLAYER_READY_TOGGLE' }, ({ payload }: { payload: any }) => {
        if (!payload?.playerId) return;
        sound.playClick();
        setReadyPlayerIds((prev) => {
          const next = new Set(prev);
          if (payload.isReady) {
            next.add(payload.playerId);
          } else {
            next.delete(payload.playerId);
          }
          return next;
        });
        setReadyPlayersMap((prev) => ({
          ...prev,
          [payload.playerId]: Boolean(payload.isReady)
        }));
      })
      .on('broadcast', { event: 'PLAYER_READY' }, ({ payload }: { payload: any }) => {
        if (!payload?.playerId) return;
        sound.playClick();
        setReadyPlayerIds((prev) => {
          const next = new Set(prev);
          if (payload.isReady) {
            next.add(payload.playerId);
          } else {
            next.delete(payload.playerId);
          }
          return next;
        });
        setReadyPlayersMap((prev) => ({
          ...prev,
          [payload.playerId]: Boolean(payload.isReady)
        }));
      })
      .on('broadcast', { event: 'SUBMIT_QUESTION' }, ({ payload }: { payload: any }) => {
        handleIncomingQuestion(payload);
      })
      .on('broadcast', { event: 'WHO_IS_AI_SUBMIT_QUESTION' }, ({ payload }: { payload: any }) => {
        handleIncomingQuestion(payload);
      })
      .on('broadcast', { event: 'SUBMIT_ALL_ANSWERS' }, ({ payload }: { payload: any }) => {
        if (!payload) return;
        const { playerId, answers, answersMap } = payload;
        if (!playerId) return;

        sound.playClick();
        setSubmittedAnswerPlayerIds((prev) => {
          if (prev.includes(playerId)) return prev;
          return [...prev, playerId];
        });

        const suspect = suspectsRef.current.find((s) => s.realPlayerId === playerId);
        if (!suspect) return;

        setAnswers((prev) => {
          const updated = prev.filter((a) => a.realPlayerId !== playerId);
          if (Array.isArray(answers)) {
            answers.forEach((ans) => {
              updated.push({
                questionId: ans.questionId,
                responderAvatarId: suspect.avatarId,
                responderAvatarName: suspect.avatarName,
                text: (ans.answerText || ans.text || '').trim(),
                isAi: false,
                realPlayerId: playerId
              });
            });
          } else if (answersMap) {
            Object.keys(answersMap).forEach((qId) => {
              const txt = answersMap[qId];
              if (txt && typeof txt === 'string' && txt.trim().length > 0) {
                updated.push({
                  questionId: qId,
                  responderAvatarId: suspect.avatarId,
                  responderAvatarName: suspect.avatarName,
                  text: txt.trim(),
                  isAi: false,
                  realPlayerId: playerId
                });
              }
            });
          }
          return updated;
        });
      })
      .on('broadcast', { event: 'SUBMIT_VOTE' }, ({ payload }: { payload: any }) => {
        if (!payload) return;
        const { voterPlayerId, targetAvatar } = payload;
        if (!voterPlayerId || !targetAvatar) return;

        sound.playBuzzer();
        const voterSuspect = suspectsRef.current.find((s) => s.realPlayerId === voterPlayerId);
        const targetSuspect = suspectsRef.current.find(
          (s) => s.avatarName === targetAvatar || s.avatarId === targetAvatar
        );

        setVotes((prev) => {
          const filtered = prev.filter((v) => v.voterPlayerId !== voterPlayerId);
          return [
            ...filtered,
            {
              voterPlayerId,
              voterAvatarId: voterSuspect ? voterSuspect.avatarId : voterPlayerId,
              targetAvatarId: targetSuspect ? targetSuspect.avatarId : targetAvatar
            }
          ];
        });
      })
      .on('broadcast', { event: 'WHO_IS_AI_SUBMIT_ANSWERS' }, ({ payload }: { payload: any }) => {
        if (!payload || phaseRef.current !== 'ANSWERS') return;
        const { playerId, answersMap } = payload;
        if (!playerId || !answersMap) return;

        sound.playClick();
        setSubmittedAnswerPlayerIds((prev) => {
          if (prev.includes(playerId)) return prev;
          return [...prev, playerId];
        });

        const suspect = suspectsRef.current.find((s) => s.realPlayerId === playerId);
        if (!suspect) return;

        setAnswers((prev) => {
          const updated = prev.filter((a) => a.realPlayerId !== playerId);
          Object.keys(answersMap).forEach((qId) => {
            const txt = answersMap[qId];
            if (txt && typeof txt === 'string' && txt.trim().length > 0) {
              updated.push({
                questionId: qId,
                responderAvatarId: suspect.avatarId,
                responderAvatarName: suspect.avatarName,
                text: txt.trim(),
                isAi: false,
                realPlayerId: playerId
              });
            }
          });
          return updated;
        });
      })
      .on('broadcast', { event: 'WHO_IS_AI_SUBMIT_VOTE' }, ({ payload }: { payload: any }) => {
        if (!payload || phaseRef.current !== 'VOTING') return;
        const { voterPlayerId, voterAvatarId, targetAvatarId } = payload;
        if (!voterPlayerId || !targetAvatarId) return;

        sound.playBuzzer();
        setVotes((prev) => {
          const filtered = prev.filter((v) => v.voterPlayerId !== voterPlayerId);
          return [...filtered, { voterPlayerId, voterAvatarId, targetAvatarId }];
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[TV] Subscribed to who_is_ai channel:', channelName);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, broadcastSyncState]);

  // Timer Tick
  useEffect(() => {
    if (timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timeLeft]);

  // Start Questions Phase
  const startQuestionsPhase = useCallback(async (targetRound?: number | unknown) => {
    if (players.length < 2 || players.length > 7) return;
    aiGeneratingRef.current = false;
    aiGeneratedRef.current = false;

    sound.playClick();
    // Fresh shuffle of avatars for all players + AI each round
    const shuffledAvatars = shuffle(AVATARS_POOL);

    // Assign 1 secret avatar per human + 1 secret avatar for AI
    const assignedSuspects: Suspect[] = [];
    players.forEach((p, idx) => {
      const av = shuffledAvatars[idx];
      assignedSuspects.push({
        avatarId: av.id,
        avatarName: av.name,
        iconName: av.iconName,
        bgTone: av.bgTone,
        isAi: false,
        realPlayerId: p.id,
        realPlayerName: p.name
      });
    });

    // Infiltrator AI Suspect
    const aiAv = shuffledAvatars[players.length];
    assignedSuspects.push({
      avatarId: aiAv.id,
      avatarName: aiAv.name,
      iconName: aiAv.iconName,
      bgTone: aiAv.bgTone,
      isAi: true
    });

    const randomizedSuspects = shuffle(assignedSuspects);
    setSuspects(randomizedSuspects);
    suspectsRef.current = randomizedSuspects;

    setQuestions([]);
    questionsRef.current = [];
    setAnswers([]);
    answersRef.current = [];
    setVotes([]);
    votesRef.current = [];
    setScoreResult(null);
    setSubmittedQuestionPlayerIds([]);
    setSubmittedAnswerPlayerIds([]);
    setCurrentShowcaseIndex(0);

    setPhase('QUESTION_INPUT');
    phaseRef.current = 'QUESTION_INPUT';
    setTimeLeft(QUESTION_TIMER_SECONDS);

    // Build assignments mapping: playerId -> avatarName
    const assignments: Record<string, string> = {};
    const playerAvatarMap: Record<string, string> = {};
    randomizedSuspects.forEach((s) => {
      if (s.realPlayerId) {
        assignments[s.realPlayerId] = s.avatarName;
        playerAvatarMap[s.realPlayerId] = s.avatarId;
      }
    });

    const roundNum = typeof targetRound === 'number' ? targetRound : currentRound;

    const startPayload = {
      phase: 'QUESTION_INPUT',
      assignments,
      playerAvatarMap,
      allAvatars: randomizedSuspects.map((s) => s.avatarName),
      aiAvatar: aiAv.name,
      durationSeconds: QUESTION_TIMER_SECONDS,
      round: roundNum
    };

    broadcastToRoom('START_QUESTION_PHASE', startPayload);
    broadcastToRoom('START_QUESTIONS_PHASE', startPayload);

    setTimeout(() => {
      broadcastSyncState();
    }, 200);
  }, [players, currentRound, broadcastToRoom, broadcastSyncState]);

  // Transition from QUESTIONS to ANSWERS
  const startAnswersPhase = useCallback(async () => {
    sound.playClick();

    const curSuspects = suspectsRef.current;
    const curQuestions = [...questionsRef.current];

    const aiSuspect = curSuspects.find((s) => s.isAi);
    if (aiSuspect && !curQuestions.some((q) => q.isAi)) {
      const humanTexts = curQuestions.filter((q) => !q.isAi).map((q) => q.text);
      const contextualText = await generateContextualAiQuestion(humanTexts, aiSuspect.avatarName);
      curQuestions.push({
        id: `q_ai_${Date.now()}`,
        text: contextualText,
        askerAvatarId: aiSuspect.avatarId,
        askerAvatarName: aiSuspect.avatarName,
        isAi: true
      });
    }

    curSuspects.filter((s) => !s.isAi).forEach((s) => {
      if (!curQuestions.some((q) => q.askerAvatarId === s.avatarId)) {
        curQuestions.push({
          id: `q_fallback_${s.avatarId}`,
          text: 'وش أكثر تصرف ينرفزك بالجمعات وتكتم غيظك؟',
          askerAvatarId: s.avatarId,
          askerAvatarName: s.avatarName,
          isAi: false,
          realPlayerId: s.realPlayerId
        });
      }
    });

    const finalizedQuestions = shuffle(curQuestions);
    setQuestions(finalizedQuestions);
    questionsRef.current = finalizedQuestions;

    setPhase('ANSWERS');
    phaseRef.current = 'ANSWERS';
    setTimeLeft(ANSWER_TIMER_SECONDS);
    setSubmittedAnswerPlayerIds([]);

    const allAvatars = curSuspects.map((s) => s.avatarName);
    const answersQuestions = finalizedQuestions.map((q) => ({
      id: q.id,
      questionText: q.text,
      text: q.text,
      askerAvatar: q.askerAvatarName
    }));
    broadcastToRoom('START_ANSWERING_PHASE', {
      phase: 'ANSWERING_SWIPE',
      durationSeconds: ANSWER_TIMER_SECONDS,
      questions: answersQuestions,
      allAvatars
    });
    broadcastToRoom('START_ANSWERS_PHASE', {
      phase: 'ANSWERING_SWIPE',
      durationSeconds: ANSWER_TIMER_SECONDS,
      questions: answersQuestions,
      allAvatars
    });

    setTimeout(() => {
      broadcastSyncState();
    }, 200);

    aiGeneratingRef.current = false;
    aiGeneratedRef.current = false;
  }, [broadcastToRoom, broadcastSyncState]);

  // Transition from ANSWERS to SHOWCASE
  const startShowcasePhase = useCallback(async () => {
    sound.playVictory();

    const curSuspects = suspectsRef.current;
    const curQuestions = questionsRef.current;
    const aiSuspect = curSuspects.find((s) => s.isAi);

    // Ensure AI answers are generated if not yet ready
    if (aiSuspect && !aiGeneratedRef.current) {
      try {
        await triggerAiGeneration();
      } catch {
        // Fallbacks applied below
      }
    }

    const curAnswers = [...answersRef.current];

    // Guarantee every question has an entry from every avatar; missing human answers filled with "—"
    curQuestions.forEach((q) => {
      curSuspects.forEach((s) => {
        const hasAns = curAnswers.some((a) => a.questionId === q.id && a.responderAvatarId === s.avatarId);
        if (!hasAns) {
          const defaultText = s.isAi ? 'والله مدري' : '—';
          curAnswers.push({
            questionId: q.id,
            responderAvatarId: s.avatarId,
            responderAvatarName: s.avatarName,
            text: defaultText,
            isAi: s.isAi,
            realPlayerId: s.realPlayerId
          });
        }
      });
    });

    setAnswers(curAnswers);
    answersRef.current = curAnswers;

    setPhase('SHOWCASE');
    phaseRef.current = 'SHOWCASE';
    setCurrentShowcaseIndex(0);
    setTimeLeft(0);

    const showcasePayload = {
      phase: 'SHOWCASE_BOARD',
      questions: curQuestions.map((q) => ({
        id: q.id,
        questionText: q.text,
        text: q.text,
        askerAvatar: q.askerAvatarName
      })),
      answers: curAnswers.map((a) => ({
        questionId: a.questionId,
        responderAvatar: a.responderAvatarName,
        responderPlayerId: a.realPlayerId || (a.isAi ? 'ai_bot' : 'unknown'),
        answerText: a.text
      }))
    };

    broadcastToRoom('START_SHOWCASE_PHASE', showcasePayload);

    setTimeout(() => {
      broadcastSyncState();
    }, 200);
  }, [broadcastToRoom, broadcastSyncState, triggerAiGeneration]);

  // Transition from SHOWCASE to VOTING
  const startVotingPhase = useCallback(() => {
    sound.playTick();
    setVotes([]);
    votesRef.current = [];

    setPhase('VOTING');
    phaseRef.current = 'VOTING';
    setTimeLeft(VOTING_TIMER_SECONDS);

    const curSuspects = suspectsRef.current;
    const curQuestions = questionsRef.current;
    const curAnswers = answersRef.current;

    broadcastToRoom('START_VOTING_PHASE', {
      durationSeconds: VOTING_TIMER_SECONDS,
      allAvatars: curSuspects.map((s) => s.avatarName),
      questions: curQuestions.map((q) => ({
        id: q.id,
        questionText: q.text,
        text: q.text,
        askerAvatar: q.askerAvatarName
      })),
      answers: curAnswers.map((a) => ({
        questionId: a.questionId,
        responderAvatar: a.responderAvatarName,
        responderPlayerId: a.realPlayerId || (a.isAi ? 'ai_bot' : 'unknown'),
        answerText: a.text
      }))
    });

    setTimeout(() => {
      broadcastSyncState();
    }, 200);
  }, [broadcastToRoom, broadcastSyncState]);

  // Transition from VOTING to REVEAL
  const startRevealPhase = useCallback(() => {
    sound.playVictory();

    const curSuspects = suspectsRef.current;
    const curVotes = votesRef.current;
    const curCumScores = cumulativeScoresRef.current;
    const curAiScore = aiCumulativeScoreRef.current;

    const result = calculateRoundScores(curSuspects, curVotes, curCumScores, curAiScore);
    setScoreResult(result);
    setCumulativeScores(result.playerPoints);
    cumulativeScoresRef.current = result.playerPoints;
    setAiCumulativeScore(result.aiPoints);
    aiCumulativeScoreRef.current = result.aiPoints;

    setPhase('REVEAL');
    phaseRef.current = 'REVEAL';
    setTimeLeft(0);

    broadcastToRoom('ROULETTE_REVEAL', { scoreResult: result });
    broadcastToRoom('START_REVEAL_PHASE', { scoreResult: result });

    setTimeout(() => {
      broadcastSyncState();
    }, 200);
  }, [broadcastToRoom, broadcastSyncState]);

  // Trigger AI answering when majority of players submit or time is running low
  useEffect(() => {
    if (phase === 'ANSWERS' && !aiGeneratingRef.current && !aiGeneratedRef.current) {
      const totalPlayers = players.length;
      const submittedCount = submittedAnswerPlayerIds.length;
      const majoritySubmitted = totalPlayers > 0 && submittedCount >= Math.ceil(totalPlayers * 0.5);
      const timeRunningLow = timeLeft <= 15 && timeLeft > 0;

      if (majoritySubmitted || timeRunningLow) {
        triggerAiGeneration();
      }
    }
  }, [phase, timeLeft, submittedAnswerPlayerIds.length, players.length, triggerAiGeneration]);

  // Auto-advance triggers based on timers
  useEffect(() => {
    if (timeLeft === 0) {
      if (phase === 'QUESTIONS' || phase === 'QUESTION_INPUT') {
        startAnswersPhase();
      } else if (phase === 'ANSWERS') {
        startShowcasePhase();
      } else if (phase === 'VOTING') {
        startRevealPhase();
      }
    }
  }, [timeLeft, phase, startAnswersPhase, startShowcasePhase, startRevealPhase]);

  // Early trigger when all players submitted questions
  useEffect(() => {
    if (
      (phase === 'QUESTIONS' || phase === 'QUESTION_INPUT') &&
      players.length > 0 &&
      submittedQuestionPlayerIds.length >= players.length
    ) {
      const timeout = setTimeout(() => {
        startAnswersPhase();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [phase, submittedQuestionPlayerIds.length, players.length, startAnswersPhase]);

  // Early trigger when all players submitted answers
  useEffect(() => {
    if (phase === 'ANSWERS' && players.length > 0 && submittedAnswerPlayerIds.length >= players.length) {
      const timeout = setTimeout(() => {
        startShowcasePhase();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [phase, submittedAnswerPlayerIds.length, players.length, startShowcasePhase]);

  // Early trigger when all players voted
  useEffect(() => {
    if (phase === 'VOTING' && players.length > 0 && votes.length >= players.length) {
      const timeout = setTimeout(() => {
        startRevealPhase();
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [phase, votes.length, players.length, startRevealPhase]);

  const handleNextRound = () => {
    if (currentRound >= TOTAL_ROUNDS) {
      setPhase('GAME_OVER');
      phaseRef.current = 'GAME_OVER';
      broadcastToRoom('START_GAME_OVER_PHASE', {});
      broadcastSyncState();
    } else {
      const nextRound = currentRound + 1;
      setCurrentRound(nextRound);
      startQuestionsPhase(nextRound);
    }
  };

  const handleKickPlayer = async (targetPlayerId: string) => {
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'KICK_PLAYER',
        payload: { playerId: targetPlayerId }
      });
    }
    roomBus.kickPlayer(roomId, targetPlayerId);
  };

  const handleReturnToLobby = () => {
    setPhase('LOBBY');
    phaseRef.current = 'LOBBY';
    setSuspects([]);
    setQuestions([]);
    setAnswers([]);
    setVotes([]);
    setScoreResult(null);
    setCurrentRound(1);
    setReadyPlayerIds(new Set());
    setReadyPlayersMap({});
    broadcastToRoom('RETURN_TO_LOBBY', {});
    broadcastSyncState();
  };

  const handleEndGame = () => {
    if (window.confirm('هل أنت متأكد من إنهاء اللعبة لجميع الأجهزة والعودة للرئيسية؟')) {
      broadcastToRoom('GAME_TERMINATED', {});
      broadcastToRoom('ROOM_TERMINATED', {});
      navigate('/');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="w-screen h-screen bg-[#E5E0D5] text-[#2C2A29] flex flex-col font-sans select-none overflow-hidden" dir="rtl">
      {/* Global TopBar */}
      <GameTopBar
        roomCode={roomId}
        phase={phase}
        isHost={true}
        onReturnToLobby={handleReturnToLobby}
        onLeaveGame={handleEndGame}
      >
        <div className="flex items-center gap-3">
          <span className="bg-[#F7F4EC] border-2 border-[#2C2A29] px-3 py-1 rounded-xl text-xs font-black text-[#2C2A29] shadow-[2px_2px_0px_#2C2A29]">
            الجولة {currentRound} من {TOTAL_ROUNDS}
          </span>
          {timeLeft > 0 && (
            <div className="flex items-center gap-1.5 bg-[#F7F4EC] border-2 border-[#2C2A29] px-3 py-1 rounded-xl text-sm font-black shadow-[2px_2px_0px_#2C2A29]">
              <Clock className="w-4 h-4 text-[#C68B59]" />
              <span>{timeLeft} ث</span>
            </div>
          )}
        </div>
      </GameTopBar>

      {/* Main Body */}
      <main className="flex-1 p-6 overflow-hidden flex flex-col min-h-0">
        {/* LOBBY PHASE */}
        {phase === 'LOBBY' && (
          <div className="w-full h-full flex flex-col justify-between max-w-5xl mx-auto">
            <div className="text-center my-auto">
              <h2 className="text-3xl md:text-5xl font-black text-[#2C2A29] mb-3">
                مين الـ AI فينا؟
              </h2>
              <p className="text-base md:text-lg font-bold text-stone-600 max-w-2xl mx-auto">
                كل واحد يطرح سؤال ويجاوب بأسماء مجهولة.. ركزوا في الأجوبة واكشفوا مين الروبوت الليندس بينكم!
              </p>

              {/* Lobby QR & Code */}
              <div className="flex flex-col md:row items-center justify-center gap-8 mt-8">
                <div className="p-4 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl flex flex-col items-center">
                  <QRCodeView url={`${window.location.origin}/join/${roomId}`} size={180} />
                  <span className="text-xs font-black text-[#2C2A29] mt-2">امسح للانضمام فوراً</span>
                </div>

                {/* Players List */}
                <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 w-full max-w-md">
                  <div className="flex items-center justify-between mb-4 border-b border-[#2C2A29]/20 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black bg-[#E5E0D5] border border-[#2C2A29] px-2.5 py-1 rounded-lg">
                        مطلوب 2 على الأقل للبدء (الحد الأقصى 7)
                      </span>
                      {players.length > 0 && (
                        <span className="text-xs font-black bg-[#8A9A5B] text-white border border-[#2C2A29] px-2 py-1 rounded-lg">
                          جاهز: {readyPlayerIds.size} / {players.length}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-black text-[#2C2A29] flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#8A9A5B]" />
                      اللاعبون المتصلون ({players.length})
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-2.5 justify-center max-h-48 overflow-y-auto p-2">
                    {players.length === 0 ? (
                      <p className="w-full text-center text-xs font-bold text-stone-500 py-6">
                        في انتظار انضمام اللاعبين من الجوال...
                      </p>
                    ) : (
                      players.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] px-4 py-2 rounded-xl"
                        >
                          <span className="font-black text-[#2C2A29] text-sm">{p.name}</span>
                          <button
                            onClick={() => handleKickPlayer(p.id)}
                            title="طرد اللاعب"
                            className="w-5 h-5 flex items-center justify-center bg-[#C68B59] text-white rounded-full text-xs font-black hover:bg-black transition-all cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Start Button */}
            <div className="flex flex-col items-center gap-3 pb-4">
              <button
                onClick={() => startQuestionsPhase()}
                disabled={!canStartGame}
                className={`px-8 py-4 rounded-xl border-2 border-[#2C2A29] font-black text-lg shadow-[4px_4px_0px_#2C2A29] transition-all active:translate-y-0.5 ${
                  canStartGame
                    ? 'bg-[#8A9A5B] text-white hover:bg-[#78884E] cursor-pointer'
                    : 'bg-[#E5E0D5] text-[#2C2A29]/40 border-[#2C2A29]/40 cursor-not-allowed shadow-none'
                }`}
              >
                {canStartGame ? 'بدء اللعبة' : 'بانتظار انضمام لاعبين اثنين على الأقل (2+)'}
              </button>
            </div>
          </div>
        )}

        {/* QUESTIONS PHASE */}
        {(phase === 'QUESTIONS' || phase === 'QUESTION_INPUT') && (
          <div className="w-full h-full flex flex-col justify-between max-w-4xl mx-auto">
            <div className="text-center my-auto flex flex-col items-center gap-6">
              <span className="bg-[#C68B59] text-white border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl text-sm font-black shadow-[2px_2px_0px_#2C2A29]">
                المرحلة الأولى: طرح الأسئلة
              </span>

              <h2 className="text-3xl md:text-5xl font-black text-[#2C2A29]">
                كل لاعب يكتب سؤاله الآن من الجوال!
              </h2>

              <p className="text-base md:text-lg font-bold text-stone-600 max-w-xl">
                اكتب سؤال مفتوح ومحرج أو مضحك.. الأفاتارات سرية والروبوت المندس يطرح سؤاله معكم!
              </p>

              {/* Progress Card */}
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 w-full max-w-md">
                <div className="flex items-center justify-between text-base font-black mb-3">
                  <span>المكتمل: {submittedQuestionPlayerIds.length} من {players.length}</span>
                  <span className="text-[#8A9A5B]">{timeLeft} ثانية متبقية</span>
                </div>

                <div className="w-full bg-[#E5E0D5] border border-[#2C2A29] rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-[#8A9A5B] h-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (submittedQuestionPlayerIds.length / Math.max(1, players.length)) * 100)}%`
                    }}
                  />
                </div>
              </div>

              {submittedQuestionPlayerIds.length >= players.length && (
                <button
                  onClick={startAnswersPhase}
                  className="py-3 px-8 rounded-xl border-2 border-[#2C2A29] bg-[#8A9A5B] text-white font-black text-base shadow-[3px_3px_0px_#2C2A29]"
                >
                  الجميع طرح أسئلته! بدء الإجابات فوراً
                </button>
              )}
            </div>
          </div>
        )}

        {/* ANSWERS PHASE */}
        {phase === 'ANSWERS' && (
          <div className="w-full h-full flex flex-col justify-between max-w-4xl mx-auto">
            <div className="text-center my-auto flex flex-col items-center gap-6">
              <span className="bg-[#8A9A5B] text-white border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl text-sm font-black shadow-[2px_2px_0px_#2C2A29]">
                المرحلة الثانية: الإجابات السرية
              </span>

              <h2 className="text-3xl md:text-5xl font-black text-[#2C2A29]">
                جاوبوا على جميع الأسئلة عبر كروت الجوال!
              </h2>

              <p className="text-base md:text-lg font-bold text-stone-600 max-w-xl">
                اسحبوا الكروت وجاوبوا بلهجتكم العادية.. الروبوت جالس يقلد أسلوبكم ويجاوب معكم بالخفاء!
              </p>

              {/* Progress Card */}
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 w-full max-w-md">
                <div className="flex items-center justify-between text-base font-black mb-3">
                  <span>تم التسليم: {submittedAnswerPlayerIds.length} من {players.length}</span>
                  <span className="text-[#C68B59]">{timeLeft} ثانية</span>
                </div>

                <div className="w-full bg-[#E5E0D5] border border-[#2C2A29] rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-[#8A9A5B] h-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (submittedAnswerPlayerIds.length / Math.max(1, players.length)) * 100)}%`
                    }}
                  />
                </div>
              </div>

              {submittedAnswerPlayerIds.length >= players.length && (
                <button
                  onClick={startShowcasePhase}
                  className="py-3 px-8 rounded-xl border-2 border-[#2C2A29] bg-[#8A9A5B] text-white font-black text-base shadow-[3px_3px_0px_#2C2A29]"
                >
                  اكتملت الإجابات! الانتقال للّوحة للمقارنة
                </button>
              )}
            </div>
          </div>
        )}

        {/* SHOWCASE PHASE */}
        {phase === 'SHOWCASE' && (
          <div className="w-full h-full flex flex-col justify-between">
            <div className="flex-1 min-h-0 overflow-hidden">
              <VerticalSinglePageQABoard
                questions={questions}
                answers={answers}
              />
            </div>

            {/* Bottom transition bar */}
            <div className="flex items-center justify-between pt-4 border-t-2 border-[#2C2A29] mt-3">
              <div className="text-xs font-bold text-stone-600">
                قارنوا الأجوبة واكتشفوا النبرة الغريبة أو الروبوتية!
              </div>

              <button
                onClick={startVotingPhase}
                className="py-3 px-8 rounded-xl border-2 border-[#2C2A29] bg-[#8A9A5B] text-white font-black text-base shadow-[4px_4px_0px_#2C2A29] hover:bg-[#7b8a51] transition-all"
              >
                الانتقال لمرحلة التصويت (30 ثانية)
              </button>
            </div>
          </div>
        )}

        {/* VOTING PHASE (Board stays visible!) */}
        {phase === 'VOTING' && (
          <div className="w-full h-full flex flex-col justify-between">
            <div className="flex-1 min-h-0 overflow-hidden">
              <VerticalSinglePageQABoard
                questions={questions}
                answers={answers}
              />
            </div>

            {/* Bottom Voting Live Status */}
            <div className="flex items-center justify-between pt-4 border-t-2 border-[#2C2A29] mt-3 bg-[#F7F4EC] p-3 rounded-xl border-2 shadow-[2px_2px_0px_#2C2A29]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#C68B59]" />
                <span className="text-sm font-black text-[#2C2A29]">
                  الأصوات المستلمة: {votes.length} من {players.length}
                </span>
              </div>

              {votes.length >= players.length && (
                <button
                  onClick={startRevealPhase}
                  className="py-2.5 px-6 rounded-xl border-2 border-[#2C2A29] bg-[#8A9A5B] text-white font-black text-sm shadow-[3px_3px_0px_#2C2A29]"
                >
                  الجميع صوّت! بدء روليت الكشف فوراً
                </button>
              )}
            </div>
          </div>
        )}

        {/* REVEAL PHASE */}
        {phase === 'REVEAL' && scoreResult && (
          <div className="w-full h-full flex flex-col">
            <RouletteReveal
              suspects={suspects}
              scoreResult={scoreResult}
              onNextRound={handleNextRound}
              onReturnToLobby={handleReturnToLobby}
              isHost={true}
            />
          </div>
        )}

        {/* GAME OVER PHASE */}
        {phase === 'GAME_OVER' && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-6 max-w-2xl mx-auto text-center">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-2xl p-8 w-full">
              <h2 className="text-3xl font-black text-[#2C2A29] mb-2">انتهت اللعبة!</h2>
              <p className="text-sm font-bold text-stone-600 mb-6">
                شكراً لخوض تجربة "مين الـ AI فينا؟"
              </p>

              <button
                onClick={handleReturnToLobby}
                className="py-3.5 px-8 rounded-xl border-2 border-[#2C2A29] bg-[#8A9A5B] text-white font-black text-base shadow-[4px_4px_0px_#2C2A29]"
              >
                العودة إلى اللوبي
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
