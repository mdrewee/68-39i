import React from 'react';
import { Users, Play, ShieldAlert, Sparkles, Smartphone } from 'lucide-react';
import { QRCodeView } from '../common/QRCodeView';
import { EshrahPlayer } from '../../types/eshrah';
import { sound } from '../../lib/audio';

interface EshrahTVLobbyProps {
  roomCode: string;
  gameTitle: string;
  gameRuleSnippet: string;
  players: EshrahPlayer[];
  onStartMatch: () => void;
}

export const EshrahTVLobby: React.FC<EshrahTVLobbyProps> = ({
  roomCode,
  gameTitle,
  gameRuleSnippet,
  players,
  onStartMatch
}) => {
  const team1Players = players.filter((p) => p.teamId === 'team_1');
  const team2Players = players.filter((p) => p.teamId === 'team_2');
  const unassignedPlayers = players.filter((p) => !p.teamId);

  const canStart = team1Players.length >= 1 && team2Players.length >= 1;
  const joinUrl = `${window.location.origin}/join?code=${roomCode}`;

  const handleStart = () => {
    if (!canStart) return;
    sound.playRoundStart();
    onStartMatch();
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center justify-between gap-6 py-2 select-none" dir="rtl">
      {/* 1. Header & Centerpiece */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full items-stretch">
        {/* QR Code & Join Info */}
        <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-5 shadow-[4px_4px_0px_#2C2A29] flex flex-col items-center justify-center text-center gap-3">
          <div className="flex items-center gap-2 text-xs font-black text-[#5C4033]">
            <Smartphone className="w-4 h-4 text-[#8A9A5B]" />
            <span>امسح بكاميرا الجوال للانضمام</span>
          </div>

          <QRCodeView
            url={joinUrl}
            size={140}
            className="border-2 border-[#2C2A29] rounded-2xl shadow-[2px_2px_0px_#2C2A29]"
          />

          <div className="flex flex-col items-center gap-1 w-full mt-1">
            <span className="text-[11px] font-bold text-[#5C4033]">رمز الغرفة:</span>
            <span className="text-2xl font-black font-mono tracking-widest bg-[#E5E0D5] border-2 border-[#2C2A29] px-4 py-1 rounded-xl shadow-[2px_2px_0px_#2C2A29] text-[#2C2A29]">
              {roomCode}
            </span>
          </div>
        </div>

        {/* Game Rules / Guide Centerpiece */}
        <div className="md:col-span-2 bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-6 shadow-[5px_5px_0px_#2C2A29] flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black bg-[#8A9A5B] text-white border border-[#2C2A29] px-3 py-1 rounded-xl shadow-[2px_2px_0px_#2C2A29]">
                شرح اللعبة والقواعد
              </span>
              <span className="text-xs font-bold text-[#5C4033]">
                جوال واحد لكل فريق أو كل متسابق بجواله
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-[#2C2A29] mt-1">
              {gameTitle}
            </h2>

            <p className="text-sm md:text-base font-bold text-[#5C4033] leading-relaxed bg-[#E5E0D5]/60 border border-[#2C2A29]/20 p-4 rounded-2xl">
              {gameRuleSnippet}
            </p>
          </div>

          {/* Device notice */}
          <div className="flex items-center gap-2 bg-[#E5E0D5] border-2 border-[#2C2A29] rounded-2xl px-4 py-2.5 text-xs font-bold text-[#2C2A29]">
            <Sparkles className="w-4 h-4 text-[#C68B59] shrink-0" />
            <span>
              <strong>ملاحظة:</strong> اختيار الفرق وتوزيع اللاعبين يتم مباشرة من شاشات الجوالات.
            </span>
          </div>
        </div>
      </div>

      {/* 2. Team Displays (Read-Only on TV) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        {/* Team 1 Box */}
        <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-5 shadow-[4px_4px_0px_#2C2A29] flex flex-col gap-3">
          <div className="flex items-center justify-between border-b-2 border-[#2C2A29]/15 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-[#8A9A5B] border border-[#2C2A29]" />
              <h3 className="font-black text-lg text-[#2C2A29]">الفريق الأول</h3>
            </div>
            <span className="text-xs font-black bg-[#8A9A5B] text-white px-2.5 py-0.5 rounded-lg border border-[#2C2A29]">
              {team1Players.length} لاعب
            </span>
          </div>

          <div className="min-h-[70px] flex flex-wrap gap-2 items-start content-start">
            {team1Players.length === 0 ? (
              <span className="text-xs font-bold text-[#5C4033]/60 italic m-auto">
                بانتظار انضمام لاعب من الجوال...
              </span>
            ) : (
              team1Players.map((p) => (
                <span
                  key={p.id}
                  className="bg-[#8A9A5B]/15 border-2 border-[#8A9A5B] text-[#2C2A29] font-black text-xs px-3 py-1.5 rounded-xl shadow-[1px_1px_0px_#2C2A29]"
                >
                  {p.name}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Team 2 Box */}
        <div className="bg-[#F7F4EC] border-2 border-[#2C2A29] rounded-3xl p-5 shadow-[4px_4px_0px_#2C2A29] flex flex-col gap-3">
          <div className="flex items-center justify-between border-b-2 border-[#2C2A29]/15 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-[#C68B59] border border-[#2C2A29]" />
              <h3 className="font-black text-lg text-[#2C2A29]">الفريق الثاني</h3>
            </div>
            <span className="text-xs font-black bg-[#C68B59] text-white px-2.5 py-0.5 rounded-lg border border-[#2C2A29]">
              {team2Players.length} لاعب
            </span>
          </div>

          <div className="min-h-[70px] flex flex-wrap gap-2 items-start content-start">
            {team2Players.length === 0 ? (
              <span className="text-xs font-bold text-[#5C4033]/60 italic m-auto">
                بانتظار انضمام لاعب من الجوال...
              </span>
            ) : (
              team2Players.map((p) => (
                <span
                  key={p.id}
                  className="bg-[#C68B59]/15 border-2 border-[#C68B59] text-[#2C2A29] font-black text-xs px-3 py-1.5 rounded-xl shadow-[1px_1px_0px_#2C2A29]"
                >
                  {p.name}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Unassigned note if any */}
      {unassignedPlayers.length > 0 && (
        <div className="text-xs font-bold text-[#5C4033]">
          لاعبون لم يختاروا فريقهم بعد ({unassignedPlayers.length}):{' '}
          {unassignedPlayers.map((p) => p.name).join('، ')}
        </div>
      )}

      {/* 3. Launch Match Button */}
      <div className="w-full max-w-md">
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={`w-full py-4 rounded-2xl font-black text-xl border-2 border-[#2C2A29] shadow-[4px_4px_0px_#2C2A29] flex items-center justify-center gap-3 transition-all ${
            canStart
              ? 'bg-[#8A9A5B] hover:bg-[#78884d] text-white cursor-pointer active:scale-98'
              : 'bg-[#D5CEBF] text-[#7A7365] opacity-80 cursor-not-allowed shadow-none'
          }`}
        >
          <Play className="w-6 h-6 fill-current" />
          <span>{canStart ? 'ابدأ اللعبة' : 'بانتظار لاعب واحد على الأقل في كل فريق...'}</span>
        </button>
      </div>
    </div>
  );
};
