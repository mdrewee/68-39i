import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layers, AlertCircle, Clock, Check, Trophy } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { MobileTopBar } from '../../../components/MobileTopBar';
import { ThreeLetterCard } from './components/ThreeLetterCard';
import { ThreeLetterBoardSlot } from './components/ThreeLetterBoardSlot';
import {
  ThreeLetterPhase,
  ThreeLetterCardItem,
  BoardSlotState,
  ThreeLetterPlayer,
  TurnEventNotification
} from './types';
import {
  generateInitialBoard,
  generateInitialHand,
  validateWordPlacement,
  getRandomCardColor
} from './utils/threeLetterDictionary';
import { getOrCreatePlayerId, getOrCreatePlayerName } from '../../../utils/playerSession';
import { sound } from '../../../lib/audio';

export const ThreeLetterWordMobileView: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (rawCode || '000000').toUpperCase();

  // Player identity
  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const playerName = useMemo(() => getOrCreatePlayerName(), []);

  // Game States
  const [phase, setPhase] = useState<ThreeLetterPhase>('LOBBY');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [board, setBoard] = useState<[BoardSlotState, BoardSlotState, BoardSlotState]>(() => generateInitialBoard());
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [turnNumber, setTurnNumber] = useState<number>(1);
  const [hand, setHand] = useState<ThreeLetterCardItem[]>(() => generateInitialHand(8));
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isEvaluatingMove, setIsEvaluatingMove] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [players, setPlayers] = useState<ThreeLetterPlayer[]>([]);
  const [lastNotification, setLastNotification] = useState<TurnEventNotification | null>(null);
  const [winner, setWinner] = useState<{ id: string; name: string } | null>(null);

  // Channel & state refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const handRef = useRef(hand);
  const isReadyRef = useRef(isReady);
  const boardRef = useRef(board);
  const isEvaluatingRef = useRef(isEvaluatingMove);

  useEffect(() => { handRef.current = hand; }, [hand]);
  useEffect(() => { isReadyRef.current = isReady; }, [isReady]);
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { isEvaluatingRef.current = isEvaluatingMove; }, [isEvaluatingMove]);

  const isMyTurn = activePlayerId === playerId && phase === 'GAMEPLAY' && !isEvaluatingMove;

  // 1. Setup Supabase Realtime Channel
  useEffect(() => {
    const normalizedCode = roomCode.trim().toUpperCase();
    if (!normalizedCode) return;

    const channel = supabase.channel(`three_letter:${normalizedCode}`, {
      config: {
        broadcast: { self: true },
        presence: { key: playerId }
      }
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const active: ThreeLetterPlayer[] = [];
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          presences.forEach((p) => {
            if (p.playerId && p.playerName) {
              active.push({
                id: p.playerId,
                name: p.playerName,
                cardsCount: p.cardsCount ?? 8,
                isReady: !!p.isReady
              });
            }
          });
        });

        // Deduplicate
        const unique = Array.from(new Map(active.map((p) => [p.id, p])).values());
        setPlayers(unique);
      })
      .on('broadcast', { event: 'THREE_LETTER_STATE_SYNC' }, ({ payload }) => {
        if (!payload) return;
        if (payload.phase) setPhase(payload.phase);
        if (payload.board) setBoard(payload.board);
        if (payload.activePlayerId !== undefined) {
          setActivePlayerId(payload.activePlayerId);
          setIsEvaluatingMove(false);
        }
        if (payload.turnNumber !== undefined) setTurnNumber(payload.turnNumber);
        if (payload.players) setPlayers(payload.players);
        if (payload.notification) setLastNotification(payload.notification);
        if (payload.phase === 'ROUND_WIN' && payload.players) {
          const w = payload.players.find((p: ThreeLetterPlayer) => p.cardsCount === 0);
          if (w) setWinner({ id: w.id, name: w.name });
        }
      })
      .on('broadcast', { event: 'GAME_STARTED' }, ({ payload }) => {
        setPhase('GAMEPLAY');
        if (payload?.board) setBoard(payload.board);
        if (payload?.activePlayerId) setActivePlayerId(payload.activePlayerId);
        if (payload?.turnNumber) setTurnNumber(payload.turnNumber);
        // Reset local hand to exactly 8 cards
        const freshHand = generateInitialHand(8);
        setHand(freshHand);
        setSelectedCardId(null);
        setErrorMessage(null);
        setIsEvaluatingMove(false);
        sound.playRoundStart();
      })
      .on('broadcast', { event: 'KICK_PLAYER' }, ({ payload }) => {
        if (payload?.playerId === playerId) {
          sessionStorage.clear();
          navigate('/');
        }
      })
      .on('broadcast', { event: 'GAME_TERMINATED' }, () => {
        navigate(`/room/${roomCode}/lobby`);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            playerId,
            playerName,
            cardsCount: handRef.current.length,
            isReady: isReadyRef.current,
            joinedAt: Date.now()
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, playerId, playerName, navigate]);

  // Sync presence when hand or isReady changes
  useEffect(() => {
    if (channelRef.current) {
      channelRef.current.track({
        playerId,
        playerName,
        cardsCount: hand.length,
        isReady,
        joinedAt: Date.now()
      });
    }
  }, [hand.length, isReady, playerId, playerName]);

  // Toggle Ready in Lobby
  const handleToggleReady = () => {
    sound.playClick();
    const nextState = !isReady;
    setIsReady(nextState);
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'PLAYER_READY_TOGGLE',
        payload: { playerId, isReady: nextState }
      });
    }
  };

  // Select Card from hand
  const handleSelectCard = (cardId: string) => {
    if (isEvaluatingMove) return;
    sound.playClick();
    setErrorMessage(null);
    setSelectedCardId((prev) => (prev === cardId ? null : cardId));
  };

  // Single Attempt Move Placement
  const handlePlaceCardOnSlot = (slotIndex: 0 | 1 | 2) => {
    if (!isMyTurn || isEvaluatingMove) {
      if (!isMyTurn) setErrorMessage('ليس دورك الآن!');
      sound.playIncorrect();
      return;
    }

    if (!selectedCardId) {
      setErrorMessage('اختر كرتاً من يدك أولاً ثم اضغط على المكان المطلوب!');
      sound.playIncorrect();
      return;
    }

    const cardToPlay = hand.find((c) => c.id === selectedCardId);
    if (!cardToPlay) return;

    // Lock input immediately (Strict Single Attempt Rule)
    setIsEvaluatingMove(true);

    const validation = validateWordPlacement(board, slotIndex, cardToPlay.letter);

    if (validation.isValid) {
      // Valid word move
      sound.playCorrect();
      setErrorMessage(null);

      // 1. Remove card from local hand
      const nextHand = hand.filter((c) => c.id !== selectedCardId);
      setHand(nextHand);
      setSelectedCardId(null);

      // 2. Broadcast attempt
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'PLAY_CARD_ATTEMPT',
          payload: {
            playerId,
            slotIndex,
            card: cardToPlay
          }
        });
      }
    } else {
      // Invalid word move -> draw 1 penalty card, single shot failed, turn ends!
      sound.playIncorrect();
      setErrorMessage(validation.errorMessage || 'الكلمة غير صحيحة! تم احتساب كرت عقوبة وانتهاء دورك.');

      // Add penalty card to local hand
      const penaltyCard = generateInitialHand(1)[0];
      const nextHand = [...hand, penaltyCard];
      setHand(nextHand);
      setSelectedCardId(null);

      // Broadcast invalid attempt
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'PLAY_CARD_ATTEMPT',
          payload: {
            playerId,
            slotIndex,
            card: cardToPlay
          }
        });
      }
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    if (isEvaluatingMove || !isMyTurn) return;
    setSelectedCardId(cardId);
    e.dataTransfer.setData('text/plain', cardId);
  };

  const handleDropOnSlot = (slotIndex: 0 | 1 | 2) => {
    handlePlaceCardOnSlot(slotIndex);
  };

  // Draw Penalty / Pass Turn Button
  const handlePassTurn = () => {
    if (!isMyTurn || isEvaluatingMove) return;

    sound.playClick();
    setErrorMessage(null);
    setSelectedCardId(null);
    setIsEvaluatingMove(true);

    // Draw 1 card
    const drawn = generateInitialHand(1)[0];
    const nextHand = [...hand, drawn];
    setHand(nextHand);

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'DRAW_PASS_TURN',
        payload: { playerId }
      });
    }
  };

  const selectedCard = useMemo(
    () => hand.find((c) => c.id === selectedCardId),
    [hand, selectedCardId]
  );

  // Divide hand cards into 2 flowing rows
  const midIndex = Math.ceil(hand.length / 2);
  const handRow1 = hand.slice(0, midIndex);
  const handRow2 = hand.slice(midIndex);

  return (
    <div className="min-h-screen bg-[#E5E0D5] flex flex-col font-sans select-none overflow-x-hidden relative" dir="rtl">
      {/* Background static dot texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40 z-0"
        style={{
          backgroundImage: 'radial-gradient(#2C2A29 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />

      {/* Top Bar (No points displayed) */}
      <div className="relative z-20">
        <MobileTopBar
          roomCode={roomCode}
          playerName={playerName}
          title="كلمة ثلاثية"
          onLeaveRoom={() => {
            sessionStorage.clear();
            navigate('/');
          }}
        />
      </div>

      <main className="flex-1 flex flex-col w-full mx-auto p-2 relative z-10 justify-between pb-4">
        {/* ================= 1. LOBBY PHASE ================= */}
        {phase === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 my-auto max-w-sm mx-auto w-full px-3">
            <div className="w-20 h-20 rounded-3xl bg-[#7D8D53] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] flex items-center justify-center text-4xl font-black text-white">
              ث
            </div>

            <div>
              <h1 className="text-2xl font-black text-[#2C2A29] tracking-tight">كلمة ثلاثية</h1>
              <p className="text-xs font-bold text-[#5C4033] mt-1 leading-relaxed">
                معك 8 كروت ملونة.. بدّل حرف واحد وكوّن كلمة ثلاثية معتمدة للتخلص من كروتك!
              </p>
            </div>

            <div className="w-full bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-4 shadow-[3px_3px_0px_#2C2A29]">
              <span className="text-xs font-bold text-[#5C4033] block mb-2">المتسابقون المتصلون ({players.length}):</span>
              <div className="flex flex-wrap gap-2 justify-center">
                {players.map((p) => (
                  <span
                    key={p.id}
                    className={`text-xs font-black px-3 py-1 rounded-xl border-2 border-[#2C2A29] ${
                      p.isReady
                        ? 'bg-[#8A9A5B] text-white shadow-[2px_2px_0px_#2C2A29]'
                        : 'bg-[#E5E0D5] text-[#2C2A29]'
                    }`}
                  >
                    {p.name} {p.isReady ? '✓' : ''}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={handleToggleReady}
              className={`w-full py-4 rounded-2xl font-black text-lg border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] transition-all cursor-pointer ${
                isReady
                  ? 'bg-[#8A9A5B] text-white hover:bg-[#78884e]'
                  : 'bg-[#C68B59] text-white hover:bg-[#b07849]'
              }`}
            >
              {isReady ? 'أنا جاهز ✓ (اضغط للإلغاء)' : 'جاهز للعب!'}
            </button>
          </div>
        )}

        {/* ================= 2. GAMEPLAY PHASE ================= */}
        {phase === 'GAMEPLAY' && (
          <div className="flex-1 flex flex-col justify-between gap-2.5 w-full">
            {/* Center Section: Active Turn Header & Timer Ticker */}
            <div
              className={`w-full p-2.5 rounded-2xl border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] text-center transition-all ${
                isMyTurn
                  ? 'bg-[#8A9A5B] text-white font-black'
                  : 'bg-[#F7F4EC] text-[#2C2A29] font-bold'
              }`}
            >
              {isMyTurn ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm md:text-base">🎯 دورك الآن! اسحب كرتك أو انقر لتغيير حرف بالساحة</span>
                </div>
              ) : (
                <div className="text-xs text-[#5C4033]">
                  بانتظار دور: <span className="font-black text-[#2C2A29]">{players.find((p) => p.id === activePlayerId)?.name || 'اللاعب الآخر'}</span>...
                </div>
              )}
            </div>

            {/* Error Message Toast */}
            {errorMessage && (
              <div className="w-full bg-[#C86D51] text-white text-xs font-black p-2 rounded-xl border-2 border-[#2C2A29] shadow-[2px_2px_0px_#2C2A29] flex items-center justify-center gap-2">
                <AlertCircle size={15} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Top Section: Board Target Slots */}
            <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-2.5 shadow-[4px_4px_0px_#2C2A29] w-full">
              <div className="flex justify-between items-center mb-1.5 px-2">
                <span className="text-xs font-black text-[#5C4033]">ساحة الكلمة الثلاثية:</span>
                <span className="text-[10px] font-black text-[#8A9A5B] bg-[#E5E0D5] px-2 py-0.5 rounded-lg border border-[#2C2A29]">
                  {selectedCard ? `الحرف المختار: ${selectedCard.letter}` : 'اختر كرتك لتنزيله'}
                </span>
              </div>

              {/* 3 Active Physical Slots */}
              <div className="flex justify-center items-center gap-3 sm:gap-6 my-1">
                {board.map((slot, idx) => {
                  const pos = idx as 0 | 1 | 2;
                  const label = pos === 0 ? 'الأول' : pos === 1 ? 'الأوسط' : 'الأخير';

                  return (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <ThreeLetterBoardSlot
                        slot={slot}
                        size="md"
                        isTargetable={isMyTurn && !!selectedCardId}
                        onSlotClick={() => handlePlaceCardOnSlot(pos)}
                        onDropCard={handleDropOnSlot}
                        slotLabel={label}
                      />
                    </div>
                  );
                })}
              </div>

              {selectedCard && (
                <div className="text-center text-[11px] font-black text-[#5C4033] mt-1 pt-1 border-t border-[#2C2A29]/15">
                  اضغط على أي موقع بالأعلى لاستبداله بـ <span className="text-[#8A9A5B] text-sm">({selectedCard.letter})</span>
                </div>
              )}
            </div>

            {/* Bottom Section: Edge-to-Edge 8-Card Hand (Full Screen Width) */}
            <div className="w-full bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-2.5 shadow-[4px_4px_0px_#2C2A29]">
              <div className="flex justify-between items-center mb-1.5 px-1">
                <span className="text-xs font-black text-[#2C2A29]">كروتك في اليد ({hand.length}):</span>
                <span className="text-[10px] font-bold text-[#5C4033]">لك محاولة واحدة فقط في الدور</span>
              </div>

              {/* Row 1 (Edge to Edge, cascading overlap) */}
              <div className="flex justify-center items-center -space-x-5 space-x-reverse py-1 w-full overflow-x-auto px-1">
                {handRow1.map((card) => (
                  <div key={card.id} className="shrink-0 transition-transform duration-150">
                    <ThreeLetterCard
                      card={card}
                      size="sm"
                      isSelected={selectedCardId === card.id}
                      isHoverable={isMyTurn}
                      onClick={() => handleSelectCard(card.id)}
                      onDragStart={(e) => handleDragStart(e, card.id)}
                    />
                  </div>
                ))}
              </div>

              {/* Row 2 (if cards exceed 4) */}
              {handRow2.length > 0 && (
                <div className="flex justify-center items-center -space-x-5 space-x-reverse py-1 mt-1 w-full overflow-x-auto px-1">
                  {handRow2.map((card) => (
                    <div key={card.id} className="shrink-0 transition-transform duration-150">
                      <ThreeLetterCard
                        card={card}
                        size="sm"
                        isSelected={selectedCardId === card.id}
                        isHoverable={isMyTurn}
                        onClick={() => handleSelectCard(card.id)}
                        onDragStart={(e) => handleDragStart(e, card.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Pass / Draw Action */}
            <div className="w-full flex gap-2 items-center">
              <button
                disabled={!isMyTurn}
                onClick={handlePassTurn}
                className={`w-full py-3 px-4 rounded-xl font-black text-xs border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isMyTurn
                    ? 'bg-[#C68B59] text-white hover:bg-[#b07849] active:translate-y-0.5'
                    : 'bg-[#E5E0D5] text-[#2C2A29]/40 border-[#2C2A29]/40 shadow-none cursor-not-allowed'
                }`}
              >
                <Layers size={15} />
                <span>سحب كرت وتخطي الدور (+1 كرت)</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= 3. ROUND WIN / PODIUM PHASE ================= */}
        {(phase === 'ROUND_WIN' || phase === 'PODIUM') && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 my-auto max-w-sm mx-auto w-full px-3">
            <div className="w-20 h-20 rounded-3xl bg-[#8A9A5B] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] flex items-center justify-center text-white">
              <Trophy size={40} />
            </div>

            <div>
              <span className="text-xs font-black text-[#5C4033] bg-[#F7F4EC] border border-[#2C2A29] px-3 py-1 rounded-xl">
                نهاية المباراة
              </span>
              <h2 className="text-2xl font-black text-[#2C2A29] mt-2">
                {winner?.id === playerId ? 'مبروك! أنت بطل الكلمة الثلاثية!' : `الفائز: ${winner?.name || 'لاعب'}`}
              </h2>
              <p className="text-sm font-bold text-[#8A9A5B] mt-1">
                {winner?.id === playerId ? 'تخلصت من جميع كروتك الثمانية بنجاح!' : 'تم تصفير الكروت بنجاح!'}
              </p>
            </div>

            <div className="w-full bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-2xl p-4 shadow-[3px_3px_0px_#2C2A29]">
              <span className="text-xs font-bold text-[#5C4033] block mb-2">الترتيب النهائي:</span>
              <div className="flex flex-col gap-2">
                {players
                  .slice()
                  .sort((a, b) => a.cardsCount - b.cardsCount)
                  .map((p, idx) => (
                    <div
                      key={p.id}
                      className={`flex justify-between items-center p-2 rounded-xl border-2 border-[#2C2A29] ${
                        p.cardsCount === 0
                          ? 'bg-[#8A9A5B] text-white shadow-[2px_2px_0px_#2C2A29]'
                          : 'bg-[#E5E0D5] text-[#2C2A29]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs">#{idx + 1}</span>
                        <span className="font-black text-sm">{p.name} {p.id === playerId ? '(أنت)' : ''}</span>
                      </div>
                      <span className="text-xs font-bold">
                        {p.cardsCount === 0 ? 'بطل اللعبة' : `${p.cardsCount} كروت`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <button
              onClick={() => navigate(`/room/${roomCode}/lobby`)}
              className="w-full bg-[#C68B59] text-white py-3.5 rounded-2xl font-black text-base border-2 border-[#2C2A29] shadow-[3px_3px_0px_#2C2A29] hover:bg-[#2C2A29] cursor-pointer"
            >
              العودة للوبي الرئيسي
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
