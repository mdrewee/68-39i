// src/pages/ai/who-is-ai/components/RouletteReveal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Suspect, RoundScoreResult } from '../types';
import { getAvatarById } from '../avatars';
import { formatPt } from '../services/scoringConfig';
import { Flame, Car, Moon, Crosshair, Feather, Compass, Crown, Fish, User, Bot, Trophy, ArrowRight, RotateCcw } from 'lucide-react';

interface RouletteRevealProps {
  suspects: Suspect[];
  scoreResult: RoundScoreResult;
  onNextRound: () => void;
  onReturnToLobby: () => void;
  isHost?: boolean;
}

const renderAvatarIcon = (iconName: string) => {
  const iconProps = { className: "w-6 h-6 text-[#2C2A29]" };
  switch (iconName) {
    case 'Flame': return <Flame {...iconProps} />;
    case 'Car': return <Car {...iconProps} />;
    case 'Moon': return <Moon {...iconProps} />;
    case 'Crosshair': return <Crosshair {...iconProps} />;
    case 'Feather': return <Feather {...iconProps} />;
    case 'Compass': return <Compass {...iconProps} />;
    case 'Crown': return <Crown {...iconProps} />;
    case 'Fish': return <Fish {...iconProps} />;
    default: return <User {...iconProps} />;
  }
};

