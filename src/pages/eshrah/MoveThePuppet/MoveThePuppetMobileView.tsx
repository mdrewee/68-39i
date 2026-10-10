import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, AlertTriangle, ShieldCheck, Clock, Users, UserCheck, X } from 'lucide-react';
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

export const MoveThePuppetMobileView: React.FC = () => {
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

    const channel = supabase.channel(`move_the_puppet:${normalizedCode}`, {
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
      .on('broadcast', { event: 'MOVE_THE_PUPPET_SYNC' }, ({ payload }) => {
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

  const isMyTeamActive = myTeamId === activeTeam;
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
                اشرح: حرّك الدمية
              </span>
              <h2 className="text-xl font-black text-[#2C2A29]">اختر فريقك</h2>
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

              <h3 className="text-2xl font-black text-[#2C2A29] mb-2">
                {isMyTeamActive ? 'دور فريقكم في التوجيه!' : 'دوركم في التحكيم والوقت!'}
              </h3>

              <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-2xl p-4 text-xs font-bold text-[#5C4033] text-right space-y-2 mb-4">
                {isMyTeamActive ? (
                  <>
                    <p className="font-black text-[#8A9A5B]">📱 هذا الجوال يبقى مع أعضاء الفريق الموجّه!</p>
                    <p>⚠️ الدمية (لاعبكم الممثل) تقف في الصالة بدون جوال.</p>
                    <p>حركوا أطراف الدمية بدون كلام لتجسيد المشهد لفريقكم ليخمنه.</p>
                  </>
                ) : (
                  <>
                    <p className="font-black text-[#C68B59]">⏱️ أنتم الحكّام في هذه الجولة!</p>
                    <p>راقبوا دقة التنفيذ، وعندما يخمن فريقهم الإجابة اضغطوا [إجابة صحيحة].</p>
                    <p>إذا انتهت الـ 60 ثانية ستحصلون على 15 ثانية لسرقة النقطة!</p>
                  </>
                )}
              </div>

              <div className="text-xs font-bold text-[#5C4033]">
                في انتظار بدء الدور من شاشة التلفزيون...
              </div>
            </div>
          </div>
        )}

        {/* ================= 4. PLAYING ================= */}
        {phase === 'PLAYING' && (
          <div className="flex-1 flex flex-col justify-between gap-4 my-auto w-full">
            {/* Top Bar Status */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#2C2A29] bg-[#F7F4EC] border-2 border-[#2C2A29] px-3 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                جولة {currentRound} / 5
              </span>
              <div className="flex items-center gap-2 bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                <Clock className="w-4 h-4 text-[#C68B59]" />
                <span className="font-black text-sm text-[#2C2A29] font-mono">
                  00:{timeLeft.toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* DIRECTING TEAM VIEW */}
            {isMyTeamActive ? (
              <div className="flex-1 flex flex-col justify-between gap-4 my-auto">
                <div className="bg-[#8A9A5B]/15 border-2 border-[#8A9A5B] rounded-2xl p-3 text-center">
                  <span className="text-xs font-black text-[#8A9A5B]">
                    ⚠️ تنبيه: الدمية تقف بالصالة بدون جوال! وجّه أطرافها صامتاً.
                  </span>
                </div>

                <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[6px_6px_0px_#2C2A29] flex flex-col items-center text-center">
                  <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] px-4 py-1 rounded-xl text-xs font-bold text-[#5C4033] mb-3">
                    الفئة: {categoryLabel}
                  </div>
                  <span className="text-xs font-bold text-[#5C4033] mb-1">المشهد المطلوب توجيهه:</span>
                  <div className="text-3xl md:text-4xl font-black text-[#2C2A29] tracking-wide my-4 leading-snug">
                    {currentPrompt?.text || '...'}
                  </div>
                  <div className="bg-[#E5E0D5]/70 border border-[#2C2A29]/20 rounded-2xl p-3 text-xs font-bold text-[#5C4033] w-full text-right mt-2 space-y-1">
                    <p>• أمسك ذراعي وساقي الدمية وضعها في الوضعية المناسبة.</p>
                    <p>• ممنوع الكلام أو إصدار أي أصوات إطلاقاً!</p>
                  </div>
                </div>

                <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-4 text-center text-xs font-bold text-[#5C4033] shadow-[3px_3px_0px_#2C2A29]">
                  الفريق المنافس يتحكم بالوقت ويحتسب الإجابة الصحيحة
                </div>
              </div>
            ) : (
              /* OPPONENT REFEREE VIEW */
              <div className="flex-1 flex flex-col justify-between gap-4 my-auto">
                <div className="bg-[#C68B59]/15 border-2 border-[#C68B59] rounded-2xl p-3 text-center">
                  <span className="text-xs font-black text-[#C68B59]">
                    ⚖️ أنت الحَكَم! راقب تنفيذ المنافس واحتسب الوقت
                  </span>
                </div>

                <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[6px_6px_0px_#2C2A29] flex flex-col items-center text-center gap-3">
                  <ShieldCheck className="w-12 h-12 text-[#C68B59]" />
                  <h3 className="text-xl font-black text-[#2C2A29]">
                    الفريق المنافس يوجّه دميته الآن!
                  </h3>
                  <p className="text-xs font-bold text-[#5C4033]">
                    تأكد أنهم صامتون تماماً ولا يتكلمون، وأن الدمية تتحرك بتوجيه أطرافها فقط.
                  </p>
                  <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-xl px-4 py-2 text-xs font-bold text-[#2C2A29] w-full">
                    الفئة: <span className="font-black text-[#C68B59]">{categoryLabel}</span>
                  </div>
                </div>

                {/* Referee Verification Controls */}
                <button
                  onClick={handleRefereeCorrect}
                  className="w-full bg-[#8A9A5B] hover:bg-[#78884d] active:scale-98 text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl py-4 flex items-center justify-center gap-2 font-black text-lg transition-all"
                >
                  <Check className="w-6 h-6 stroke-[3]" />
                  <span>إجابة صحيحة للفريق (+1 pt)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= 5. STEAL WINDOW ================= */}
        {phase === 'STEAL_WINDOW' && (
          <div className="flex-1 flex flex-col justify-between gap-4 my-auto w-full">
            <div className="bg-[#C68B59] text-white border-2 border-[#2C2A29] rounded-2xl p-3 text-center shadow-[3px_3px_0px_#2C2A29] flex items-center justify-center gap-2 font-black text-sm">
              <AlertTriangle className="w-5 h-5 stroke-[3]" />
              <span>فرصة سرقة النقطة (15 ثانية)!</span>
            </div>

            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[6px_6px_0px_#2C2A29] flex flex-col items-center text-center gap-3">
              <div className="flex items-center gap-2 bg-[#C68B59] text-white px-5 py-2 rounded-2xl border-2 border-[#2C2A29]">
                <Clock className="w-5 h-5" />
                <span className="font-mono text-2xl font-black">
                  00:{stealTimeLeft.toString().padStart(2, '0')}
                </span>
              </div>

              <h4 className="text-base font-black text-[#2C2A29]">
                {isMyTeamActive
                  ? 'انتهى وقتكم! الفريق المنافس يحاول التخمين الآن'
                  : 'وقت السرقة لفريقكم! خمنوا المشهد الآن!'}
              </h4>
            </div>

            {/* Steal Buttons (for referee/stealing team) */}
            {!isMyTeamActive ? (
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleRefereeStealSuccess}
                  className="w-full bg-[#8A9A5B] hover:bg-[#78884d] active:scale-98 text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl py-4 flex items-center justify-center gap-2 font-black text-lg transition-all"
                >
                  <Check className="w-6 h-6 stroke-[3]" />
                  <span>سرقة صحيحة لفريقنا! (+1 pt)</span>
                </button>

                <button
                  onClick={handleRefereeStealFail}
                  className="w-full bg-[#E5E0D5] hover:bg-[#d8d2c5] active:scale-98 text-[#5C4033] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl py-3 flex items-center justify-center gap-2 font-bold text-xs transition-all"
                >
                  <X className="w-4 h-4" />
                  <span>لم يعرف أحد / إنهاء الجولة (0 pt)</span>
                </button>
              </div>
            ) : (
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-4 text-center text-xs font-bold text-[#5C4033]">
                في انتظار نتيجة محاولة السرقة...
              </div>
            )}
          </div>
        )}

        {/* ================= 6. ROUND RESULT ================= */}
        {phase === 'ROUND_RESULT' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto gap-4">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] w-full">
              <h3 className="text-xl font-black text-[#2C2A29] mb-2">
                {roundResultText || 'انتهت الجولة'}
              </h3>
              <p className="text-sm font-bold text-[#5C4033] mb-4">
                المشهد كان: <span className="font-black text-[#2C2A29] underline">{currentPrompt?.text}</span>
              </p>

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

        {/* ================= 7. PODIUM ================= */}
        {phase === 'PODIUM' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto gap-4">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] w-full">
              <h3 className="text-2xl font-black text-[#2C2A29] mb-2">نهاية المباراة!</h3>
              <p className="text-sm font-bold text-[#5C4033] mb-4">
                تابع منصة التتويج والنتائج على شاشة التلفزيون.
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
