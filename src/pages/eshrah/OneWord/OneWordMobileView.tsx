import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, ArrowRightLeft, Users, Trophy, Play, Clock, Sparkles } from 'lucide-react';
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

export const OneWordMobileView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const playerName = useMemo(() => getOrCreatePlayerName(), []);

  // State
  const [phase, setPhase] = useState<EshrahGamePhase>('TEAMS');
  const [players, setPlayers] = useState<EshrahPlayer[]>([]);
  const [myTeamId, setMyTeamId] = useState<EshrahTeamId | null>(null);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [currentPrompt, setCurrentPrompt] = useState<EshrahPromptItem | null>(null);
  const [activeTurnClueTeam, setActiveTurnClueTeam] = useState<EshrahTeamId>('team_1');
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(10);
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
        if (payload.turnTimeLeft !== undefined) setTurnTimeLeft(payload.turnTimeLeft);
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

  // Ready click from mobile (starts the round)
  const handleStartRound = () => {
    sound.playRoundStart();
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'EXPLAINER_READY_START',
        payload: {}
      });
    }
  };

  // Single [جابوها ✓] Action
  const handleOneWordGuessed = () => {
    sound.playVictory();
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'ONE_WORD_GUESSED',
        payload: {}
      });
    }
  };

  // Pass clue turn to other team
  const handlePassClueTurn = () => {
    sound.playClick();
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'PASS_CLUE_TURN',
        payload: {}
      });
    }
  };

  const isMyTeamClue = myTeamId === activeTurnClueTeam;

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
        gameTitle="كلمة واحدة"
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

        {/* ================= 2. PREP WORD (STANDBY) ================= */}
        {phase === 'PREP_WORD' && (
          <div className="flex-1 flex flex-col justify-between gap-4 my-auto w-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#2C2A29] bg-[#F7F4EC] border-2 border-[#2C2A29] px-3 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                جولة {currentRound} من 5
              </span>
              <span className="text-xs font-black text-[#8A9A5B] bg-[#8A9A5B]/15 border border-[#8A9A5B] px-3 py-1.5 rounded-xl">
                مواجهة مشتركة
              </span>
            </div>

            {/* Secret Word Card */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] flex flex-col items-center text-center gap-3">
              <span className="text-xs font-bold text-[#5C4033]">الكلمة السرية للمواجهة:</span>
              <div className="text-4xl md:text-5xl font-black text-[#2C2A29] tracking-wide my-3">
                {currentPrompt?.text || '...'}
              </div>
              <div className="bg-[#E5E0D5]/70 border border-[#2C2A29]/20 rounded-2xl p-3 text-xs font-bold text-[#5C4033] w-full text-right space-y-1">
                <p>• ممثل من كل فريق يرى نفس الكلمة الآن.</p>
                <p>• مسموح بكلمة واحدة فقط كتلميح لكل دور (10 ثوانٍ للدور).</p>
                <p>• أول فريق في الصالة يخمن الكلمة اضغط [جابوها] فوراً!</p>
              </div>
            </div>

            {/* Ready Button */}
            <button
              onClick={handleStartRound}
              className="w-full bg-[#8A9A5B] hover:bg-[#78884d] active:scale-98 text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl py-4 flex items-center justify-center gap-2 font-black text-lg transition-all cursor-pointer"
            >
              <Play className="w-6 h-6 fill-white" />
              <span>جاهز - ابدأ الجولة (10 ثوانٍ للدور)</span>
            </button>
          </div>
        )}

        {/* ================= 3. PLAYING (10s ACTIVE CLUE TURN) ================= */}
        {phase === 'PLAYING' && (
          <div className="flex-1 flex flex-col justify-between gap-4 my-auto w-full">
            {/* Top Bar Status */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#2C2A29] bg-[#F7F4EC] border-2 border-[#2C2A29] px-3 py-1.5 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                جولة {currentRound} / 5
              </span>

              {/* 10s Timer */}
              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border-2 border-[#2C2A29] font-black shadow-[2px_2px_0px_#2C2A29] ${
                turnTimeLeft <= 3 ? 'bg-[#C86D51] text-white animate-pulse' : 'bg-[#F7F4EC] text-[#2C2A29]'
              }`}>
                <Clock className="w-4 h-4" />
                <span className="font-mono text-base">00:{turnTimeLeft.toString().padStart(2, '0')}</span>
              </div>
            </div>

            {/* Turn Clue Banner */}
            <div className={`p-3 rounded-2xl border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] text-center font-black text-sm text-white ${
              activeTurnClueTeam === 'team_1' ? 'bg-[#8A9A5B]' : 'bg-[#C68B59]'
            }`}>
              دور التلميح الآن: {activeTurnClueTeam === 'team_1' ? 'الفريق الأول' : 'الفريق الثاني'}
              {isMyTeamClue ? ' (فريقك يلمّح ويخمّن!)' : ' (استمع للمنافس!)'}
            </div>

            {/* Secret Word Card */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] flex flex-col items-center text-center">
              <span className="text-xs font-bold text-[#5C4033] mb-1">الكلمة السرية المشتركة:</span>
              <div className="text-4xl md:text-5xl font-black text-[#2C2A29] tracking-wide my-3">
                {currentPrompt?.text || '...'}
              </div>
              <p className="text-xs font-bold text-[#5C4033] mt-2 bg-[#E5E0D5]/60 border border-[#2C2A29]/20 px-3 py-1.5 rounded-xl">
                ⚠️ كلمة واحدة فقط كتلميح! إذا انتهت الـ 10 ثوانٍ ينتقل الدور تلقائياً.
              </p>
            </div>

            {/* Single [جابوها ✓] Scoring Button + Pass Turn */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleOneWordGuessed}
                className="w-full bg-[#8A9A5B] hover:bg-[#78884d] active:scale-98 text-white border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl py-4 flex items-center justify-center gap-2 font-black text-xl transition-all cursor-pointer"
              >
                <Check className="w-7 h-7 stroke-[3]" />
                <span>جابوها صح! (+1 pt والتالي)</span>
              </button>

              <button
                onClick={handlePassClueTurn}
                className="w-full bg-[#F7F4EC] hover:bg-white active:scale-98 text-[#2C2A29] border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] rounded-xl py-2.5 px-3 flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>تمرير دور التلميح للفريق الآخر</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= 4. PODIUM ================= */}
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
