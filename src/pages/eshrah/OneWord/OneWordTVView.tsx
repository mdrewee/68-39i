import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Trophy, Play, CheckCircle2, MessageSquare, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { EshrahTopBar } from '../../../components/eshrah/EshrahTopBar';
import { CleanTeamSelection } from '../../../components/eshrah/CleanTeamSelection';
import { CategoryPicker } from '../../../components/eshrah/CategoryPicker';
import { EshrahPodium } from '../../../components/eshrah/EshrahPodium';
import {
  EshrahPlayer,
  EshrahTeamId,
  EshrahCategory,
  EshrahPromptItem,
  EshrahGamePhase
} from '../../../types/eshrah';
import { getRandomPrompt, ESHRAH_CATEGORIES_CONFIG } from '../../../data/eshrahWordsBank';
import { sound } from '../../../lib/audio';

export const OneWordTVView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // State
  const [phase, setPhase] = useState<EshrahGamePhase>('TEAMS');
  const [players, setPlayers] = useState<EshrahPlayer[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<EshrahCategory[]>([
    'football', 'tv_series', 'movies', 'proverbs', 'tools', 'food'
  ]);
  const [currentRound, setCurrentRound] = useState<number>(1); // 1 to 5
  const [team1Score, setTeam1Score] = useState<number>(0);
  const [team2Score, setTeam2Score] = useState<number>(0);
  const [currentPrompt, setCurrentPrompt] = useState<EshrahPromptItem | null>(null);
  const [usedPromptIds, setUsedPromptIds] = useState<Set<string>>(new Set());
  const [activeTurnClueTeam, setActiveTurnClueTeam] = useState<EshrahTeamId>('team_1');
  const [roundWinnerTeam, setRoundWinnerTeam] = useState<EshrahTeamId | null>(null);
  const [isWordRevealedOnTV, setIsWordRevealedOnTV] = useState<boolean>(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const phaseRef = useRef(phase);
  const playersRef = useRef(players);
  const team1ScoreRef = useRef(team1Score);
  const team2ScoreRef = useRef(team2Score);
  const currentPromptRef = useRef(currentPrompt);
  const currentRoundRef = useRef(currentRound);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { team1ScoreRef.current = team1Score; }, [team1Score]);
  useEffect(() => { team2ScoreRef.current = team2Score; }, [team2Score]);
  useEffect(() => { currentPromptRef.current = currentPrompt; }, [currentPrompt]);
  useEffect(() => { currentRoundRef.current = currentRound; }, [currentRound]);

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
        activeTurnClueTeam,
        roundWinnerTeam,
        ...customPayload
      }
    });
  }, [activeTurnClueTeam, roundWinnerTeam]);

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
      .on('broadcast', { event: 'ONE_WORD_ACTION' }, ({ payload }) => {
        handleOneWordAction(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, broadcastSync]);

  // Handle Action from Mobile
  const handleOneWordAction = (payload: { action: 'WIN_TEAM_1' | 'WIN_TEAM_2' | 'PASS_CLUE_TURN' | 'SKIP_WORD' }) => {
    const { action } = payload;

    if (action === 'WIN_TEAM_1') {
      sound.playVictory();
      setTeam1Score((prev) => prev + 1);
      team1ScoreRef.current += 1;
      setRoundWinnerTeam('team_1');
      setIsWordRevealedOnTV(true);
      setPhase('ROUND_RESULT');
      broadcastSync({
        phase: 'ROUND_RESULT',
        roundWinnerTeam: 'team_1',
        team1Score: team1ScoreRef.current
      });
    } else if (action === 'WIN_TEAM_2') {
      sound.playVictory();
      setTeam2Score((prev) => prev + 1);
      team2ScoreRef.current += 1;
      setRoundWinnerTeam('team_2');
      setIsWordRevealedOnTV(true);
      setPhase('ROUND_RESULT');
      broadcastSync({
        phase: 'ROUND_RESULT',
        roundWinnerTeam: 'team_2',
        team2Score: team2ScoreRef.current
      });
    } else if (action === 'PASS_CLUE_TURN') {
      sound.playClick();
      setActiveTurnClueTeam((prev) => (prev === 'team_1' ? 'team_2' : 'team_1'));
      broadcastSync({
        activeTurnClueTeam: activeTurnClueTeam === 'team_1' ? 'team_2' : 'team_1'
      });
    } else if (action === 'SKIP_WORD') {
      sound.playClick();
      const nextPrompt = getRandomPrompt(selectedCategories, usedPromptIds);
      setUsedPromptIds((prev) => new Set([...prev, nextPrompt.id]));
      setCurrentPrompt(nextPrompt);
      currentPromptRef.current = nextPrompt;
      broadcastSync({ prompt: nextPrompt });
    }
  };

  // Advance Next Round (5 rounds total)
  const handleAdvanceNextRound = () => {
    sound.playClick();
    const nextRound = currentRound + 1;

    if (nextRound > 5) {
      sound.playVictory();
      setPhase('PODIUM');
      broadcastSync({ phase: 'PODIUM' });
      return;
    }

    const nextPrompt = getRandomPrompt(selectedCategories, usedPromptIds);
    setUsedPromptIds((prev) => new Set([...prev, nextPrompt.id]));
    setCurrentPrompt(nextPrompt);
    setCurrentRound(nextRound);
    setRoundWinnerTeam(null);
    setIsWordRevealedOnTV(false);
    setActiveTurnClueTeam('team_1');
    setPhase('ROUND_READY');

    broadcastSync({
      phase: 'ROUND_READY',
      currentRound: nextRound,
      prompt: nextPrompt,
      activeTurnClueTeam: 'team_1',
      roundWinnerTeam: null
    });
  };

  // Launch Match from Categories
  const handleLaunchMatch = () => {
    const firstPrompt = getRandomPrompt(selectedCategories, usedPromptIds);
    setUsedPromptIds(new Set([firstPrompt.id]));
    setCurrentPrompt(firstPrompt);
    setCurrentRound(1);
    setTeam1Score(0);
    setTeam2Score(0);
    setRoundWinnerTeam(null);
    setIsWordRevealedOnTV(false);
    setActiveTurnClueTeam('team_1');
    setPhase('ROUND_READY');

    broadcastSync({
      phase: 'ROUND_READY',
      currentRound: 1,
      team1Score: 0,
      team2Score: 0,
      prompt: firstPrompt,
      activeTurnClueTeam: 'team_1'
    });
  };

  // Start Playing Round
  const handleStartPlaying = () => {
    sound.playRoundStart();
    setPhase('PLAYING');
    broadcastSync({ phase: 'PLAYING' });
  };

  const categoryLabel = ESHRAH_CATEGORIES_CONFIG.find(
    (c) => c.id === currentPrompt?.category
  )?.label || 'عام';

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

      {/* TopBar */}
      <div className="relative z-20">
        <EshrahTopBar
          roomCode={roomCode}
          gameTitle="كلمة واحدة"
          phase={phase}
          onTerminate={() => {
            sound.playClick();
            setPhase('TEAMS');
            broadcastSync({ phase: 'TEAMS' });
          }}
          onExit={() => navigate('/')}
        />
      </div>

      <main className="flex-1 flex flex-col items-center justify-between p-4 md:p-6 relative z-10 max-w-6xl mx-auto w-full">
        {/* ================= 1. TEAMS ================= */}
        {phase === 'TEAMS' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto">
            <CleanTeamSelection
              players={players}
              isHost={true}
              onJoinTeam={() => {}}
              onConfirmTeams={() => {
                sound.playClick();
                setPhase('CATEGORIES');
                broadcastSync({ phase: 'CATEGORIES' });
              }}
            />
          </div>
        )}

        {/* ================= 2. CATEGORIES ================= */}
        {phase === 'CATEGORIES' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-auto">
            <CategoryPicker
              selectedCategories={selectedCategories}
              onChangeCategories={setSelectedCategories}
              onStartMatch={handleLaunchMatch}
              onBackToTeams={() => {
                sound.playClick();
                setPhase('TEAMS');
                broadcastSync({ phase: 'TEAMS' });
              }}
            />
          </div>
        )}

        {/* ================= 3. ROUND READY ================= */}
        {phase === 'ROUND_READY' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center gap-6 my-auto text-center max-w-xl">
            <span className="text-xs font-black text-[#5C4033] bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
              جولة المواجهة {currentRound} من 5
            </span>

            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <h3 className="text-2xl font-black text-[#2C2A29]">
                يقف ممثل من كل فريق أمام الشاشة!
              </h3>

              <span className="text-xs font-black bg-[#E5E0D5] text-[#8A9A5B] px-3 py-1 rounded-xl border border-[#2C2A29]">
                الفئة: {categoryLabel}
              </span>

              <div className="text-xs font-bold text-[#5C4033] leading-relaxed max-w-md">
                الممثلان الواقفان يريان نفس الكلمة السرية على جوالهما.. كل ممثل يعطي فريقه تلميحاً من <strong>كلمة واحدة فقط</strong> بالتبادل، وأول فريق في الصالة يصرخ بالإجابة الصحيحة يكسب النقطة!
              </div>

              <button
                onClick={handleStartPlaying}
                className="w-full py-4 mt-2 rounded-2xl font-black text-lg bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] hover:bg-[#78884e] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play size={20} />
                <span>بدء المواجهة</span>
              </button>
            </div>

            <div className="w-full flex justify-around items-center bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-3 shadow-[3px_3px_0px_#2C2A29]">
              <span className="text-sm font-black text-[#8A9A5B]">الفريق الأول: {team1Score} pt</span>
              <span className="text-xs text-[#5C4033]">|</span>
              <span className="text-sm font-black text-[#C68B59]">الفريق الثاني: {team2Score} pt</span>
            </div>
          </div>
        )}

        {/* ================= 4. PLAYING ================= */}
        {phase === 'PLAYING' && (
          <div className="w-full flex-1 flex flex-col items-center justify-between my-auto gap-6 max-w-2xl">
            {/* Header Status */}
            <div className="flex justify-between items-center w-full bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-4 shadow-[3px_3px_0px_#2C2A29]">
              <span className="text-sm font-black text-[#2C2A29]">
                المواجهة قائمة: تلميح كلمة واحدة بالتبادل
              </span>
              <span className="text-xs font-black bg-[#E5E0D5] border border-[#2C2A29] px-3 py-1 rounded-xl">
                فئة: {categoryLabel}
              </span>
            </div>

            {/* Arena Card */}
            <div className="flex flex-col items-center justify-center bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-3xl p-8 w-full text-center gap-4">
              <span className="text-xs font-black text-[#5C4033]">
                الدور في إعطاء التلميح الآن عند ممثل:
              </span>

              <div className="text-2xl md:text-3xl font-black bg-[#E5E0D5] px-6 py-2 rounded-2xl border-2 border-[#2C2A29]">
                {activeTurnClueTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'}
              </div>

              {/* Secret Word Box (Hidden on TV so sitting players can't cheat) */}
              <div className="w-full bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-2xl p-4 mt-2 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#5C4033]">
                  {isWordRevealedOnTV ? <Eye size={15} /> : <EyeOff size={15} />}
                  <span>الكلمة السرية تظهر على جوال الممثلَين الواقفَين فقط لمنع الغش!</span>
                </div>

                {isWordRevealedOnTV && (
                  <div className="text-3xl font-black text-[#8A9A5B] mt-1">
                    {currentPrompt?.text}
                  </div>
                )}
              </div>
            </div>

            {/* Score Strip */}
            <div className="w-full flex justify-around items-center bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-3 shadow-[3px_3px_0px_#2C2A29]">
              <span className="text-sm font-black text-[#8A9A5B]">الفريق الأول: {team1Score} pt</span>
              <span className="text-xs text-[#5C4033]">الجولة {currentRound} / 5</span>
              <span className="text-sm font-black text-[#C68B59]">الفريق الثاني: {team2Score} pt</span>
            </div>
          </div>
        )}

        {/* ================= 5. ROUND RESULT ================= */}
        {phase === 'ROUND_RESULT' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center gap-6 my-auto text-center max-w-lg">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] w-full flex flex-col items-center gap-4">
              <span className="text-xs font-black text-[#5C4033] bg-[#E5E0D5] px-3 py-1 rounded-xl border border-[#2C2A29]">
                نهاية الجولة {currentRound}
              </span>

              <h3 className="text-2xl font-black text-[#2C2A29]">
                أحرز النقطة:{' '}
                <span className={roundWinnerTeam === 'team_1' ? 'text-[#8A9A5B]' : 'text-[#C68B59]'}>
                  {roundWinnerTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'} (+1 pt)
                </span>
              </h3>

              <div className="w-full p-4 rounded-2xl bg-[#E5E0D5] border-2 border-[#2C2A29] flex flex-col gap-1 text-center my-2">
                <span className="text-xs font-bold text-[#5C4033]">الكلمة السرية كانت:</span>
                <span className="text-2xl font-black text-[#8A9A5B]">{currentPrompt?.text}</span>
              </div>

              <button
                onClick={handleAdvanceNextRound}
                className="w-full py-3.5 rounded-2xl font-black text-base bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] hover:bg-[#78884e] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>الانتقال للجولة التالية</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= 6. PODIUM ================= */}
        {phase === 'PODIUM' && (
          <EshrahPodium
            team1Score={team1Score}
            team2Score={team2Score}
            onPlayAgain={() => {
              setPhase('TEAMS');
              broadcastSync({ phase: 'TEAMS' });
            }}
            onBackToHome={() => navigate('/')}
          />
        )}
      </main>
    </div>
  );
};