export const RouletteReveal: React.FC<RouletteRevealProps> = ({
  suspects,
  scoreResult,
  onNextRound,
  onReturnToLobby,
  isHost = true
}) => {
  const [cyclingIndex, setCyclingIndex] = useState(0);
  const [isCycling, setIsCycling] = useState(true);
  const [revealedAiAvatarId, setRevealedAiAvatarId] = useState<string | null>(null);

  const aiSuspect = suspects.find((s) => s.isAi) || suspects.find((s) => s.avatarId === scoreResult.aiAvatarId);
  const aiAvatarId = aiSuspect?.avatarId || scoreResult.aiAvatarId;
  const aiAvatar = getAvatarById(aiAvatarId);

  // 3.5s Roulette Cycling effect
  useEffect(() => {
    if (suspects.length <= 1) {
      setIsCycling(false);
      setRevealedAiAvatarId(aiAvatarId);
      return;
    }

    let interval = 90;
    let elapsed = 0;
    const totalDuration = 3500;
    let timerId: any = null;

    const step = () => {
      elapsed += interval;
      setCyclingIndex((prev) => (prev + 1) % suspects.length);

      if (elapsed > totalDuration - 1000) {
        interval += 45; // Slow down near the end
      }

      if (elapsed >= totalDuration) {
        // Find index of AI suspect
        const targetIdx = suspects.findIndex((s) => s.avatarId === aiAvatarId);
        if (targetIdx !== -1) {
          setCyclingIndex(targetIdx);
        }
        setIsCycling(false);
        setRevealedAiAvatarId(aiAvatarId);
      } else {
        timerId = setTimeout(step, interval);
      }
    };

    timerId = setTimeout(step, interval);
    return () => clearTimeout(timerId);
  }, [suspects, aiAvatarId]);

  const masterBlufferSuspect = suspects.find((s) => s.avatarId === scoreResult.masterBlufferAvatarId);
  const masterBlufferAvatar = masterBlufferSuspect ? getAvatarById(masterBlufferSuspect.avatarId) : null;

  // Prepare leaderboard sorted by cumulative score
  const humanSuspects = suspects.filter((s) => !s.isAi);
  const sortedHumans = [...humanSuspects].sort((a, b) => {
    const scoreA = a.realPlayerId ? scoreResult.playerPoints[a.realPlayerId] || 0 : 0;
    const scoreB = b.realPlayerId ? scoreResult.playerPoints[b.realPlayerId] || 0 : 0;
    return scoreB - scoreA;
  });

  return (
    <div className="w-full h-full flex flex-col justify-between gap-5 p-4 md:p-6 overflow-y-auto">
      {/* Top Banner / Status */}
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-black text-[#2C2A29]">
          {isCycling ? 'جاري كشف الروبوت المندس...' : 'كشف هوية الروبوت الحقيقي!'}
        </h1>
        <p className="text-sm font-bold text-stone-600 mt-1">
          {isCycling
            ? 'الروليت يدور بين المشتبه بهم..'
            : scoreResult.aiSurvived
            ? 'نجح الروبوت في التخفي وخداع الجميع!'
            : 'تم فضح الروبوت وتفكيك تمويهه!'}
        </p>
      </div>

      {/* Center: Roulette Display */}
      <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[6px_6px_0px_#2C2A29] rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
        {isCycling ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div
              className="w-24 h-24 rounded-2xl border-2 border-[#2C2A29] flex items-center justify-center shadow-[4px_4px_0px_#2C2A29] transition-all"
              style={{ backgroundColor: getAvatarById(suspects[cyclingIndex]?.avatarId || '').bgTone }}
            >
              {renderAvatarIcon(getAvatarById(suspects[cyclingIndex]?.avatarId || '').iconName)}
            </div>
            <span className="text-2xl font-black text-[#2C2A29]">
              {getAvatarById(suspects[cyclingIndex]?.avatarId || '').name}
            </span>
            <span className="text-xs font-bold text-stone-500">جاري التحقق...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full">
            {/* AI Avatar Reveal Card */}
            <div className="bg-[#FEF08A] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-6 flex flex-col items-center gap-3 w-full max-w-md">
              <div className="flex items-center gap-2 bg-[#2C2A29] text-[#FEF08A] px-4 py-1.5 rounded-xl text-xs font-black">
                <Bot className="w-4 h-4" />
                <span>الروبوت المندس!</span>
              </div>

              <div
                className="w-20 h-20 rounded-2xl border-2 border-[#2C2A29] flex items-center justify-center shadow-[3px_3px_0px_#2C2A29]"
                style={{ backgroundColor: aiAvatar.bgTone }}
              >
                {renderAvatarIcon(aiAvatar.iconName)}
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-black text-[#2C2A29]">{aiAvatar.name}</h2>
                <p className="text-xs font-bold text-stone-600 mt-0.5">
                  حصل على {scoreResult.aiVotesCount} أصوات
                </p>
              </div>

              <div className="w-full bg-white border border-[#2C2A29] rounded-xl p-3 text-xs font-bold text-[#2C2A29] text-center">
                {scoreResult.aiSurvived ? (
                  <span className="text-[#8A9A5B] font-black">
                    الروبوت نجا من الكشف (+{formatPt(scoreResult.aiEarnedPoints)})
                  </span>
                ) : (
                  <span className="text-stone-700">
                    كشفه اللاعبون: {scoreResult.correctVoterNames.join('، ') || 'أغلبية الأصوات'}
                  </span>
                )}
              </div>
            </div>

            {/* Master Bluffer Banner (if human fooled others) */}
            {masterBlufferSuspect && (scoreResult.masterBlufferVotesCount || 0) > 0 && (
              <div className="bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-xl p-3 w-full max-w-md flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-10 h-10 rounded-lg border border-[#2C2A29] flex items-center justify-center"
                    style={{ backgroundColor: masterBlufferAvatar?.bgTone }}
                  >
                    {renderAvatarIcon(masterBlufferAvatar?.iconName || '')}
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-stone-600 block">أفضل ممثل تمويهي:</span>
                    <span className="text-sm font-black text-[#2C2A29]">
                      {masterBlufferSuspect.realPlayerName} ({masterBlufferAvatar?.name})
                    </span>
                  </div>
                </div>
                <span className="bg-[#8A9A5B] text-white border border-[#2C2A29] text-xs font-black px-2.5 py-1 rounded-lg">
                  +{formatPt((scoreResult.masterBlufferVotesCount || 0) * 1)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Section: Unmasked Suspects & Standings */}
      {!isCycling && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Unmasked Players List */}
          <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4">
            <h3 className="text-sm font-black text-[#2C2A29] mb-3 text-right">
              الأقنعة الحقيقية لجميع اللاعبين:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {suspects.map((s) => {
                const av = getAvatarById(s.avatarId);
                const voters = scoreResult.votesSummary[s.avatarId] || [];
                return (
                  <div
                    key={s.avatarId}
                    className={`p-2.5 rounded-xl border border-[#2C2A29] flex items-center justify-between text-right ${
                      s.isAi ? 'bg-[#FEF08A]' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg border border-[#2C2A29] flex items-center justify-center"
                        style={{ backgroundColor: av.bgTone }}
                      >
                        {renderAvatarIcon(av.iconName)}
                      </div>
                      <div>
                        <span className="text-xs font-black text-[#2C2A29] block">{av.name}</span>
                        <span className="text-[11px] font-bold text-stone-600">
                          {s.isAi ? 'الروبوت' : s.realPlayerName || 'بشري'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-stone-500">
                      {voters.length} أصوات
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Standings Table */}
          <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-stone-600">النقاط تراكمية</span>
                <h3 className="text-sm font-black text-[#2C2A29] flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-[#C68B59]" />
                  جدول الترتيب
                </h3>
              </div>

              <div className="flex flex-col gap-1.5">
                {sortedHumans.map((s, idx) => {
                  const pid = s.realPlayerId || '';
                  const total = scoreResult.playerPoints[pid] || 0;
                  const roundGain = scoreResult.roundPointsEarned[pid] || 0;

                  return (
                    <div
                      key={pid}
                      className="bg-white border border-[#2C2A29] rounded-xl px-3 py-2 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-center text-xs font-black text-stone-400">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-[#2C2A29]">
                          {s.realPlayerName || s.avatarName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {roundGain > 0 && (
                          <span className="text-[11px] font-bold text-[#8A9A5B]">
                            +{formatPt(roundGain)}
                          </span>
                        )}
                        <span className="text-xs font-black text-[#2C2A29] bg-[#E5E0D5] px-2 py-0.5 rounded border border-[#2C2A29]">
                          {formatPt(total)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* AI Row in standings */}
                <div className="bg-[#FEF08A]/60 border border-[#2C2A29] rounded-xl px-3 py-2 flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#2C2A29]" />
                    <span className="text-xs font-bold text-[#2C2A29]">الروبوت (AI)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {scoreResult.aiEarnedPoints > 0 && (
                      <span className="text-[11px] font-bold text-[#8A9A5B]">
                        +{formatPt(scoreResult.aiEarnedPoints)}
                      </span>
                    )}
                    <span className="text-xs font-black text-[#2C2A29] bg-[#E5E0D5] px-2 py-0.5 rounded border border-[#2C2A29]">
                      {formatPt(scoreResult.aiPoints)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* TV Host Controls */}
            {isHost && (
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[#2C2A29]/20">
                <button
                  onClick={onReturnToLobby}
                  className="py-2.5 px-4 rounded-xl border-2 border-[#2C2A29] bg-[#C68B59] text-white font-bold text-xs shadow-[2px_2px_0px_#2C2A29] hover:bg-[#b07a4c] flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  إنهاء للّوبي
                </button>

                <button
                  onClick={onNextRound}
                  className="flex-1 py-2.5 px-4 rounded-xl border-2 border-[#2C2A29] bg-[#8A9A5B] text-white font-black text-xs shadow-[3px_3px_0px_#2C2A29] hover:bg-[#7b8a51] flex items-center justify-center gap-1.5"
                >
                  <span>الجولة التالية</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
