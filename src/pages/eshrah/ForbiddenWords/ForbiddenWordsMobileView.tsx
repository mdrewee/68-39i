import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, X, AlertOctagon, Clock, Users, Play, ShieldAlert, Award } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { GameTopBar } from '../../../components/layout/GameTopBar';
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

  // Explainer Ready Click (Starts 60s Timer)
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

  // Explainer-Led Actions: [جبتها ✓] or [مخالفة كلمة محظورة ✗]
  const handleTabooAction = (action: 'CORRECT' | 'VIOLATION') => {
    if (action === 'CORRECT') {
      sound.playCorrect();
    } else {
      sound.playIncorrect();
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

  return (
    <div className="min-h-screen bg-[#E5E0D5] flex flex-col font-sans select-none overflow-x-hidden relative" dir="rtl">
      {/* Background static dot pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40 z-0"
        style={{
          backgroundImage: 'radial-gradient(#2C2A29 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* TopBar */}
      <GameTopBar
        roomCode={roomCode}
        isHost={false}
        gameTitle="كلمات محظورة"
        currentRound={phase !== 'TEAMS' ? currentRound : undefined}
        totalRounds={phase !== 'TEAMS' ? 3 : undefined}
        onExit={() => navigate('/')}
      />

      <main className="flex-1 flex flex-col p-4 relative z-10 max-w-lg mx-auto w-full">
        {/* ================= 1. TEAMS (LOBBY SELECTION ON MOBILE) ================= */}
        {phase === 'TEAMS' && (
          <div className="flex-1 flex flex-col items-center justify-center my-auto w-full">
            <div className="text-center mb-6">
              <span className="text-xs font-black text-[#5C4033] bg-[#F7F4EC] border-2 border-[#2C2A29] px-4 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29] inline-block mb-2">
                اشرح: كلمات محظورة
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

        {/* ================= 2. PREP WORD (EXPLAINER STRATEGY & READY BUTTON) ================= */}
        {phase === 'PREP_WORD' && (
          <div className="flex-1 flex flex-col justify-between gap-4 my-auto w-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#2C2A29] bg-[#F7F4EC] border-2 border-[#2C2A29] px-3 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                جولة {currentRound} من 3
              </span>
              <span className={`text-xs font-black px-3 py-1.5 rounded-xl border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] text-white ${
                activeTeam === 'team_1' ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'
              }`}>
                {activeTeam === 'team_1' ? 'دور الفريق الأول' : 'دور الفريق الثاني'}
              </span>
            </div>

            {isMyTeamExplaining ? (
              /* EXPLAINER PREP VIEW */
              <div className="flex-1 flex flex-col justify-between gap-4 my-auto">
                <div className="bg-[#8A9A5B]/15 border-2 border-[#8A9A5B] rounded-2xl p-3 text-center">
                  <span className="text-xs font-black text-[#8A9A5B]">
                    👁️ راجع الكلمة والمحظورات.. الوقت يبدأ فقط عند ضغطك [جاهز]!
                  </span>
                </div>

                {/* Secret Card */}
                <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] flex flex-col items-center gap-4">
                  <span className="text-xs font-bold text-[#5C4033]">الكلمة المطلوب شرحها:</span>
                  <div className="text-3xl md:text-4xl font-black text-[#2C2A29] text-center border-b-2 border-[#2C2A29]/15 pb-4 w-full">
                    {currentPrompt?.text}
                  </div>

                  {/* Forbidden Words in Red Box */}
                  <div className="w-full bg-[#B85C5C]/10 border-2 border-[#B85C5C] rounded-2xl p-4 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-[#B85C5C] mb-1">
                      <AlertOctagon size={16} />
                      <span>الكلمات المحظورة (ممنوع نطقها نهائياً!):</span>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center w-full">
                      {(currentPrompt?.forbiddenWords || []).map((w, idx) => (
                        <span
                          key={idx}
                          className="text-xs font-black bg-[#F7F4EC] text-[#B85C5C] border-2 border-[#B85C5C] px-3 py-1 rounded-xl shadow-xs"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Big Ready Button */}
                <button
                  onClick={handleStartTimer}
                  className="w-full bg-[#8A9A5B] hover:bg-[#78884d] active:scale-98 text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl py-4 flex items-center justify-center gap-2 font-black text-lg transition-all cursor-pointer"
                >
                  <Play className="w-6 h-6 fill-white" />
                  <span>جاهز - ابدأ الوقت (60 ثانية)</span>
                </button>
              </div>
            ) : (
              /* AUDITOR / OPPONENT PREP VIEW */
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 my-auto">
                <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[4px_4px_0px_#2C2A29] w-full flex flex-col items-center gap-3">
                  <Clock className="w-12 h-12 text-[#C68B59]" />
                  <h3 className="text-xl font-black text-[#2C2A29]">
                    الفريق المنافس يستعد للشرح!
                  </h3>
                  <p className="text-xs font-bold text-[#5C4033] leading-relaxed">
                    الشارح يراجع كلمته ومحظوراته في جواله الآن. استعدوا للتركيز والاستماع الشديد لضبط أي كلمة محظورة!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 3. PLAYING (60s SPEED RUN) ================= */}
        {phase === 'PLAYING' && (
          <div className="flex-1 flex flex-col justify-between gap-4 my-auto w-full">
            {/* Header Status */}
            <div className="flex justify-between items-center bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-3 shadow-[2px_2px_0px_#2C2A29]">
              <div className="flex items-center gap-2 font-black text-xs text-[#2C2A29]">
                <Clock className="w-4 h-4 text-[#C68B59]" />
                <span className="font-mono text-base">00:{timeLeft.toString().padStart(2, '0')}</span>
              </div>
              <div className="text-xs font-black text-[#8A9A5B] bg-[#8A9A5B]/15 px-3 py-1 rounded-xl border border-[#8A9A5B]">
                {currentRunCorrectCount} صحيحة ✓
              </div>
            </div>

            {isMyTeamExplaining ? (
              /* EXPLAINER CONTROLS */
              <div className="flex-1 flex flex-col justify-between gap-4 my-auto">
                {/* Secret Card */}
                <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] flex flex-col items-center gap-4">
                  <span className="text-xs font-bold text-[#5C4033]">الكلمة المطلوب شرحها:</span>
                  <div className="text-3xl md:text-4xl font-black text-[#2C2A29] text-center border-b-2 border-[#2C2A29]/15 pb-4 w-full">
                    {currentPrompt?.text}
                  </div>

                  {/* 4 Forbidden Words inside Red Box */}
                  <div className="w-full bg-[#B85C5C]/10 border-2 border-[#B85C5C] rounded-2xl p-4 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-[#B85C5C] mb-1">
                      <AlertOctagon size={16} />
                      <span>الكلمات المحظورة (ممنوع نطقها):</span>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center w-full">
                      {(currentPrompt?.forbiddenWords || []).map((w, idx) => (
                        <span
                          key={idx}
                          className="text-xs font-black bg-[#F7F4EC] text-[#B85C5C] border-2 border-[#B85C5C] px-3 py-1 rounded-xl shadow-xs"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Two Large Action Buttons */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => handleTabooAction('CORRECT')}
                    className="w-full bg-[#8A9A5B] hover:bg-[#78884d] active:scale-98 text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl py-4 flex items-center justify-center gap-2 font-black text-lg transition-all cursor-pointer"
                  >
                    <Check className="w-6 h-6 stroke-[3]" />
                    <span>جبتها ✓ (+1 pt والتالي)</span>
                  </button>

                  <button
                    onClick={() => handleTabooAction('VIOLATION')}
                    className="w-full bg-[#B85C5C] hover:bg-[#a04e4e] active:scale-98 text-white border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] rounded-2xl py-3.5 flex items-center justify-center gap-2 font-black text-sm transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5 stroke-[3]" />
                    <span>مخالفة كلمة محظورة ✗ (تخطي 0 pt)</span>
                  </button>
                </div>
              </div>
            ) : (
              /* AUDITOR (OPPONENT TEAM) VIEW: ZERO BUTTONS */
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 my-auto">
                <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[4px_4px_0px_#2C2A29] w-full flex flex-col items-center gap-3">
                  <ShieldAlert className="w-12 h-12 text-[#C68B59]" />
                  <h3 className="text-xl font-black text-[#2C2A29]">
                    الفريق المنافس يشرح الآن!
                  </h3>
                  <p className="text-xs font-bold text-[#5C4033] leading-relaxed">
                    استمعوا وركزوا لمنع ونقد أي كلمة محظورة ينطقها الشارح. الشارح يدير تسجيل النقاط والمخالفات بنفسه!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 4. ROUND RESULT ================= */}
        {phase === 'ROUND_RESULT' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 my-auto">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[4px_4px_0px_#2C2A29] w-full">
              <span className="text-xs font-black text-[#5C4033] block mb-2">انتهت الجولة:</span>
              <p className="text-2xl font-black text-[#2C2A29] mb-4">
                أحرز الفريق: <span className="text-[#8A9A5B]">+{currentRunCorrectCount} pt ✓</span>
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#8A9A5B]/15 border-2 border-[#2C2A29] rounded-2xl p-3">
                  <div className="text-xs font-bold text-[#2C2A29]">الفريق الأول</div>
                  <div className="text-2xl font-black text-[#8A9A5B]">{team1Score} pt</div>
                </div>
                <div className="bg-[#C68B59]/15 border-2 border-[#2C2A29] rounded-2xl p-3">
                  <div className="text-xs font-bold text-[#2C2A29]">الفريق الثاني</div>
                  <div className="text-2xl font-black text-[#C68B59]">{team2Score} pt</div>
                </div>
              </div>
            </div>

            <div className="text-xs font-bold text-[#5C4033]">
              بانتظار الانتقال للدور التالي من شاشة العرض...
            </div>
          </div>
        )}

        {/* ================= 5. PODIUM ================= */}
        {phase === 'PODIUM' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 my-auto">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] w-full">
              <Award className="w-14 h-14 text-[#C68B59] mx-auto mb-3" />
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
