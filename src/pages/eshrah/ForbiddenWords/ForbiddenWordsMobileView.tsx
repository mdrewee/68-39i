import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, X, SkipForward, AlertOctagon, ShieldAlert, Award } from 'lucide-react';
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
import { getOrCreatePlayerId, getOrCreatePlayerName } from '../../../utils/playerSession';
import { sound } from '../../../lib/audio';

export const ForbiddenWordsMobileView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const playerName = useMemo(() => getOrCreatePlayerName(), []);

  // State
  const [phase, setPhase] = useState<EshrahGamePhase>('TEAMS');
  const [players, setPlayers] = useState<EshrahPlayer[]>([]);
  const [myTeamId, setMyTeamId] = useState<EshrahTeamId | null>(null);
  const [activeTeam, setActiveTeam] = useState<EshrahTeamId>('team_1');
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [currentPrompt, setCurrentPrompt] = useState<EshrahPromptItem | null>(null);
  const [currentRunCorrectCount, setCurrentRunCorrectCount] = useState<number>(0);
  const [skipsRemaining, setSkipsRemaining] = useState<number>(2);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [team1Score, setTeam1Score] = useState<number>(0);
  const [team2Score, setTeam2Score] = useState<number>(0);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Setup Realtime Channel
  useEffect(() => {
    const normalizedCode = roomCode.trim().toUpperCase();
    if (!normalizedCode) return;

    const channel = supabase.channel(`forbidden_words:${normalizedCode}`, {
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
      .on('broadcast', { event: 'FORBIDDEN_WORDS_SYNC' }, ({ payload }) => {
        if (!payload) return;
        if (payload.phase) setPhase(payload.phase);
        if (payload.players) setPlayers(payload.players);
        if (payload.activeTeam) setActiveTeam(payload.activeTeam);
        if (payload.currentRound) setCurrentRound(payload.currentRound);
        if (payload.prompt !== undefined) setCurrentPrompt(payload.prompt);
        if (payload.timeLeft !== undefined) setTimeLeft(payload.timeLeft);
        if (payload.currentRunCorrectCount !== undefined) setCurrentRunCorrectCount(payload.currentRunCorrectCount);
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

  // Actions
  const handleAction = (action: 'CORRECT' | 'VIOLATION' | 'SKIP') => {
    if (action === 'SKIP') {
      if (skipsRemaining <= 0) return;
      setSkipsRemaining((prev) => prev - 1);
    }

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'TABOO_ACTION',
        payload: { action }
      });
    }
  };

  const isMyTeamExplaining = myTeamId === activeTeam;
  const isMyTeamAuditing = myTeamId !== null && myTeamId !== activeTeam;

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
          title="كلمات محظورة"
          onLeaveRoom={() => {
            sessionStorage.clear();
            navigate('/');
          }}
        />
      </div>

      <main className="flex-1 flex flex-col max-w-md w-full mx-auto p-3 relative z-10 justify-between pb-6">
        {/* ================= 1. TEAMS ================= */}
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

        {/* ================= 2. CATEGORIES ================= */}
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
                جولة السرعة {currentRound} من 3
              </span>

              {isMyTeamExplaining ? (
                <>
                  <h3 className="text-xl font-black text-[#8A9A5B]">فريقك هو الشارح!</h3>
                  <p className="text-xs font-bold text-[#5C4033] leading-relaxed">
                    استلم الجوال، جهز سرعة كلامك، واشرح أكبر عدد من الكلمات في 60 ثانية بدون الكلمات المحظورة!
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-black text-[#C68B59]">فريقك هو المدقق (الحكم)!</h3>
                  <p className="text-xs font-bold text-[#5C4033] leading-relaxed">
                    استلم الجوال، استمع بتركيز شديد للشارح، واضغط مخالفة فوراً إذا نطق أي كلمة محظورة!
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

        {/* ================= 4. PLAYING (60s SPEED RUN) ================= */}
        {phase === 'PLAYING' && (
          <div className="flex-1 flex flex-col justify-between gap-3">
            {/* Header Status */}
            <div className="flex justify-between items-center bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-3 shadow-sm">
              <span className="text-xs font-black text-[#2C2A29]">
                {isMyTeamExplaining ? 'أنت الشارح (اشرح لفريقك)' : 'أنت المدقق (دقق على الشارح)'}
              </span>
              <span className="text-xs font-black text-[#8A9A5B]">
                {currentRunCorrectCount} صح ✓
              </span>
            </div>

            {/* TABOO CARD: Main Word + 4 Forbidden Words */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-5 shadow-[4px_4px_0px_#2C2A29] flex flex-col items-center gap-3">
              <span className="text-[11px] font-bold text-[#5C4033]">الكلمة المطلوب شرحها:</span>
              <div className="text-3xl font-black text-[#2C2A29] text-center border-b-2 border-[#2C2A29] pb-3 w-full">
                {currentPrompt?.text}
              </div>

              {/* Forbidden Words List */}
              <div className="w-full bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-2xl p-3 flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-[#C86D51] mb-1">
                  <AlertOctagon size={15} />
                  <span>الكلمات المحظورة (ممنوع نطقها):</span>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center w-full">
                  {(currentPrompt?.forbiddenWords || ['الهلال', 'كرة', 'ملعب', 'هدف']).map((w, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-black bg-[#F7F4EC] text-[#2C2A29] border border-[#2C2A29] px-2.5 py-1 rounded-xl shadow-xs"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* CONTROLS */}
            {/* Explainer Controls (Skip only) */}
            {isMyTeamExplaining && (
              <div className="flex flex-col gap-2 pt-1">
                <button
                  disabled={skipsRemaining <= 0}
                  onClick={() => handleAction('SKIP')}
                  className={`w-full py-3.5 rounded-2xl font-black text-sm border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] flex items-center justify-center gap-2 transition-all ${
                    skipsRemaining > 0
                      ? 'bg-[#C68B59] text-white hover:bg-[#b07849] active:translate-y-0.5 cursor-pointer'
                      : 'bg-[#E5E0D5] text-[#2C2A29]/40 border-[#2C2A29]/40 shadow-none cursor-not-allowed'
                  }`}
                >
                  <SkipForward size={16} />
                  <span>تخطي الكرت (باقي {skipsRemaining} مرات)</span>
                </button>
              </div>
            )}

            {/* Auditor Controls (Opponent Team): Correct & Violation */}
            {isMyTeamAuditing && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => handleAction('CORRECT')}
                  className="py-4 rounded-2xl font-black text-sm bg-[#8A9A5B] text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] hover:bg-[#78884e] active:translate-y-0.5 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check size={18} strokeWidth={3} />
                  <span>جابوها صح! (+1)</span>
                </button>

                <button
                  onClick={() => handleAction('VIOLATION')}
                  className="py-4 rounded-2xl font-black text-xs bg-[#C86D51] text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] hover:bg-[#2C2A29] active:translate-y-0.5 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <X size={18} strokeWidth={3} />
                  <span>مخالفة كلمة محظورة ✗</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= 5. ROUND RESULT ================= */}
        {phase === 'ROUND_RESULT' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 my-auto">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-5 shadow-[3px_3px_0px_#2C2A29] w-full">
              <span className="text-xs font-black text-[#5C4033] block mb-2">انتهت 60 ثانية:</span>
              <p className="text-xl font-black text-[#2C2A29]">
                أحرز الفريق الشارح: <span className="text-[#8A9A5B]">{currentRunCorrectCount} كلمات ✓</span>
              </p>
            </div>

            <div className="text-xs font-bold text-[#5C4033]">
              بانتظار بدء الجولة التالية من شاشة العرض...
            </div>
          </div>
        )}

        {/* ================= 6. PODIUM ================= */}
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
