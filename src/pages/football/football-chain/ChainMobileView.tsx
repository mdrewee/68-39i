import React, { useState, useEffect, useRef, useCallback, FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  ChainGamePhase,
  ChainPlayer,
  ChainStep,
  ChainChallenge,
  ChainEventPayload,
  WinningChainReveal,
} from './types';
import {
  getConnectingEntity,
  normalizePlayerName,
  findChainPlayer,
  toChainPlayer,
} from '../../../utils/footballChainEngine';
import { searchFootballPlayers } from '../../../utils/footballSearch';
import { FootballPlayer } from '../../../data/footballMasterData';
import { DRAFT_CURATED_CLUBS, DraftClub } from '../../../data/draftClubs';
import { sound } from '../../../lib/audio';
import {
  ArrowLeft,
  RotateCcw,
  Trophy,
  CheckCircle2,
  AlertTriangle,
  Flag,
  User,
  Zap,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

export const ChainMobileView: FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // Player Profile
  const [playerId] = useState<string>(() => {
    let pid = sessionStorage.getItem('chain_player_id') || sessionStorage.getItem('party_player_id');
    if (!pid) {
      pid = `p_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem('chain_player_id', pid);
      sessionStorage.setItem('party_player_id', pid);
    }
    return pid;
  });

  const [playerName, setPlayerName] = useState<string>(() => {
    return sessionStorage.getItem('chain_player_name') || '';
  });

  const [selectedClub, setSelectedClub] = useState<DraftClub>(() => {
    const cached = sessionStorage.getItem('chain_player_club');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.name && parsed.badgeUrl) return parsed;
      } catch {}
    }
    return DRAFT_CURATED_CLUBS[0]; // Guaranteed Default: Al-Hilal
  });

  const [hasJoined, setHasJoined] = useState<boolean>(() => {
    return !!sessionStorage.getItem('chain_player_name');
  });

  const [isReady, setIsReady] = useState<boolean>(false);

  // Game Realtime State
  const [phase, setPhase] = useState<ChainGamePhase>('LOBBY');
  const [round, setRound] = useState<number>(1);
  const [totalRounds, setTotalRounds] = useState<number>(5);
  const [currentChallenge, setCurrentChallenge] = useState<ChainChallenge | null>(null);

  // Active Chain State for Contestant
  const [currentPlayer, setCurrentPlayer] = useState<ChainPlayer | null>(null);
  const [chainSteps, setChainSteps] = useState<ChainStep[]>([]);
  const [usedPlayerIds, setUsedPlayerIds] = useState<Set<string>>(new Set());

  // Input & Autocomplete State
  const [query, setQuery] = useState<string>('');
  const [selectedCandidate, setSelectedCandidate] = useState<FootballPlayer | null>(null);

  // Validation Feedback & Shake
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [hasFinishedCurrentRound, setHasFinishedCurrentRound] = useState<boolean>(false);
  const [readyForNextRound, setReadyForNextRound] = useState<boolean>(false);

  // Winning Reveal on Round Podium
  const [podiumReveal, setPodiumReveal] = useState<WinningChainReveal | null>(null);

  // Realtime Channel References
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef<boolean>(false);
  const playerIdRef = useRef<string>(playerId);
  const playerNameRef = useRef<string>(playerName);
  const selectedClubRef = useRef<DraftClub>(selectedClub);
  const hasJoinedRef = useRef<boolean>(hasJoined);

  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);
  useEffect(() => { selectedClubRef.current = selectedClub; }, [selectedClub]);
  useEffect(() => { hasJoinedRef.current = hasJoined; }, [hasJoined]);

  // Safe Realtime broadcast helper
  const broadcastEvent = useCallback((payload: ChainEventPayload) => {
    if (!channelRef.current || !isSubscribedRef.current) {
      console.warn('[Realtime Chain Mobile] Cannot send event - channel not SUBSCRIBED yet:', payload.action);
      return;
    }
    channelRef.current.send({
      type: 'broadcast',
      event: 'chain_event',
      payload,
    });
  }, []);

  // Filter autocomplete search suggestions
  const searchResults = React.useMemo(() => {
    if (!query.trim()) return [];
    return searchFootballPlayers(query, 10);
  }, [query]);

  // Reset chain when new challenge starts
  const initChallengeChain = useCallback((challenge: ChainChallenge) => {
    setCurrentChallenge(challenge);
    setCurrentPlayer(challenge.startPlayer);
    setChainSteps([]);
    setUsedPlayerIds(new Set([challenge.startPlayer.id]));
    setQuery('');
    setSelectedCandidate(null);
    setFeedbackMessage(null);
    setHasFinishedCurrentRound(false);
    setReadyForNextRound(false);
  }, []);

  // Supabase Realtime Channel
  useEffect(() => {
    if (!roomCode || !playerId) return;

    let isMounted = true;
    const channelId = `chain:${roomCode}`;

    const channel = supabase.channel(channelId, {
      config: {
        broadcast: { self: true },
        presence: { key: playerId },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {})
      .on('broadcast', { event: 'chain_event' }, ({ payload }) => {
        if (!isMounted || !payload) return;
        const ev = payload as ChainEventPayload;

        if (ev.action === 'GAME_START') {
          setPhase('RACE_ACTIVE');
          setRound(ev.round || 1);
          setTotalRounds(ev.totalRounds || 5);
          if (ev.challenge) initChallengeChain(ev.challenge);
          sound.playRoundStart();
        } else if (ev.action === 'START_NEXT_ROUND') {
          setPhase('RACE_ACTIVE');
          setRound(ev.round || 1);
          if (ev.challenge) initChallengeChain(ev.challenge);
          sound.playRoundStart();
        } else if (ev.action === 'CHAIN_COMPLETED' || ev.action === 'ROUND_TIMEOUT') {
          setPhase('ROUND_PODIUM');
          if (ev.winningReveal) setPodiumReveal(ev.winningReveal);
          sound.playVictory();
        } else if (ev.action === 'RESET_LOBBY') {
          setPhase('LOBBY');
          setRound(1);
          setIsReady(false);
          setReadyForNextRound(false);
          setChainSteps([]);
        } else if (ev.action === 'KICK_PLAYER') {
          if (ev.targetPlayerId === playerIdRef.current) {
            sessionStorage.removeItem('chain_player_id');
            sessionStorage.removeItem('chain_player_name');
            sessionStorage.removeItem('chain_player_club');
            alert('تم استبعادك من الغرفة من قِبل المضيف');
            navigate('/', { replace: true });
          }
        } else if (ev.action === 'ROOM_TERMINATED') {
          alert('تم إنهاء الغرفة من قِبل المضيف');
          navigate('/');
        }
      })
      .subscribe((status) => {
        if (!isMounted) return;
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
          if (hasJoinedRef.current) {
            channel.track({
              id: playerIdRef.current,
              name: playerNameRef.current,
              teamLogo: selectedClubRef.current.badgeUrl,
              teamName: selectedClubRef.current.name,
              joinedAt: Date.now(),
              isReady: false,
            });
          }
        } else {
          isSubscribedRef.current = false;
        }
      });

    channelRef.current = channel;

    return () => {
      isMounted = false;
      isSubscribedRef.current = false;
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, playerId, navigate, initChallengeChain]);

  // Join Room
  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = playerName.trim();
    if (!cleanName) return;

    sound.playClick();
    sessionStorage.setItem('chain_player_id', playerId);
    sessionStorage.setItem('chain_player_name', cleanName);
    sessionStorage.setItem('chain_player_club', JSON.stringify(selectedClub));
    setHasJoined(true);

    if (channelRef.current) {
      channelRef.current.track({
        id: playerId,
        name: cleanName,
        teamLogo: selectedClub.badgeUrl,
        teamName: selectedClub.name,
        joinedAt: Date.now(),
        isReady: false,
      });

      broadcastEvent({
        action: 'PLAYER_READY',
        playerId,
        playerName: cleanName,
        teamLogo: selectedClub.badgeUrl,
        teamName: selectedClub.name,
        isReady: false,
      });
    }
  };

  // Trigger feedback with haptics
  const triggerError = (msg: string) => {
    sound.playIncorrect();
    try {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } catch {}
    setFeedbackMessage({ text: msg, type: 'error' });
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const triggerSuccess = (msg: string) => {
    sound.playCellClaimed();
    try {
      if (navigator.vibrate) navigator.vibrate(50);
    } catch {}
    setFeedbackMessage({ text: msg, type: 'success' });
  };

  // Submit Teammate Link Attempt
  const handleConnectTeammate = (candidatePlayer: FootballPlayer) => {
    if (!currentPlayer || !currentChallenge || hasFinishedCurrentRound) return;

    const candidateChain = toChainPlayer(candidatePlayer);

    // 1. Anti-Looping Rule
    if (usedPlayerIds.has(candidateChain.id)) {
      triggerError(`لا يمكنك تكرار لاعب (${candidateChain.name}) استخدمته مسبقاً في السلسلة!`);
      return;
    }

    // 2. Validate Teammate Relationship
    const connectingEntity = getConnectingEntity(currentPlayer, candidateChain);
    if (!connectingEntity) {
      triggerError(`لم يتزاملا (${currentPlayer.name}) و (${candidateChain.name}) في أي نادٍ أو منتخب!`);
      return;
    }

    // Valid Link!
    const newStepNumber = chainSteps.length + 1;
    const newStep: ChainStep = {
      fromPlayer: currentPlayer,
      toPlayer: candidateChain,
      connectingEntity,
      stepNumber: newStepNumber,
    };

    const nextSteps = [...chainSteps, newStep];
    const nextUsed = new Set(usedPlayerIds);
    nextUsed.add(candidateChain.id);

    setChainSteps(nextSteps);
    setUsedPlayerIds(nextUsed);
    setCurrentPlayer(candidateChain);
    setQuery('');
    setSelectedCandidate(null);

    // Check if we hit the target player!
    const isTargetReached =
      candidateChain.id === currentChallenge.targetPlayer.id ||
      normalizePlayerName(candidateChain.name) === normalizePlayerName(currentChallenge.targetPlayer.name);

    if (isTargetReached) {
      triggerSuccess(`مبروك! وصلت إلى لاعب الهدف (${candidateChain.name}) في ${newStepNumber} خطوات! 🏆`);
      setHasFinishedCurrentRound(true);

      const bonusPoints = newStepNumber <= 3 ? 2 : 0;
      const totalPoints = 5 + bonusPoints;

      const reveal: WinningChainReveal = {
        winnerId: playerId,
        winnerName: playerName,
        winnerTeamLogo: selectedClub.badgeUrl,
        stepsCount: newStepNumber,
        chainSteps: nextSteps,
        startPlayer: currentChallenge.startPlayer,
        targetPlayer: currentChallenge.targetPlayer,
        bonusPoints,
        totalPoints,
      };

      broadcastEvent({
        action: 'CHAIN_COMPLETED',
        playerId,
        playerName,
        teamLogo: selectedClub.badgeUrl,
        teamName: selectedClub.name,
        stepCount: newStepNumber,
        winningReveal: reveal,
      });
    } else {
      triggerSuccess(`رابط صحيح! (${connectingEntity}) ──> واصل نحو ${currentChallenge.targetPlayer.name}!`);

      // Inform TV of live track progress
      broadcastEvent({
        action: 'STEP_ADVANCED',
        playerId,
        playerName,
        stepCount: newStepNumber,
      });
    }
  };

  // Backtrack (تراجع خطوة للخلف)
  const handleBacktrack = () => {
    if (chainSteps.length === 0 || !currentChallenge || hasFinishedCurrentRound) return;

    sound.playClick();
    const lastStep = chainSteps[chainSteps.length - 1];
    const newSteps = chainSteps.slice(0, -1);

    const newUsed = new Set(usedPlayerIds);
    newUsed.delete(lastStep.toPlayer.id);

    setChainSteps(newSteps);
    setUsedPlayerIds(newUsed);
    setCurrentPlayer(lastStep.fromPlayer);
    setQuery('');
    setSelectedCandidate(null);
    setFeedbackMessage({ text: `تم التراجع خطوة إلى ${lastStep.fromPlayer.name}`, type: 'success' });

    broadcastEvent({
      action: 'STEP_BACKTRACKED',
      playerId,
      playerName,
      stepCount: newSteps.length,
    });
  };

  // -----------------------------------------------------------------
  // VIEW 1: JOIN SCREEN
  // -----------------------------------------------------------------
  if (!hasJoined) {
    return (
      <div
        className="min-h-screen w-full bg-[#E5E0D5] text-[#2C2A29] flex flex-col justify-center items-center p-4 font-sans select-none"
        dir="rtl"
      >
        <div className="w-full max-w-sm bg-[#F7F4EC] border-3 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-3xl p-6 space-y-6">
          <div className="text-center space-y-1">
            <div className="w-16 h-16 bg-[#8A9A5B] border-2 border-[#2C2A29] rounded-2xl mx-auto flex items-center justify-center text-white text-3xl shadow-[3px_3px_0px_#2C2A29]">
              🔗
            </div>
            <h1 className="text-2xl font-black text-[#2C2A29] pt-2">سِكّة اللاعبين</h1>
            <p className="text-xs font-bold text-[#5C4033]">
              ابنِ أسرع سلسلة ربط بين اللاعبين عبر الأندية والمنتخبات!
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-[#5C4033] mb-1.5">
                اسمك باللعبة:
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="اكتب اسمك هنا..."
                className="w-full bg-white border-2 border-[#2C2A29] rounded-xl px-4 py-3 font-bold text-sm text-[#2C2A29] focus:outline-none focus:bg-[#F7F4EC] transition-all shadow-[2px_2px_0px_#2C2A29]"
                maxLength={20}
                required
              />
            </div>

            <button
              type="submit"
              disabled={!playerName.trim()}
              className="w-full bg-[#8A9A5B] hover:bg-[#78884E] disabled:opacity-50 text-white font-black text-base py-3.5 rounded-xl border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] active:translate-y-0.5 active:shadow-[2px_2px_0px_#2C2A29] transition-all cursor-pointer mt-2"
            >
              دخول الغرفة
            </button>
          </form>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // MAIN IN-GAME VIEW
  // -----------------------------------------------------------------
  return (
    <div
      className="min-h-screen w-full bg-[#E5E0D5] text-[#2C2A29] flex flex-col font-sans select-none overflow-x-hidden"
      dir="rtl"
    >
      {/* Mobile Top Header */}
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
          {phase === 'RACE_ACTIVE' && (
            <span className="bg-[#8A9A5B] text-white border border-[#2C2A29] px-2.5 py-0.5 rounded-lg text-xs font-black shadow-sm">
              الجولة {round}/{totalRounds}
            </span>
          )}
          <span className="font-mono text-xs font-black text-[#5C4033] bg-[#F7F4EC] px-2 py-0.5 rounded-lg border border-[#2C2A29]">
            {roomCode}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-3 sm:p-4 max-w-md mx-auto w-full space-y-3 justify-between">
        {/* =======================================================
            STATE 1: LOBBY
            ======================================================= */}
        {phase === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-8 animate-fade-in">
            <div className="w-20 h-20 bg-white border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl flex items-center justify-center p-3">
              <img src={selectedClub.badgeUrl} alt={selectedClub.name} className="w-full h-full object-contain" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-[#2C2A29]">أهلاً بك {playerName}!</h3>
              <p className="text-xs font-bold text-[#5C4033] max-w-xs">
                جهّز معلوماتك الرياضية وزمالات اللاعبين.. اضغط الزر أدناه عندما تكون مستعداً!
              </p>
            </div>

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
                  teamLogo: selectedClubRef.current.badgeUrl,
                  teamName: selectedClubRef.current.name,
                  isReady: nextReady,
                });
              }}
              className={`w-full max-w-xs py-4 px-6 rounded-2xl font-black text-lg border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2 ${
                isReady ? 'bg-[#8A9A5B] text-white' : 'bg-[#F7F4EC] text-[#2C2A29] hover:bg-white'
              }`}
            >
              <CheckCircle2 size={22} className={isReady ? 'text-white' : 'text-[#8A9A5B]'} />
              <span>{isReady ? 'جاهز للمنافسة ✓' : 'أنا جاهز!'}</span>
            </button>
          </div>
        )}

        {/* =======================================================
            STATE 2: RACE ACTIVE
            ======================================================= */}
        {phase === 'RACE_ACTIVE' && currentChallenge && (
          <div className="space-y-3 animate-fade-in">
            {/* 1. Target Player Banner (Fixed Top Goal Card) */}
            <div className="bg-[#8A9A5B] text-white border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-xl border-2 border-[#2C2A29] p-1 flex items-center justify-center overflow-hidden shrink-0">
                  {currentChallenge.targetPlayer.photoUrl ? (
                    <img src={currentChallenge.targetPlayer.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Trophy size={22} className="text-[#8A9A5B]" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-[#2C2A29] text-white px-2 py-0.5 rounded-md inline-block">
                    الهدف النهائي 🎯
                  </span>
                  <h3 className="text-base sm:text-lg font-black leading-tight mt-0.5">
                    الوصول إلى: {currentChallenge.targetPlayer.name}
                  </h3>
                  <span className="text-[11px] opacity-90 block">
                    {currentChallenge.targetPlayer.nationality} • {currentChallenge.targetPlayer.currentClub || currentChallenge.targetPlayer.clubs[0]}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Current Active Player Card (Where contestant is currently branching from) */}
            {currentPlayer && (
              <div className="bg-[#F7F4EC] border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#5C4033] flex items-center gap-1">
                    <User size={14} /> نقطة الانطلاق الحالية:
                  </span>
                  <span className="text-xs font-mono font-black bg-[#E5E0D5] border border-[#2C2A29] px-2 py-0.5 rounded-lg">
                    الخطوة {chainSteps.length}
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <div className="w-14 h-14 bg-[#E5E0D5] rounded-xl border-2 border-[#2C2A29] flex items-center justify-center overflow-hidden shrink-0">
                    {currentPlayer.photoUrl ? (
                      <img src={currentPlayer.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={26} className="text-[#5C4033]" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-[#2C2A29] leading-tight">
                      {currentPlayer.name}
                    </h2>
                    <p className="text-xs font-bold text-[#5C4033] mt-0.5">
                      {currentPlayer.nationality} • أنديته: {currentPlayer.clubs.slice(0, 3).join('، ')}
                    </p>
                  </div>
                </div>

                <p className="text-xs font-bold text-[#8A9A5B] bg-[#E5E0D5] p-2 rounded-xl border border-[#2C2A29]/20">
                  💡 اكتب اسم أي لاعب تزامَل مع <span className="font-black underline">{currentPlayer.name}</span> في نادٍ أو منتخب!
                </p>
              </div>
            )}

            {/* 3. Feedback Banner */}
            {feedbackMessage && (
              <div
                className={`p-3 rounded-xl border-2 border-[#2C2A29] text-xs font-black shadow-sm flex items-center gap-2 ${
                  feedbackMessage.type === 'error'
                    ? 'bg-[#C68B59] text-white'
                    : 'bg-[#8A9A5B] text-white'
                } ${isShaking ? 'animate-shake' : ''}`}
              >
                {feedbackMessage.type === 'error' ? <AlertTriangle size={16} /> : <Sparkles size={16} />}
                <span>{feedbackMessage.text}</span>
              </div>
            )}

            {/* 4. Search Bar & Teammate Submission */}
            {!hasFinishedCurrentRound ? (
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] p-3 rounded-2xl shadow-[3px_3px_0px_#2C2A29] space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelectedCandidate(null);
                    }}
                    placeholder={`ابحث عن زميل لـ (${currentPlayer?.name})...`}
                    className="w-full border-2 border-[#2C2A29] rounded-xl px-4 py-3 font-bold text-xs sm:text-sm text-[#2C2A29] focus:outline-none bg-white placeholder-[#5C4033]/60 focus:bg-[#F7F4EC] transition-all shadow-[2px_2px_0px_#2C2A29]"
                  />
                </div>

                {/* Autocomplete Dropdown */}
                {query.trim() && (
                  <div className="max-h-44 overflow-y-auto border-2 border-[#2C2A29] rounded-xl bg-white divide-y divide-[#2C2A29]/10 shadow-[3px_3px_0px_#2C2A29]">
                    {searchResults.length > 0 ? (
                      searchResults.map((p) => {
                        const isAlreadyUsed = usedPlayerIds.has(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              if (isAlreadyUsed) {
                                triggerError('هذا اللاعب موجود مسبقاً في سلسلتك!');
                                return;
                              }
                              handleConnectTeammate(p);
                            }}
                            className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                              isAlreadyUsed
                                ? 'opacity-40 bg-gray-100 cursor-not-allowed'
                                : 'hover:bg-[#E5E0D5] text-[#2C2A29] font-bold'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{p.name}</span>
                              <span className="opacity-70 text-[10px]">({p.nationality})</span>
                            </div>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/10">
                              {p.currentClub || p.clubs[0]}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 text-center text-xs font-bold text-[#5C4033]">
                        لم يتم العثور على اللاعب في قاعدة البيانات.
                      </div>
                    )}
                  </div>
                )}

                {/* Backtrack Button ([تراجع خطوة]) */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={chainSteps.length === 0}
                    onClick={handleBacktrack}
                    className="w-full bg-[#C68B59] hover:bg-[#B57A48] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black py-2.5 px-4 rounded-xl border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <RotateCcw size={14} />
                    <span>تراجع خطوة للخلف</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#8A9A5B] text-white p-4 rounded-2xl border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] text-center space-y-1">
                <h3 className="text-lg font-black">أحسنت! أتممت السلسلة بنجاح 🏆</h3>
                <p className="text-xs font-bold opacity-90">
                  شاهد شاشة العرض الرئيسية الآن لمتابعة النتيجة وتتويج الجولة!
                </p>
              </div>
            )}

            {/* 5. Live Chain Breadcrumbs (شريط السلسلة مع الروابط) */}
            <div className="space-y-1.5">
              <span className="text-xs font-black text-[#5C4033] block">
                مسار سلسلتك حتى الآن ({chainSteps.length} خطوات):
              </span>
              <div className="bg-white border-2 border-[#2C2A29] p-3 rounded-2xl shadow-[2px_2px_0px_#2C2A29] overflow-x-auto flex items-center gap-2 text-xs font-bold scrollbar-thin">
                <span className="bg-[#8A9A5B] text-white px-2.5 py-1 rounded-lg shrink-0 border border-[#2C2A29]">
                  {currentChallenge.startPlayer.name}
                </span>
                {chainSteps.map((step, idx) => (
                  <React.Fragment key={idx}>
                    <span className="text-[#C68B59] font-black shrink-0 text-[10px] bg-[#E5E0D5] px-1.5 py-0.5 rounded border border-[#2C2A29]/40">
                      ──({step.connectingEntity})──&gt;
                    </span>
                    <span className="bg-[#F7F4EC] text-[#2C2A29] px-2.5 py-1 rounded-lg shrink-0 border border-[#2C2A29]">
                      {step.toPlayer.name}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            STATE 3: ROUND PODIUM & NEXT ROUND
            ======================================================= */}
        {phase === 'ROUND_PODIUM' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-5 py-4 animate-fade-in">
            <div className="w-16 h-16 bg-[#8A9A5B] border-3 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl flex items-center justify-center text-3xl animate-bounce text-white">
              👑
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-[#2C2A29]">
                {round >= totalRounds ? 'نهاية المباراة الكبرى!' : `نهاية الجولة ${round} من ${totalRounds}!`}
              </h2>
              {podiumReveal && (
                <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] p-3 rounded-xl max-w-xs mx-auto shadow-sm">
                  <span className="text-xs font-bold text-[#5C4033] block">الفائز بالجولة:</span>
                  <span className="text-base font-black text-[#8A9A5B]">{podiumReveal.winnerName}</span>
                  <span className="text-xs font-bold block text-[#2C2A29] mt-0.5">
                    في {podiumReveal.stepsCount} خطوات (+{podiumReveal.totalPoints} نقطة)
                  </span>
                </div>
              )}
            </div>

            {round < totalRounds && (
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
                  readyForNextRound ? 'bg-[#8A9A5B] text-white' : 'bg-[#C68B59] text-white'
                }`}
              >
                <RefreshCw size={18} className={readyForNextRound ? 'animate-spin' : ''} />
                <span>{readyForNextRound ? 'جاهز للجولة التالية ✓' : 'جاهز للجولة التالية'}</span>
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
