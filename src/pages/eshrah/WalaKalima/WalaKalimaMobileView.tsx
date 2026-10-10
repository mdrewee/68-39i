import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, AlertTriangle, ShieldCheck, Clock, Users, X } from 'lucide-react';
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

export const WalaKalimaMobileView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // Player session
  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const playerName = useMemo(() => getOrCreatePlayerName(), []);

  // State
  const [phase, setPhase] = useState<EshrahGamePhase>('TEAMS');
  const [players, setPlayers] = useState<EshrahPlayer[]>([]);
  const [myTeamId, setMyTeamId] = useState<EshrahTeamId | null>(null);
  const [activeTeam, setActiveTeam] = useState<EshrahTeamId>('team_1');
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [currentPrompt, setCurrentPrompt] = useState<EshrahPromptItem | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [stealTimeLeft, setStealTimeLeft] = useState<number>(15);
  const [team1Score, setTeam1Score] = useState<number>(0);
  const [team2Score, setTeam2Score] = useState<number>(0);
  const [roundResultText, setRoundResultText] = useState<string>('');

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Setup Realtime Channel
  useEffect(() => {
    const normalizedCode = roomCode.trim().toUpperCase();
    if (!normalizedCode) return;

    const channel = supabase.channel(`wala_kalima:${normalizedCode}`, {
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
      .on('broadcast', { event: 'WALA_KALIMA_SYNC' }, ({ payload }) => {
        if (!payload) return;
        if (payload.phase) setPhase(payload.phase);
        if (payload.players) setPlayers(payload.players);
        if (payload.activeTeam) setActiveTeam(payload.activeTeam);
        if (payload.currentRound) setCurrentRound(payload.currentRound);
        if (payload.prompt !== undefined) setCurrentPrompt(payload.prompt);
        if (payload.timeLeft !== undefined) setTimeLeft(payload.timeLeft);
        if (payload.stealTimeLeft !== undefined) setStealTimeLeft(payload.stealTimeLeft);
        if (payload.team1Score !== undefined) setTeam1Score(payload.team1Score);
        if (payload.team2Score !== undefined) setTeam2Score(payload.team2Score);
        if (payload.roundResultText) setRoundResultText(payload.roundResultText);
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

  // Handle joining a team
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

  // Referee Button: Correct Answer
  const handleRefereeCorrect = () => {
    sound.playClick();
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'REFEREE_ACTION',
        payload: { action: 'CORRECT' }
      });
    }
  };

  // Referee Button: Steal Success
  const handleRefereeStealSuccess = () => {
    sound.playClick();
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'REFEREE_ACTION',
        payload: { action: 'STEAL_SUCCESS' }
      });
    }
  };

  // Referee Button: Steal Fail
  const handleRefereeStealFail = () => {
    sound.playClick();
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'REFEREE_ACTION',
        payload: { action: 'STEAL_FAIL' }
      });
    }
  };

  const isMyTeamActing = myTeamId === activeTeam;
  const isMyTeamReferee = myTeamId !== null && myTeamId !== activeTeam;

  const categoryLabel = ESHRAH_CATEGORIES_CONFIG.find(
    (c) => c.id === currentPrompt?.category
  )?.label || 'عام';

  return (
    <div className="min-h-screen bg-[#E5E0D5] flex flex-col font-sans select-none overflow-x-hidden relative" dir="rtl">
      {/* Background static dot pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40 z-0"
        style={{
          backgroundImage: 'radial-gradient(#2C2A29 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />

      {/* TopBar */}
      <div className="relative z-20">
        <MobileTopBar
          roomCode={roomCode}
          playerName={playerName}
          title="ولا كلمة"
          onLeaveRoom={() => {
            sessionStorage.clear();
            navigate('/');
          }}
        />
      </div>

      <main className="flex-1 flex flex-col max-w-md w-full mx-auto p-3 relative z-10 justify-between pb-6">
        {/* ================= 1. TEAMS PHASE ================= */}
        {phase === 'TEAMS' && (
          <div className="flex-1 flex flex-col justify-center my-auto">
            <CleanTeamSelection
              players={players}
              currentUserId={playerId}
              isHost={false}
              onJoinTeam={handleJoinTeam}
              onConfirmTeams={() => {}}
            />
          </div>
        )}

        {/* ================= 2. CATEGORIES PHASE ================= */}
        {phase === 'CATEGORIES' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 my-auto">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-6 shadow-[3px_3px_0px_#2C2A29] w-full">
              <span className="text-sm font-bold text-[#5C4033] block mb-2">
                جاري تحديد الفئات من شاشة المضيف...
              </span>
              <p className="text-xs text-[#2C2A29]">
                أنت في <strong className="text-[#8A9A5B]">{myTeamId === 'team_1' ? 'الفريق الأول' : myTeamId === 'team_2' ? 'الفريق الثاني' : 'بانتظار الانضمام'}</strong>
              </p>
            </div>
          </div>
        )}

        {/* ================= 3. ROUND READY ================= */}
        {phase === 'ROUND_READY' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 my-auto">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-6 shadow-[4px_4px_0px_#2C2A29] w-full flex flex-col items-center gap-3">
              <span className="text-xs font-black bg-[#E5E0D5] px-3 py-1 rounded-xl border border-[#2C2A29]">
                الجولة {currentRound} من 5
              </span>

              {isMyTeamActing ? (
                <>
                  <h3 className="text-xl font-black text-[#8A9A5B]">دور فريقك في التمثيل!</h3>
                  <p className="text-xs font-bold text-[#5C4033] leading-relaxed">
                    استلم الجوال إذا كنت الممثل لقراءة الكلمة السرية فور انطلاق المؤقت.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-black text-[#C68B59]">فريقك هو الحكم في هذا الدور!</h3>
                  <p className="text-xs font-bold text-[#5C4033] leading-relaxed">
                    ستظهر لك الكلمة والمؤقت للتحكيم واحتساب الإجابة الصحيحة أو السرقة.
                  </p>
                </>
              )}
            </div>

            <div className="w-full flex justify-around p-3 rounded-xl bg-[#F7F4EC] border-2 border-[#2C2A29] text-xs font-black">
              <span>الفريق الأول: {team1Score} pt</span>
              <span>الفريق الثاني: {team2Score} pt</span>
            </div>
          </div>
        )}

        {/* ================= 4. PLAYING PHASE (60s) ================= */}
        {phase === 'PLAYING' && (
          <div className="flex-1 flex flex-col justify-between gap-4">
            {/* ROLE A: ACTOR (Active Team) */}
            {isMyTeamActing && (
              <div className="flex-1 flex flex-col justify-between gap-4 my-auto">
                <div className="text-center">
                  <span className="text-xs font-black bg-[#8A9A5B] text-white px-3 py-1 rounded-xl border border-[#2C2A29]">
                    أنت الفريق الممثل
                  </span>
                  <p className="text-[11px] font-bold text-[#5C4033] mt-2">
                    مثل الكلمة بدون أي صوت أو كلام أو رسم حروف بالهواء!
                  </p>
                </div>

                {/* Secret Prompt Card */}
                <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] flex flex-col items-center text-center gap-3 my-auto">
                  <span className="text-xs font-black text-[#5C4033] bg-[#E5E0D5] px-3 py-1 rounded-xl border border-[#2C2A29]">
                    الفئة: {categoryLabel}
                  </span>

                  <div className="text-3xl sm:text-4xl font-black text-[#2C2A29] py-4">
                    {currentPrompt?.text}
                  </div>
                </div>

                {/* Advice banner */}
                <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-2xl p-3 text-center text-xs font-bold text-[#5C4033]">
                  باقي الفريق يخمن الكلمة بصوت عالٍ بالصالة!
                </div>
              </div>
            )}

            {/* ROLE B: REFEREE (Opponent Team) */}
            {isMyTeamReferee && (
              <div className="flex-1 flex flex-col justify-between gap-4">
                <div className="text-center">
                  <span className="text-xs font-black bg-[#C68B59] text-white px-3 py-1 rounded-xl border border-[#2C2A29]">
                    أنت الفريق الحكم (المنافس)
                  </span>
                  <p className="text-[11px] font-bold text-[#5C4033] mt-1">
                    تابع تمثيل الفريق وتخميناتهم؛ إذا قالوا الكلمة صح اضغط الزر فوراً!
                  </p>
                </div>

                {/* Verification Card with Secret Word */}
                <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-5 shadow-[4px_4px_0px_#2C2A29] flex flex-col items-center text-center gap-2">
                  <span className="text-xs font-black text-[#5C4033]">الكلمة المطلوب تخمينها:</span>
                  <div className="text-2xl sm:text-3xl font-black text-[#8A9A5B]">
                    {currentPrompt?.text}
                  </div>
                </div>

                {/* Referee Action Button */}
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={handleRefereeCorrect}
                    className="w-full py-4 rounded-2xl font-black text-lg bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] hover:bg-[#78884e] active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check size={22} strokeWidth={3} />
                    <span>إجابة صحيحة للفريق الممثل (+1 pt)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Audience / Spectator if no team chosen */}
            {!isMyTeamActing && !isMyTeamReferee && (
              <div className="flex-1 flex flex-col items-center justify-center text-center my-auto">
                <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-5 text-xs font-bold text-[#5C4033]">
                  أنت متفرج في هذه الجولة، تابع الشاشة!
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 5. STEAL WINDOW (15s) ================= */}
        {phase === 'STEAL_WINDOW' && (
          <div className="flex-1 flex flex-col justify-between gap-4 my-auto">
            <div className="bg-[#C68B59] text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-3xl p-5 text-center flex flex-col items-center gap-2">
              <AlertTriangle size={32} />
              <h3 className="text-xl font-black">فرصة سرقة!</h3>
              <p className="text-xs opacity-90">
                {isMyTeamReferee
                  ? 'يحق لفريقكم الآن تخمين الكلمة مرة واحدة بصوت عالٍ في الصالة!'
                  : 'الفريق المنافس يحاول سرقة النقطة الآن!'}
              </p>
            </div>

            {/* Steal Controls for Opponent */}
            {isMyTeamReferee && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleRefereeStealSuccess}
                  className="w-full py-3.5 rounded-2xl font-black text-base bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] hover:bg-[#78884e] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check size={18} strokeWidth={3} />
                  <span>سرقة صحيحة لفريقنا! (+1 pt)</span>
                </button>

                <button
                  onClick={handleRefereeStealFail}
                  className="w-full py-3 rounded-2xl font-black text-xs bg-[#F7F4EC] text-[#2C2A29] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] hover:bg-[#E5E0D5] flex items-center justify-center gap-1 cursor-pointer"
                >
                  <X size={16} />
                  <span>فشلت السرقة (0 pt)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= 6. ROUND RESULT ================= */}
        {phase === 'ROUND_RESULT' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 my-auto">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-5 shadow-[3px_3px_0px_#2C2A29] w-full">
              <span className="text-xs font-black text-[#5C4033] block mb-2">نتيجة الجولة:</span>
              <p className="text-base font-black text-[#2C2A29]">{roundResultText}</p>
              <div className="text-sm font-bold text-[#8A9A5B] mt-2">
                الكلمة: {currentPrompt?.text}
              </div>
            </div>

            <div className="text-xs font-bold text-[#5C4033]">
              بانتظار بدء الدور التالي من شاشة العرض...
            </div>
          </div>
        )}

        {/* ================= 7. PODIUM ================= */}
        {phase === 'PODIUM' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 my-auto">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-6 shadow-[4px_4px_0px_#2C2A29] w-full">
              <h3 className="text-2xl font-black text-[#2C2A29] mb-3">نهاية التحدي!</h3>
              <p className="text-sm font-bold text-[#8A9A5B]">
                الفريق الأول: {team1Score} pt | الفريق الثاني: {team2Score} pt
              </p>
            </div>

            <button
              onClick={() => navigate('/')}
              className="w-full bg-[#C68B59] text-white py-3.5 rounded-2xl font-black text-base border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29]"
            >
              العودة للرئيسية
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
