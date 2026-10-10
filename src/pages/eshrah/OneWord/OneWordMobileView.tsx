import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, ArrowRightLeft, SkipForward, Users, Sparkles, Trophy } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { MobileTopBar } from '../../../components/MobileTopBar';
import { CleanTeamSelection } from '../../../components/eshrah/CleanTeamSelection';
import {
  EshrahPlayer,
  EshrahTeamId,
  EshrahPromptItem,
  EshrahGamePhase
} from '../../../types/eshrah';
import { ESHRAH_CATEGORIES_CONFIG } from '../../../data/eshrahWordsBank';
import { getOrCreatePlayerId, getOrCreatePlayerName } from '../../../utils/playerSession';
import { sound } from '../../../lib/audio';

export const OneWordMobileView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // Player identity
  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const playerName = useMemo(() => getOrCreatePlayerName(), []);

  // State
  const [phase, setPhase] = useState<EshrahGamePhase>('TEAMS');
  const [players, setPlayers] = useState<EshrahPlayer[]>([]);
  const [myTeamId, setMyTeamId] = useState<EshrahTeamId | null>(null);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [currentPrompt, setCurrentPrompt] = useState<EshrahPromptItem | null>(null);
  const [activeTurnClueTeam, setActiveTurnClueTeam] = useState<EshrahTeamId>('team_1');
  const [roundWinnerTeam, setRoundWinnerTeam] = useState<EshrahTeamId | null>(null);
  const [team1Score, setTeam1Score] = useState<number>(0);
  const [team2Score, setTeam2Score] = useState<number>(0);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Setup Realtime Channel
  useEffect(() => {
    const normalizedCode = roomCode.trim().toUpperCase();
    if (!normalizedCode) return;

    const channel = supabase.channel(`one_word:${normalizedCode}`, {
      config: { broadcast: { self: true }, presence: { key: playerId } }
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
              active.push({
                id: p.playerId,
                name: p.playerName,
                teamId: p.teamId || null,
                isHost: !!p.isHost
              });
            }
          });
        });
        const unique = Array.from(new Map(active.map((p) => [p.id, p])).values());
        setPlayers(unique);
      })
      .on('broadcast', { event: 'ONE_WORD_SYNC' }, ({ payload }) => {
        if (!payload) return;
        if (payload.phase) setPhase(payload.phase);
        if (payload.players) setPlayers(payload.players);
        if (payload.currentRound) setCurrentRound(payload.currentRound);
        if (payload.prompt !== undefined) setCurrentPrompt(payload.prompt);
        if (payload.activeTurnClueTeam) setActiveTurnClueTeam(payload.activeTurnClueTeam);
        if (payload.roundWinnerTeam !== undefined) setRoundWinnerTeam(payload.roundWinnerTeam);
        if (payload.team1Score !== undefined) setTeam1Score(payload.team1Score);
        if (payload.team2Score !== undefined) setTeam2Score(payload.team2Score);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            playerId,
            playerName,
            teamId: myTeamId,
            joinedAt: Date.now()
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, playerId, playerName, myTeamId]);

  // Handle joining team
  const handleJoinTeam = (teamId: EshrahTeamId) => {
    setMyTeamId(teamId);
    if (channelRef.current) {
      channelRef.current.track({
        playerId,
        playerName,
        teamId,
        joinedAt: Date.now()
      });
      channelRef.current.send({
        type: 'broadcast',
        event: 'PLAYER_JOIN_TEAM',
        payload: { playerId, teamId }
      });
    }
  };

  // Dispatch Action
  const sendAction = (action: 'WIN_TEAM_1' | 'WIN_TEAM_2' | 'PASS_CLUE_TURN' | 'SKIP_WORD') => {
    sound.playClick();
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'ONE_WORD_ACTION',
        payload: { action }
      });
    }
  };

  const categoryLabel = ESHRAH_CATEGORIES_CONFIG.find(
    (c) => c.id === currentPrompt?.category
  )?.label || 'عام';

  return (
    <div className="min-h-screen bg-[#E5E0D5] flex flex-col font-sans select-none overflow-x-hidden relative" dir="rtl">
      {/* Background static dots */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40 z-0"
        style={{
          backgroundImage: 'radial-gradient(#2C2A29 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* TopBar */}
      <div className="relative z-20">
        <MobileTopBar
          roomCode={roomCode}
          onExit={() => navigate('/')}
        />
      </div>

      <main className="flex-1 flex flex-col p-4 relative z-10 max-w-lg mx-auto w-full">
        {/* ================= 1. TEAMS ================= */}
        {phase === 'TEAMS' && (
          <div className="flex-1 flex flex-col items-center justify-center my-auto w-full">
            <div className="text-center mb-6">
              <span className="text-xs font-black text-[#5C4033] bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29] inline-block mb-2">
                اشرح: كلمة واحدة
              </span>
              <h2 className="text-xl font-black text-[#2C2A29]">اختر فريقك للمواجهة</h2>
            </div>

            <CleanTeamSelection
              players={players}
              currentUserId={playerId}
              isHost={false}
              onJoinTeam={handleJoinTeam}
              onConfirmTeams={() => {}}
            />
          </div>
        )}

        {/* ================= 2. CATEGORIES WAITING ================= */}
        {phase === 'CATEGORIES' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto gap-4">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] w-full">
              <Sparkles className="w-12 h-12 text-[#C68B59] mx-auto mb-3" />
              <h3 className="text-xl font-black text-[#2C2A29] mb-2">اختيار الفئات</h3>
              <p className="text-sm font-bold text-[#5C4033]">
                مضيف اللعبة يحدد فئات الكلمات على شاشة التلفزيون...
              </p>
            </div>
          </div>
        )}

        {/* ================= 3. ROUND READY ================= */}
        {phase === 'ROUND_READY' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto gap-4">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] w-full">
              <span className="text-xs font-black text-[#5C4033] bg-[#E5E0D5] border-2 border-[#2C2A29] px-3 py-1 rounded-xl shadow-[2px_2px_0px_#2C2A29] inline-block mb-3">
                جولة {currentRound} من 5
              </span>
              <h3 className="text-2xl font-black text-[#2C2A29] mb-2">استعد للمواجهة!</h3>
              <p className="text-sm font-bold text-[#5C4033] mb-4">
                ممثل من كل فريق يقف أمام الشاشة ويمسك جواله لرؤية الكلمة السرية المشتركة.
              </p>
              <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-2xl p-4 text-xs font-bold text-[#2C2A29]">
                الفئة المختارة: <span className="font-black text-[#C68B59]">{categoryLabel}</span>
              </div>
            </div>
          </div>
        )}

        {/* ================= 4. PLAYING ================= */}
        {phase === 'PLAYING' && (
          <div className="flex-1 flex flex-col justify-between gap-4 my-auto w-full">
            {/* Round info & clue turn banner */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#2C2A29] bg-[#F7F4EC] border-2 border-[#2C2A29] px-3 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                جولة {currentRound} / 5
              </span>
              <div className={`px-4 py-1.5 rounded-xl border-2 border-[#2C2A29] font-black text-xs shadow-[2px_2px_0px_#2C2A29] ${
                activeTurnClueTeam === 'team_1' ? 'bg-[#8A9A5B] text-white' : 'bg-[#C68B59] text-white'
              }`}>
                دور التلميح الآن: {activeTurnClueTeam === 'team_1' ? 'فريق 1' : 'فريق 2'}
              </div>
            </div>

            {/* Secret Word Card (Revealed on phone for representatives) */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[6px_6px_0px_#2C2A29] flex flex-col items-center text-center">
              <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] px-4 py-1 rounded-xl text-xs font-bold text-[#5C4033] mb-3">
                الفئة: {categoryLabel}
              </div>
              <span className="text-xs font-bold text-[#5C4033] mb-1">الكلمة السرية المشتركة:</span>
              <div className="text-4xl md:text-5xl font-black text-[#2C2A29] tracking-wide my-3">
                {currentPrompt?.text || '...'}
              </div>
              <p className="text-xs font-bold text-[#5C4033] mt-2 bg-[#E5E0D5]/60 border border-[#2C2A29]/20 px-3 py-1.5 rounded-xl">
                ⚠️ مسموح بكلمة واحدة فقط كتلميح لكل دور! التلميح ينتقل بين الفريقين.
              </p>
            </div>

            {/* Verification and Clue Turn Controls */}
            <div className="flex flex-col gap-3">
              {/* Correct Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => sendAction('WIN_TEAM_1')}
                  className="bg-[#8A9A5B] hover:bg-[#78884d] active:scale-95 text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl py-3.5 px-3 flex flex-col items-center justify-center gap-1 transition-all"
                >
                  <Check className="w-6 h-6 stroke-[3]" />
                  <span className="font-black text-sm">فريق 1 جاوب صح!</span>
                  <span className="text-[11px] font-bold opacity-90">(+1 pt)</span>
                </button>

                <button
                  onClick={() => sendAction('WIN_TEAM_2')}
                  className="bg-[#C68B59] hover:bg-[#b0794b] active:scale-95 text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl py-3.5 px-3 flex flex-col items-center justify-center gap-1 transition-all"
                >
                  <Check className="w-6 h-6 stroke-[3]" />
                  <span className="font-black text-sm">فريق 2 جاوب صح!</span>
                  <span className="text-[11px] font-bold opacity-90">(+1 pt)</span>
                </button>
              </div>

              {/* Clue Turn Pass Button */}
              <button
                onClick={() => sendAction('PASS_CLUE_TURN')}
                className="w-full bg-[#F7F4EC] hover:bg-white active:scale-98 text-[#2C2A29] border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl py-3 px-4 flex items-center justify-center gap-2 font-black text-sm transition-all"
              >
                <ArrowRightLeft className="w-5 h-5" />
                <span>تمرير دور التلميح للفريق الآخر</span>
              </button>

              {/* Skip Word */}
              <button
                onClick={() => sendAction('SKIP_WORD')}
                className="w-full bg-[#E5E0D5] hover:bg-[#d8d2c5] active:scale-98 text-[#5C4033] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl py-2 px-3 flex items-center justify-center gap-2 font-bold text-xs transition-all"
              >
                <SkipForward className="w-4 h-4" />
                <span>تخطي الكلمة وتغييرها</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= 5. ROUND RESULT ================= */}
        {phase === 'ROUND_RESULT' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto gap-4">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] w-full">
              <Trophy className="w-12 h-12 text-[#8A9A5B] mx-auto mb-2" />
              <h3 className="text-2xl font-black text-[#2C2A29] mb-1">
                {roundWinnerTeam === 'team_1' ? 'فريق 1 كسب النقطة! 🎉' : 'فريق 2 كسب النقطة! 🎉'}
              </h3>
              <p className="text-sm font-bold text-[#5C4033] mb-4">
                الكلمة كانت: <span className="font-black text-[#2C2A29] underline">{currentPrompt?.text}</span>
              </p>

              {/* Current Score Cards */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-[#8A9A5B]/15 border-2 border-[#2C2A29] rounded-2xl p-3">
                  <div className="text-xs font-bold text-[#2C2A29]">فريق 1</div>
                  <div className="text-2xl font-black text-[#8A9A5B]">{team1Score} pt</div>
                </div>
                <div className="bg-[#C68B59]/15 border-2 border-[#2C2A29] rounded-2xl p-3">
                  <div className="text-xs font-bold text-[#2C2A29]">فريق 2</div>
                  <div className="text-2xl font-black text-[#C68B59]">{team2Score} pt</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 6. PODIUM ================= */}
        {phase === 'PODIUM' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto gap-4">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] w-full">
              <Trophy className="w-14 h-14 text-[#C68B59] mx-auto mb-3" />
              <h3 className="text-2xl font-black text-[#2C2A29] mb-2">نهاية المباراة!</h3>
              <p className="text-sm font-bold text-[#5C4033] mb-4">
                تابع منصة التتويج والنتائج النهائية على شاشة التلفزيون.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#8A9A5B] text-white border-2 border-[#2C2A29] rounded-2xl p-3">
                  <div className="text-xs font-bold">فريق 1</div>
                  <div className="text-2xl font-black">{team1Score} pt</div>
                </div>
                <div className="bg-[#C68B59] text-white border-2 border-[#2C2A29] rounded-2xl p-3">
                  <div className="text-xs font-bold">فريق 2</div>
                  <div className="text-2xl font-black">{team2Score} pt</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
