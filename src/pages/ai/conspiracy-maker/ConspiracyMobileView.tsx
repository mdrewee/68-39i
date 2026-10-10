import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, CheckCircle2, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ConspiracyPhase, EventPair, ConspiracyEvaluation } from './types';
import { MobileTopBar } from '../../../components/MobileTopBar';
import { getOrCreatePlayerId, getOrCreatePlayerName, clearPlayerSession } from '../../../utils/playerSession';

export const ConspiracyMobileView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // Unique session player info per browser tab
  const [playerId] = useState<string>(() => getOrCreatePlayerId());
  const [playerName] = useState<string>(() => getOrCreatePlayerName('عميل سري'));

  // State
  const [phase, setPhase] = useState<ConspiracyPhase>('LOBBY');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [currentEventPair, setCurrentEventPair] = useState<EventPair | null>(null);
  const [theoryText, setTheoryText] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [evaluation, setEvaluation] = useState<ConspiracyEvaluation | null>(null);
  const [kicked, setKicked] = useState<boolean>(false);

  // Realtime Channel Ref Singleton
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Leave room handler
  const handleLeaveRoom = async () => {
    if (channelRef.current) {
      try {
        await channelRef.current.untrack();
        await channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
      } catch (e) {
        console.warn('Untrack error:', e);
      }
    }
    clearPlayerSession(roomCode);
    navigate('/');
  };

  // Connect to Supabase Realtime Channel with explicit presence key
  useEffect(() => {
    const normalizedCode = roomCode.trim().toUpperCase();
    if (!normalizedCode) return;

    const channel = supabase.channel(`conspiracy:${normalizedCode}`, {
      config: { broadcast: { self: true }, presence: { key: playerId } }
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'CONSPIRACY_STATE_SYNC' }, ({ payload }) => {
        if (payload?.phase) {
          setPhase(payload.phase);
          if (payload.phase === 'EVENTS_REVEAL' || payload.phase === 'THEORY_INPUT') {
            setIsSubmitted(false);
            setTheoryText('');
          }
        }
        if (payload?.eventPair) {
          setCurrentEventPair(payload.eventPair);
        }
      })
      .on('broadcast', { event: 'CONSPIRACY_EVALUATION_READY' }, ({ payload }) => {
        if (payload) {
          setEvaluation(payload);
        }
      })
      .on('broadcast', { event: 'KICK_PLAYER' }, ({ payload }) => {
        if (payload?.playerId === playerId) {
          setKicked(true);
          supabase.removeChannel(channel);
          clearPlayerSession(roomCode);
          navigate('/');
        }
      })
      .on('broadcast', { event: 'GAME_TERMINATED' }, () => {
        supabase.removeChannel(channel);
        clearPlayerSession(roomCode);
        navigate('/');
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            playerId,
            playerName,
            isReady,
            joinedAt: Date.now()
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, playerId, playerName, navigate]);

  // Update Presence on Ready Toggle
  const handleToggleReady = async () => {
    const nextReady = !isReady;
    setIsReady(nextReady);

    if (channelRef.current) {
      await channelRef.current.track({
        playerId,
        playerName,
        isReady: nextReady,
        joinedAt: Date.now()
      });
      channelRef.current.send({
        type: 'broadcast',
        event: 'PLAYER_READY_TOGGLE',
        payload: { playerId, isReady: nextReady }
      });
    }
  };

  // Submit Theory Handler
  const handleSubmitTheory = () => {
    if (!theoryText.trim() || isSubmitted) return;

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'SUBMIT_THEORY',
        payload: {
          playerId,
          playerName,
          theoryText: theoryText.trim()
        }
      });
    }
    setIsSubmitted(true);
  };

  if (kicked) {
    return (
      <div className="w-full min-h-screen bg-[#E5E0D5] flex items-center justify-center p-6 text-center">
        <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-6 shadow-[4px_4px_0px_#2C2A29] space-y-4">
          <AlertCircle className="w-12 h-12 text-[#C68B59] mx-auto" />
          <h2 className="text-xl font-black text-[#2C2A29]">تم استبعادك من الغرفة</h2>
          <button
            onClick={handleLeaveRoom}
            className="bg-[#C68B59] text-white px-6 py-2 rounded-xl font-black text-sm border-2 border-[#2C2A29]"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[100dvh] bg-[#E5E0D5] text-[#2C2A29] flex flex-col font-sans select-none relative"
         style={{ backgroundImage: 'radial-gradient(rgba(44, 42, 41, 0.04) 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
      
      {/* Persistent Mobile TopBar */}
      <MobileTopBar roomCode={roomCode} playerName={playerName} onLeaveRoom={handleLeaveRoom} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-4">
        {/* MOBILE PHASE 1: LOBBY */}
        {phase === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-2xl p-6 w-full max-w-sm space-y-4">
              <h2 className="text-2xl font-black text-[#2C2A29]">استعداد العميل</h2>
              <p className="text-xs font-bold text-[#2C2A29]/70 leading-relaxed">
                اضغط على زر الاستعداد لمباشرة التحدي فور اكتمال النصاب!
              </p>

              <button
                onClick={handleToggleReady}
                className={`w-full py-4 rounded-xl font-black text-base border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] transition-transform active:translate-x-[1px] active:translate-y-[1px] ${
                  isReady
                    ? 'bg-[#8A9A5B] text-white'
                    : 'bg-[#C68B59] text-white'
                }`}
              >
                {isReady ? '✓ أنا جاهز للتحدي' : 'اضغط للجاهزية'}
              </button>
            </div>
          </div>
        )}

        {/* MOBILE PHASE 2 & 3: THEORY INPUT */}
        {(phase === 'EVENTS_REVEAL' || phase === 'THEORY_INPUT') && (
          <div className="flex-1 flex flex-col gap-4 max-w-md mx-auto w-full">
            
            {/* Summary Chips for Event A and B */}
            {currentEventPair && (
              <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-xl p-3 space-y-2 text-right">
                <div className="text-xs font-black text-[#C68B59]">[الحدثين المطلوب الربط بينهما]</div>
                <div className="bg-[#E5E0D5] p-2 rounded-lg text-xs font-extrabold text-[#2C2A29] border border-[#2C2A29]/20">
                  1. {currentEventPair.eventA}
                </div>
                <div className="bg-[#E5E0D5] p-2 rounded-lg text-xs font-extrabold text-[#2C2A29] border border-[#2C2A29]/20">
                  2. {currentEventPair.eventB}
                </div>
              </div>
            )}

            {/* Input or Locked State */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-2xl p-4 flex-1 flex flex-col justify-between gap-3">
              
              {isSubmitted ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-[#8A9A5B]" />
                  <h3 className="font-black text-lg text-[#2C2A29]">تم اعتماد ملفك السري!</h3>
                  <p className="text-xs font-bold text-[#2C2A29]/70">
                    بانتظار بقية العملاء لتحليل التقرير على الشاشـة...
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-black text-[#2C2A29]">
                      <span>أكتب خيوط المؤامرة</span>
                      <span className={theoryText.length > 170 ? 'text-[#C68B59]' : 'text-[#2C2A29]/60'}>
                        {theoryText.length} / 180
                      </span>
                    </div>
                    <textarea
                      value={theoryText}
                      onChange={(e) => setTheoryText(e.target.value.slice(0, 180))}
                      placeholder="اشرح كيف ترتبط الأحداث ببعض بنظرية مضحكة ومجنونة..."
                      rows={5}
                      maxLength={180}
                      className="w-full bg-[#E5E0D5]/50 border-2 border-[#2C2A29] rounded-xl p-3 text-sm font-bold text-[#2C2A29] placeholder-[#2C2A29]/40 focus:outline-none focus:bg-[#E5E0D5] resize-none"
                    />
                  </div>

                  <button
                    onClick={handleSubmitTheory}
                    disabled={!theoryText.trim()}
                    className="w-full bg-[#8A9A5B] disabled:opacity-50 hover:bg-[#78874e] text-white py-3 rounded-xl font-black text-sm border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] flex items-center justify-center gap-2 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <Send className="w-4 h-4 fill-white rotate-180" />
                    <span>اعتماد وإرسال الملف السري</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* MOBILE PHASE 4, 5, 6: SHOWCASE & VERDICT */}
        {(phase === 'DOSSIERS_SHOWCASE' || phase === 'VERDICT_REVEAL' || phase === 'PODIUM') && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[5px_5px_0px_#2C2A29] rounded-2xl p-6 w-full max-w-sm space-y-3">
              <Lock className="w-10 h-10 text-[#C68B59] mx-auto" />
              <h3 className="text-xl font-black text-[#2C2A29]">تابع الشاشة الرئيسية!</h3>
              <p className="text-xs font-bold text-[#2C2A29]/70 leading-relaxed">
                جاري عرض التقييم الاستخباراتي وإعلان "المؤامرة المعتمدة" للجميع.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
