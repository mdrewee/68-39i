import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Trophy, Play, CheckCircle2, Eye, EyeOff, Sparkles, ArrowRightLeft } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { GameTopBar } from '../../../components/layout/GameTopBar';
import { EshrahTVLobby } from '../../../components/eshrah/EshrahTVLobby';
import { EshrahPodium } from '../../../components/eshrah/EshrahPodium';
import {
  EshrahPlayer,
  EshrahTeamId,
  EshrahCategory,
  EshrahPromptItem,
  EshrahGamePhase
} from '../../../types/eshrah';
import { ONE_WORD_CATEGORIES, ONE_WORD_BANK, OneWordCategory } from '../../../data/oneWordBank';
import { pickNextUnusedItem } from '../../../utils/sessionQuestionManager';
import { sound } from '../../../lib/audio';

export const OneWordTVView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // State
  const [phase, setPhase] = useState<EshrahGamePhase>('TEAMS');
  const [selectedCategory, setSelectedCategory] = useState<OneWordCategory>('كرة قدم');
  const [players, setPlayers] = useState<EshrahPlayer[]>([]);
  const [currentRound, setCurrentRound] = useState<number>(1); // strictly 1 to 5
  const [team1Score, setTeam1Score] = useState<number>(0);
  const [team2Score, setTeam2Score] = useState<number>(0);
  const [currentPrompt, setCurrentPrompt] = useState<EshrahPromptItem | null>(null);
  const [usedPromptIds, setUsedPromptIds] = useState<Set<string>>(new Set());
  const [activeTurnClueTeam, setActiveTurnClueTeam] = useState<EshrahTeamId>('team_1');
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(10); // strictly 10 seconds per clue turn
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isWordRevealedOnTV, setIsWordRevealedOnTV] = useState<boolean>(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const phaseRef = useRef(phase);
  const playersRef = useRef(players);
  const team1ScoreRef = useRef(team1Score);
  const team2ScoreRef = useRef(team2Score);
  const currentPromptRef = useRef(currentPrompt);
  const currentRoundRef = useRef(currentRound);
  const activeTurnClueTeamRef = useRef(activeTurnClueTeam);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { team1ScoreRef.current = team1Score; }, [team1Score]);
  useEffect(() => { team2ScoreRef.current = team2Score; }, [team2Score]);
  useEffect(() => { currentPromptRef.current = currentPrompt; }, [currentPrompt]);
  useEffect(() => { currentRoundRef.current = currentRound; }, [currentRound]);
  useEffect(() => { activeTurnClueTeamRef.current = activeTurnClueTeam; }, [activeTurnClueTeam]);

  // Broadcast Full State
  const broadcastSync = useCallback((customPayload?: any) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'ONE_WORD_SYNC',
      payload: {
        phase: phaseRef.current,
        players: playersRef.current,
        team1Score: team1ScoreRef.current,
        team2Score: team2ScoreRef.current,
        currentRound: currentRoundRef.current,
        prompt: currentPromptRef.current,
        activeTurnClueTeam: activeTurnClueTeamRef.current,
        turnTimeLeft,
        ...customPayload
      }
    });
  }, [turnTimeLeft]);

  // Setup Realtime Channel
  useEffect(() => {
    const normalizedCode = roomCode.trim().toUpperCase();
    if (!normalizedCode) return;

    const channel = supabase.channel(`one_word:${normalizedCode}`, {
      config: { broadcast: { self: true }, presence: { key: 'tv_screen' } }
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const active: EshrahPlayer[] = [];
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          presences.forEach((p) => {
            if (p.playerId && p.playerName) {
              const existing = playersRef.current.find((pl) => pl.id === p.playerId);
              active.push({
                id: p.playerId,
                name: p.playerName,
                teamId: existing?.teamId || p.teamId || null,
                isHost: !!p.isHost
              });
            }
          });
        });

        const unique = Array.from(new Map(active.map((p) => [p.id, p])).values());
        setPlayers(unique);
        broadcastSync({ players: unique });
      })
      .on('broadcast', { event: 'PLAYER_JOIN_TEAM' }, ({ payload }) => {
        const { playerId, teamId } = payload;
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, teamId } : p))
        );
      })
      .on('broadcast', { event: 'EXPLAINER_READY_START' }, () => {
        handleStartTurnTimer();
      })
      .on('broadcast', { event: 'ONE_WORD_GUESSED' }, () => {
        handleOneWordGuessed();
      })
      .on('broadcast', { event: 'PASS_CLUE_TURN' }, () => {
        handlePassClueTurn();
      })
      .on('broadcast', { event: 'ROOM_TERMINATED' }, () => {
        navigate('/');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, broadcastSync, navigate]);

  // 10-Second Active Clue Turn Timer
  useEffect(() => {
    if (phase !== 'PLAYING' || !isTimerRunning) return;

    const interval = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) {
          handleClueTimeExpired();
          return 10;
        }
        if (prev <= 3) {
          sound.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, isTimerRunning]);

  // When 10s expires, switch clue turn to the other team with sound
  const handleClueTimeExpired = () => {
    sound.playTimeout();
    const nextClueTeam: EshrahTeamId = activeTurnClueTeamRef.current === 'team_1' ? 'team_2' : 'team_1';
    setActiveTurnClueTeam(nextClueTeam);
    activeTurnClueTeamRef.current = nextClueTeam;
    setTurnTimeLeft(10);
    broadcastSync({
      activeTurnClueTeam: nextClueTeam,
      turnTimeLeft: 10
    });
  };

  // Manual pass clue turn
  const handlePassClueTurn = () => {
    sound.playClick();
    const nextClueTeam: EshrahTeamId = activeTurnClueTeamRef.current === 'team_1' ? 'team_2' : 'team_1';
    setActiveTurnClueTeam(nextClueTeam);
    activeTurnClueTeamRef.current = nextClueTeam;
    setTurnTimeLeft(10);
    broadcastSync({
      activeTurnClueTeam: nextClueTeam,
      turnTimeLeft: 10
    });
  };

  // Ready click from mobile
  const handleStartTurnTimer = () => {
    sound.playRoundStart();
    setTurnTimeLeft(10);
    setIsTimerRunning(true);
    setPhase('PLAYING');
    broadcastSync({ phase: 'PLAYING', turnTimeLeft: 10 });
  };

  // Single [جابوها ✓] clicked on guessing team's device:
  // Awards +1 pt to active team and instantly jumps to next round!
  const handleOneWordGuessed = () => {
    sound.playVictory();
    setIsTimerRunning(false);

    // Award point to current clue team
    if (activeTurnClueTeamRef.current === 'team_1') {
      setTeam1Score((prev) => prev + 1);
      team1ScoreRef.current += 1;
    } else {
      setTeam2Score((prev) => prev + 1);
      team2ScoreRef.current += 1;
    }

    const nextRound = currentRoundRef.current + 1;

    // Check if 5 rounds completed
    if (nextRound > 5) {
      setPhase('PODIUM');
      broadcastSync({
        phase: 'PODIUM',
        team1Score: team1ScoreRef.current,
        team2Score: team2ScoreRef.current
      });
      return;
    }

    // Instant jump to next round (PREP_WORD)
    const rawNextWord = pickNextUnusedItem(roomCode, selectedCategory, ONE_WORD_BANK[selectedCategory]) || ONE_WORD_BANK[selectedCategory][0];
    const nextPrompt: EshrahPromptItem = {
      id: `ow_${Date.now()}_${rawNextWord}`,
      word: rawNextWord,
      category: selectedCategory as any,
      bannedWords: [],
    };
    setUsedPromptIds((prev) => new Set([...prev, nextPrompt.id]));
    setCurrentPrompt(nextPrompt);
    currentPromptRef.current = nextPrompt;
    setCurrentRound(nextRound);
    currentRoundRef.current = nextRound;
    setActiveTurnClueTeam('team_1');
    activeTurnClueTeamRef.current = 'team_1';
    setTurnTimeLeft(10);
    setIsWordRevealedOnTV(false);
    setPhase('PREP_WORD');

    broadcastSync({
      phase: 'PREP_WORD',
      currentRound: nextRound,
      prompt: nextPrompt,
      activeTurnClueTeam: 'team_1',
      team1Score: team1ScoreRef.current,
      team2Score: team2ScoreRef.current,
      turnTimeLeft: 10
    });
  };

  // Launch Match from Lobby
  const handleLaunchMatch = () => {
    const rawFirstWord = pickNextUnusedItem(roomCode, selectedCategory, ONE_WORD_BANK[selectedCategory]) || ONE_WORD_BANK[selectedCategory][0];
    const firstPrompt: EshrahPromptItem = {
      id: `ow_${Date.now()}_${rawFirstWord}`,
      word: rawFirstWord,
      category: selectedCategory as any,
      bannedWords: [],
    };
    setUsedPromptIds(new Set([firstPrompt.id]));
    setCurrentPrompt(firstPrompt);
    currentPromptRef.current = firstPrompt;
    setCurrentRound(1);
    currentRoundRef.current = 1;
    setTeam1Score(0);
    setTeam2Score(0);
    setActiveTurnClueTeam('team_1');
    activeTurnClueTeamRef.current = 'team_1';
    setTurnTimeLeft(10);
    setIsTimerRunning(false);
    setIsWordRevealedOnTV(false);
    setPhase('PREP_WORD');

    broadcastSync({
      phase: 'PREP_WORD',
      currentRound: 1,
      team1Score: 0,
      team2Score: 0,
      prompt: firstPrompt,
      activeTurnClueTeam: 'team_1',
      turnTimeLeft: 10
    });
  };

  // Universal End Room
  const handleEndRoom = () => {
    sound.playClick();
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'ROOM_TERMINATED',
        payload: {}
      });
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#E5E0D5] flex flex-col font-sans select-none overflow-hidden relative" dir="rtl">
      {/* Background static dot pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40 z-0"
        style={{
          backgroundImage: 'radial-gradient(#2C2A29 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* Standardized GameTopBar */}
      <GameTopBar
        roomCode={roomCode}
        isHost={true}
        gameTitle="كلمة واحدة"
        currentRound={phase !== 'TEAMS' ? currentRound : undefined}
        totalRounds={phase !== 'TEAMS' ? 5 : undefined}
        onTerminate={handleEndRoom}
        onExit={handleEndRoom}
      />

      <main className="flex-1 flex flex-col items-center justify-between p-4 md:p-6 relative z-10 max-w-6xl mx-auto w-full">
        {/* ================= 1. TEAMS (LOBBY) ================= */}
        {phase === 'TEAMS' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto gap-4">
            {/* Host Category Picker for the Match */}
            <div className="w-full max-w-4xl bg-[#F7F4EC] border-2 sm:border-3 border-[#2C2A29] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0px_#2C2A29] text-center">
              <div className="flex items-center justify-between border-b-2 border-[#2C2A29]/15 pb-2 mb-3">
                <span className="text-xs font-black bg-[#8A9A5B] text-white border border-[#2C2A29] px-3 py-1 rounded-lg shadow-[2px_2px_0px_#2C2A29]">
                  اختيار فئة المباراة
                </span>
                <span className="text-xs font-bold text-[#5C4033]">
                  الفئة المختارة: <strong className="text-[#2C2A29]">{selectedCategory}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {ONE_WORD_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setSelectedCategory(cat);
                    }}
                    className={`py-2.5 px-2 rounded-xl font-black text-xs sm:text-sm border-2 border-[#2C2A29] transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[#8A9A5B] text-white shadow-[2px_2px_0px_#2C2A29]'
                        : 'bg-[#FAF8F5] text-[#2C2A29] hover:bg-[#E5E0D5]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <EshrahTVLobby
              roomCode={roomCode}
              gameTitle="كلمة واحدة"
              gameRuleSnippet={`مواجهة وجه لوجه في فئة (${selectedCategory})! يقف ممثل من كل فريق أمام الشاشة ويتناوبان في إعطاء تلميح من كلمة واحدة فقط لكل دور (10 ثوانٍ للدور). أول فريق يصرخ بالإجابة يضغط [جابوها] ويكسب النقطة!`}
              players={players}
              onStartMatch={handleLaunchMatch}
            />
          </div>
        )}

        {/* ================= 2. PREP WORD (STANDBY) ================= */}
        {phase === 'PREP_WORD' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center gap-6 my-auto text-center max-w-xl">
            <span className="text-xs font-black text-[#5C4033] bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
              جولة المواجهة {currentRound} من 5 ({selectedCategory})
            </span>

            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-8 shadow-[6px_6px_0px_#2C2A29] w-full flex flex-col items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-[#8A9A5B]/15 border-2 border-[#8A9A5B] flex items-center justify-center text-[#8A9A5B]">
                <Clock className="w-8 h-8" />
              </div>

              <h3 className="text-2xl md:text-3xl font-black text-[#2C2A29]">
                يقف ممثل من كل فريق أمام الشاشة!
              </h3>

              <p className="text-sm font-bold text-[#5C4033] max-w-md leading-relaxed">
                الكلمة السرية معروضة على جوال الممثلين الواقفين ليأخذا وقتهما في التفكير.
                تبدأ المواجهة بتوقيت 10 ثوانٍ لكل دور فور ضغط الممثل على <strong>[جاهز - ابدأ الجولة]</strong>!
              </p>

              <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-2xl px-6 py-2.5 text-xs font-black text-[#2C2A29]">
                ⏱️ 10 ثوانٍ فقط لكل دور تلميح ويتنقل الدور بالتناوب
              </div>
            </div>
          </div>
        )}

        {/* ================= 3. PLAYING (10s ALTERNATING TURN) ================= */}
        {phase === 'PLAYING' && (
          <div className="w-full flex-1 flex flex-col items-center justify-between my-auto gap-6 max-w-2xl text-center">
            {/* Top Bar Status */}
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-black text-[#2C2A29] bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                جولة {currentRound} / 5
              </span>
              <div className={`px-4 py-1.5 rounded-xl border-2 border-[#2C2A29] font-black text-xs text-white shadow-[2px_2px_0px_#2C2A29] ${
                activeTurnClueTeam === 'team_1' ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'
              }`}>
                دور التلميح الآن: {activeTurnClueTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'}
              </div>
            </div>

            {/* Giant 10-Second Timer */}
            <div className={`flex items-center justify-center gap-3 px-10 py-3.5 rounded-3xl border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] ${
              turnTimeLeft <= 3 ? 'bg-[#C86D51] text-white animate-pulse' : 'bg-[#F7F4EC] text-[#2C2A29]'
            }`}>
              <Clock className="w-8 h-8" />
              <span className="text-6xl font-black font-mono tracking-wider">
                00:{turnTimeLeft.toString().padStart(2, '0')}
              </span>
            </div>

            {/* Turn Clue Box */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-8 shadow-[6px_6px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <span className="text-sm font-black text-[#5C4033]">
                الدور في إعطاء التلميح والتخمين عند:
              </span>

              <div className={`text-3xl md:text-4xl font-black px-8 py-3 rounded-2xl border-2 border-[#2C2A29] text-white shadow-[3px_3px_0px_#2C2A29] ${
                activeTurnClueTeam === 'team_1' ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'
              }`}>
                {activeTurnClueTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'}
              </div>

              {/* Secret Word Box (Hidden on TV to keep prompt blind) */}
              <div className="w-full bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-2xl p-4 mt-2 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#5C4033]">
                  {isWordRevealedOnTV ? <Eye size={15} /> : <EyeOff size={15} />}
                  <span>الكلمة السرية على جوال الممثلين لمنع كشفها للمخمنين بالصالة!</span>
                </div>

                {isWordRevealedOnTV && (
                  <div className="text-3xl font-black text-[#2C2A29] mt-1">
                    {currentPrompt?.text}
                  </div>
                )}
              </div>

              {/* Reveal toggle for host if needed */}
              <button
                onClick={() => setIsWordRevealedOnTV(!isWordRevealedOnTV)}
                className="bg-[#E5E0D5] hover:bg-[#d8d2c5] text-[#2C2A29] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl px-4 py-1.5 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                {isWordRevealedOnTV ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{isWordRevealedOnTV ? 'إخفاء الكلمة عن الشاشة' : 'إظهار الكلمة للمشاهدين'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= 4. PODIUM ================= */}
        {phase === 'PODIUM' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto">
            <EshrahPodium
              team1Score={team1Score}
              team2Score={team2Score}
              onPlayAgain={() => {
                sound.playClick();
                handleLaunchMatch();
              }}
              onBackToHome={handleEndRoom}
            />
          </div>
        )}

        {/* Bottom scoreboard during gameplay */}
        {phase !== 'PODIUM' && phase !== 'TEAMS' && (
          <div className="w-full flex items-center justify-center gap-6 mt-4">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl px-6 py-2 shadow-[3px_3px_0px_#2C2A29] flex items-center gap-6 text-sm font-black">
              <span className="text-[#8A9A5B]">الفريق الأول: {team1Score} pt</span>
              <span className="text-[#2C2A29]/30">|</span>
              <span className="text-[#C68B59]">الفريق الثاني: {team2Score} pt</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
