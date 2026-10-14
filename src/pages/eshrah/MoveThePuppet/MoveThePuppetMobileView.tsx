import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, AlertTriangle, ShieldCheck, Clock, Play, UserCheck, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { GameTopBar } from '../../../components/layout/GameTopBar';
import { CleanTeamSelection } from '../../../components/eshrah/CleanTeamSelection';
import {
  EshrahPlayer,
  EshrahTeamId,
  EshrahGamePhase
} from '../../../types/eshrah';
import { PuppetActionItem } from '../../../data/puppetActionsBank';
import { getOrCreatePlayerId, getOrCreatePlayerName } from '../../../utils/playerSession';
import { sound } from '../../../lib/audio';

export const MoveThePuppetMobileView: React.FC = () => {
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
  const [currentAction, setCurrentAction] = useState<PuppetActionItem | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [stealTimeLeft, setStealTimeLeft] = useState<number>(15);
  const [team1Score, setTeam1Score] = useState<number>(0);
  const [team2Score, setTeam2Score] = useState<number>(0);

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
        if (payload.action !== undefined) setCurrentAction(payload.action);
        if (payload.timeLeft !== undefined) setTimeLeft(payload.timeLeft);
        if (payload.stealTimeLeft !== undefined) setStealTimeLeft(payload.stealTimeLeft);
        if (payload.team1Score !== undefined) setTeam1Score(payload.team1Score);
        if (payload.team2Score !== undefined) setTeam2Score(payload.team2Score);
      })
      .on('broadcast', { event: 'ROOM_TERMINATED' }, () => {
        navigate('/');
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
  }, [roomCode, playerId, playerName, myTeamId, navigate]);

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

  // Directing Team clicks [جاهز - ابدأ الوقت]
  const handleStartTimer = () => {
    sound.playRoundStart();
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'EXPLAINER_READY_START',
        payload: {}
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

      {/* Standardized GameTopBar */}
      <GameTopBar
        roomCode={roomCode}
        isHost={false}
        gameTitle="حرّك الدمية"
        currentRound={phase !== 'TEAMS' ? currentRound : undefined}
        totalRounds={phase !== 'TEAMS' ? 5 : undefined}
        onExit={() => navigate('/')}
      />

      <main className="flex-1 flex flex-col p-4 relative z-10 max-w-lg mx-auto w-full">
        {/* ================= 1. TEAMS (LOBBY SELECTION ON MOBILE) ================= */}
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

        {/* ================= 2. PREP WORD (STANDBY) ================= */}
        {phase === 'PREP_WORD' && (
          <div className="flex-1 flex flex-col justify-between gap-4 my-auto w-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#2C2A29] bg-[#F7F4EC] border-2 border-[#2C2A29] px-3 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                جولة {currentRound} من 5
              </span>
              <span className={`text-xs font-black px-3 py-1.5 rounded-xl border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] text-white ${
                activeTeam === 'team_1' ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'
              }`}>
                {activeTeam === 'team_1' ? 'دور الفريق الأول' : 'دور الفريق الثاني'}
              </span>
            </div>

            {isMyTeamActive ? (
              /* DIRECTING TEAM PREP VIEW */
              <div className="flex-1 flex flex-col justify-between gap-4 my-auto">
                <div className="bg-[#8A9A5B]/15 border-2 border-[#8A9A5B] rounded-2xl p-3 text-center">
                  <span className="text-xs font-black text-[#8A9A5B]">
                    اقرأ المشهد واضغط [جاهز] لبدء الـ 60 ثانية.
                  </span>
                </div>

                {/* Secret Action Card */}
                <div className="bg-[#F7F4EC] border-2 sm:border-3 border-[#2C2A29] rounded-2xl p-6 shadow-[3px_3px_0px_#2C2A29] flex flex-col items-center text-center gap-2">
                  <span className="text-xs font-bold text-[#5C4033]">المشهد المطلوب:</span>
                  <div className="text-3xl md:text-4xl font-black text-[#2C2A29] tracking-wide my-3 leading-snug">
                    {currentAction?.action || '...'}
                  </div>
                </div>

                {/* Ready Button */}
                <button
                  type="button"
                  onClick={handleStartTimer}
                  className="w-full bg-[#8A9A5B] hover:opacity-95 text-white font-black text-xl py-4 rounded-xl border-2 sm:border-3 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play className="w-6 h-6 fill-white" />
                  <span>جاهز - ابدأ الوقت (60 ثانية)</span>
                </button>
              </div>
            ) : (
              /* OPPONENT REFEREE PREP VIEW */
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 my-auto">
                <div className="bg-[#F7F4EC] border-2 sm:border-3 border-[#2C2A29] rounded-2xl p-6 shadow-[3px_3px_0px_#2C2A29] w-full flex flex-col items-center gap-3">
                  <UserCheck className="w-12 h-12 text-[#C68B59]" />
                  <h3 className="text-xl font-black text-[#2C2A29]">
                    الفريق المنافس يستعد لتوجيه الدمية!
                  </h3>
                  <p className="text-xs font-bold text-[#5C4033] leading-relaxed">
                    راقبوا التنفيذ بصمت واستعدوا لإمكانية سرقة النقطة.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 3. PLAYING (60s ACTIVE) ================= */}
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
                <div className="bg-[#F7F4EC] border-2 sm:border-3 border-[#2C2A29] rounded-2xl p-6 shadow-[3px_3px_0px_#2C2A29] flex flex-col items-center text-center">
                  <span className="text-xs font-bold text-[#5C4033] mb-1">المشهد المطلوب:</span>
                  <div className="text-3xl md:text-4xl font-black text-[#2C2A29] tracking-wide my-4 leading-snug">
                    {currentAction?.action || '...'}
                  </div>
                </div>

                {/* Team Refereeing Controls (جابها / ما جابها) */}
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button
                    type="button"
                    onClick={handleRefereeCorrect}
                    className="bg-[#8A9A5B] hover:opacity-95 text-white font-black text-xl py-4 rounded-xl border-2 sm:border-3 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Check className="w-6 h-6 stroke-[3]" />
                    <span>جابها</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      if (channelRef.current) {
                        channelRef.current.send({
                          type: 'broadcast',
                          event: 'REFEREE_ACTION',
                          payload: { action: 'DID_NOT_GET' }
                        });
                      }
                    }}
                    className="bg-[#C68B59] hover:opacity-95 text-white font-black text-xl py-4 rounded-xl border-2 sm:border-3 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <X className="w-6 h-6 stroke-[3]" />
                    <span>ما جابها</span>
                  </button>
                </div>
              </div>
            ) : (
              /* OPPONENT WAITING VIEW */
              <div className="flex-1 flex flex-col justify-between gap-4 my-auto">
                <div className="bg-[#F7F4EC] border-2 sm:border-3 border-[#2C2A29] rounded-2xl p-6 shadow-[3px_3px_0px_#2C2A29] flex flex-col items-center text-center gap-3">
                  <ShieldCheck className="w-12 h-12 text-[#C68B59]" />
                  <h3 className="text-xl font-black text-[#2C2A29]">
                    الفريق المنافس يوجّه دميته الآن!
                  </h3>
                  <p className="text-xs font-bold text-[#5C4033]">
                    راقبوا التنفيذ بصمت.. إذا ضغطوا [ما جابها] أو انتهى الوقت، ستنطلق فرصة السرقة فوراً!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 4. STEAL WINDOW (15s) ================= */}
        {phase === 'STEAL_WINDOW' && (
          <div className="flex-1 flex flex-col justify-between gap-4 my-auto w-full">
            <div className="bg-[#C68B59] text-white border-2 border-[#2C2A29] rounded-2xl p-3 text-center shadow-[3px_3px_0px_#2C2A29] flex items-center justify-center gap-2 font-black text-sm">
              <AlertTriangle className="w-5 h-5 stroke-[3]" />
              <span>فرصة سرقة النقطة (15 ثانية)!</span>
            </div>

            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] flex flex-col items-center text-center gap-3">
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
                  className="w-full bg-[#8A9A5B] hover:bg-[#78884d] active:scale-98 text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl py-4 flex items-center justify-center gap-2 font-black text-lg transition-all cursor-pointer"
                >
                  <Check className="w-6 h-6 stroke-[3]" />
                  <span>سرقة صحيحة لفريقنا! (+1 pt والتالي)</span>
                </button>

                <button
                  onClick={handleRefereeStealFail}
                  className="w-full bg-[#E5E0D5] hover:bg-[#d8d2c5] active:scale-98 text-[#5C4033] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl py-3 flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer"
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

        {/* ================= 5. PODIUM ================= */}
        {phase === 'PODIUM' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto gap-4">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] w-full">
              <h3 className="text-2xl font-black text-[#2C2A29] mb-2">نهاية المباراة!</h3>
              <p className="text-sm font-bold text-[#5C4033] mb-4">
                تابع منصة التتويج والنتائج على شاشة التلفزيون.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#8A9A5B] text-white border-2 border-[#2C2A29] rounded-2xl p-3">
                  <div className="text-xs font-bold">الفريق الأول</div>
                  <div className="text-2xl font-black">{team1Score} pt</div>
                </div>
                <div className="bg-[#C68B59] text-white border-2 border-[#2C2A29] rounded-2xl p-3">
                  <div className="text-xs font-bold">الفريق الثاني</div>
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
