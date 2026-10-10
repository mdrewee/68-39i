import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  PlusCircle,
  ShoppingBag,
  Sparkles,
  ArrowDown,
  Users,
  Clock,
  ArrowLeft,
  X,
  Smartphone,
  ChevronDown,
  Globe2,
  BookOpen,
  Bot,
} from 'lucide-react';
import { Header } from '../components/common/Header';
import { GAME_CATEGORIES, GameModeInfo } from '../lib/gamesCatalog';
import { roomBus } from '../lib/roomBus';
import { sound } from '../lib/audio';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Quick join input state
  const [quickCode, setQuickCode] = useState('');
  const [quickCodeError, setQuickCodeError] = useState('');

  // Smooth scroll to `#games-catalog`
  const handleScrollToCatalog = () => {
    sound.playClick();
    const catalogEl = document.getElementById('games-catalog');
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Direct game selection & room creation
  const handleSelectGame = (game: GameModeInfo) => {
    sound.playClick();
    const newRoom = roomBus.createRoom(undefined, game.id);
    navigate(`/room/${newRoom.code}`);
  };

  // Handle quick join submit with room code validation
  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickCodeError('');
    const clean = quickCode.trim().toUpperCase();
    if (!clean) {
      setQuickCodeError('فضلاً أدخل رمز الغرفة');
      return;
    }

    const validation = roomBus.validateRoom(clean);
    if (!validation.valid) {
      setQuickCodeError(validation.reason || 'رمز الغرفة غير موجود أو غير نشط حالياً');
      sound.playTick();
      return;
    }

    sound.playClick();
    navigate(`/join?code=${clean}`);
  };

  return (
    <div className="min-h-screen bg-grain flex flex-col justify-between selection:bg-olive-500 selection:text-sand-50">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8 md:py-14 w-full flex flex-col gap-16 md:gap-20">
        {/* 1. Landing Hero Section */}
        <section className="text-center flex flex-col items-center gap-5 max-w-3xl mx-auto pt-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-ink-950 tracking-tight font-display leading-[1.15]">
            لعبة المجلس تبدأ هنا، <br />
            <span className="text-olive-700 underline decoration-sand-400 decoration-wavy underline-offset-8">
              الشاشة للجميع واللعب بجوالك!
            </span>
          </h1>

          <p className="text-base md:text-lg text-ink-700 font-medium max-w-xl leading-relaxed">
            أنشئ جلسة جديدة واعرض اللوحة على تلفزيون المجلس، ودع الجميع ينضمون بهواتفهم بلمسة واحدة بدون تحميل تطبيقات.
          </p>

          {/* Three Central Circular Action Buttons */}
          <div className="pt-6 pb-2 w-full flex items-center justify-center">
            <div className="flex items-center justify-center gap-5 sm:gap-8">
              {/* Right Button: "حسابي" (Profile details) */}
              <button
                onClick={() => {
                  sound.playClick();
                  setShowProfileModal(true);
                }}
                className="group flex flex-col items-center gap-2.5 select-none focus:outline-none"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-sand-200 hover:bg-sand-300 border-2 border-ink-950 shadow-tactile flex items-center justify-center text-ink-900 transition-all duration-150 ease-out group-hover:-translate-y-1 group-active:translate-y-0">
                  <User className="w-8 h-8 sm:w-9 sm:h-9 text-ink-800" />
                </div>
                <span className="text-sm sm:text-base font-black text-ink-950 font-display">
                  حسابي
                </span>
              </button>

              {/* Center Primary Button: "إنشاء لعبة" (Larger, Olivine & Ochre, Smooth Scroll) */}
              <button
                onClick={handleScrollToCatalog}
                className="group flex flex-col items-center gap-2.5 select-none focus:outline-none"
              >
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-olive-500 to-olive-600 border-3 border-ink-950 shadow-tactile-lg flex flex-col items-center justify-center text-sand-50 transition-all duration-150 ease-out group-hover:-translate-y-1.5 group-active:translate-y-0 relative overflow-hidden">
                  {/* Subtle ochre accent ring */}
                  <div className="absolute inset-0 rounded-full border-2 border-ochre-400/40 pointer-events-none" />
                  <PlusCircle className="w-10 h-10 sm:w-12 sm:h-12 text-sand-50" />
                  <ArrowDown className="w-4 h-4 text-sand-100 mt-1" />
                </div>
                <span className="text-base sm:text-lg font-black text-olive-800 font-display tracking-tight">
                  إنشاء لعبة
                </span>
              </button>

              {/* Left Button: "اشتري لعبة" (Store/Tokens with 'قريباً' badge) */}
              <div className="flex flex-col items-center gap-2.5 select-none relative">
                <button
                  disabled
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-sand-100 border-2 border-sand-400 shadow-tactile-sm flex items-center justify-center text-ink-400 opacity-80 cursor-not-allowed transition-all"
                >
                  <ShoppingBag className="w-8 h-8 sm:w-9 sm:h-9 text-ink-400" />
                </button>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-base font-bold text-ink-500 font-display">
                    اشتري لعبة
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-ochre-100 text-ochre-800 border border-ochre-800/30">
                    قريباً
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Join Strip for Guests */}
          <div className="mt-4 w-full max-w-md flex flex-col gap-2">
            <div className="w-full bg-sand-50 border-2 border-ink-950 rounded-tactile p-3.5 shadow-tactile flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-ochre-700" />
                <span className="text-xs font-bold text-ink-900">معك كود غرفة؟</span>
              </div>
              <form onSubmit={handleQuickJoin} className="flex items-center gap-2 flex-1 justify-end">
                <input
                  type="text"
                  value={quickCode}
                  onChange={(e) => {
                    setQuickCode(e.target.value.toUpperCase());
                    if (quickCodeError) setQuickCodeError('');
                  }}
                  placeholder="أدخل الرمز"
                  maxLength={6}
                  className="w-28 uppercase text-center font-mono font-bold text-xs py-1.5 px-2 rounded-md border-2 border-ink-950 bg-sand-100 focus:bg-sand-50 focus:outline-none focus:ring-1 focus:ring-olive-500"
                />
                <button
                  type="submit"
                  className="btn-tactile-secondary py-1 px-3 text-xs font-bold shrink-0"
                >
                  انضم
                </button>
              </form>
            </div>

            {quickCodeError && (
              <div className="text-xs font-bold text-red-700 bg-red-100 border-2 border-red-300 px-3.5 py-2 rounded-tactile text-center shadow-tactile-sm">
                {quickCodeError}
              </div>
            )}
          </div>
        </section>

        {/* 2. Categories & Game Catalog Section (`#games-catalog`) */}
        <section id="games-catalog" className="scroll-mt-24 flex flex-col gap-12 pt-6 border-t-2 border-sand-300">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-olive-700 text-xs font-bold">
                <Sparkles className="w-4 h-4" />
                <span>اختر اللعبة لإنشاء الجلسة فوراً</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-ink-950 font-display mt-0.5">
                كتالوج الألعاب
              </h2>
            </div>
            <p className="text-xs md:text-sm text-ink-600 max-w-md leading-relaxed">
              اضغط على أي نمط لعب لإنشاء غرفة الشاشة الكبيرة مباشرة وتجهيز الردهة للجميع.
            </p>
          </div>

          {/* Categories Render */}
          <div className="flex flex-col gap-12">
            {GAME_CATEGORIES.map((category) => (
              <div key={category.id} className="flex flex-col gap-5">
                {/* Category Header */}
                <div className="flex items-center justify-between border-b-2 border-ink-950 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-tactile bg-olive-100 border-2 border-ink-950 shadow-tactile-sm flex items-center justify-center font-bold text-sm text-olive-800">
                      {category.id === 'letters' ? 'أ' : category.id === 'words' ? <BookOpen className="w-5 h-5" /> : category.id === 'ai' ? <Bot className="w-5 h-5" /> : <Globe2 className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-black text-ink-950 font-display">
                        {category.title}
                      </h3>
                      <span className="text-[11px] text-ink-500 font-semibold">
                        {category.description}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-sand-200 border border-ink-950 text-ink-800">
                    {category.modes.length} أطوار متاحة
                  </span>
                </div>

                {/* Game Modes Grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {category.modes.map((mode) => (
                    <div
                      key={mode.id}
                      onClick={() => handleSelectGame(mode)}
                      className="card-tactile p-5 flex flex-col justify-between bg-sand-50 cursor-pointer group hover:bg-sand-100 select-none relative"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded border border-ink-950/20 bg-sand-200 text-ink-800">
                            {mode.tag}
                          </span>
                          <span className="text-[11px] font-bold text-olive-800 flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                            <span>إنشاء الغرفة</span>
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </span>
                        </div>

                        <div>
                          <h4 className="text-lg font-black text-ink-950 group-hover:text-olive-800 transition-colors">
                            {mode.title}
                          </h4>
                          <p className="text-xs font-semibold text-ochre-700 mt-0.5">
                            {mode.subtitle}
                          </p>
                        </div>

                        <p className="text-xs text-ink-700 leading-relaxed mt-1">
                          {mode.description}
                        </p>
                      </div>

                      <div className="pt-3 mt-4 border-t border-sand-300 flex items-center justify-between text-xs text-ink-600 font-bold">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-ink-800" />
                          <span>{mode.minPlayers} - {mode.maxPlayers} لاعبين</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-ink-800" />
                          <span>~ {mode.roundDurationMinutes} دقيقة</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Account / Profile Preview Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-tactile max-w-md w-full p-6 bg-sand-50 flex flex-col gap-4 relative">
            <div className="flex items-center justify-between border-b border-sand-300 pb-3">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-olive-700" />
                <h3 className="text-lg font-black text-ink-950">بيانات الحساب الشخصي</h3>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-1 rounded hover:bg-sand-200 text-ink-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 py-2 text-sm text-ink-800">
              <div className="p-3 bg-sand-200 rounded-tactile border border-ink-950/20 flex items-center justify-between">
                <span className="font-bold">حالة الحساب:</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-olive-100 text-olive-900 border border-olive-800">
                  لاعب نشط
                </span>
              </div>
              <div className="p-3 bg-sand-200 rounded-tactile border border-ink-950/20 flex items-center justify-between">
                <span className="font-bold">رصيد الألعاب المجانية:</span>
                <span className="font-mono font-bold text-olive-800 text-base">٥ ألعاب</span>
              </div>
              <p className="text-xs text-ink-600 leading-relaxed">
                ميزة تسجيل الحساب السحابي وربط المشتريات ستتوفر قريباً في المرحلة القادمة.
              </p>
            </div>

            <button
              onClick={() => setShowProfileModal(false)}
              className="btn-tactile-ghost py-2.5 text-sm"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Minimal Footer */}
      <footer className="border-t-2 border-ink-950 bg-sand-200 py-6 px-4 text-center mt-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-700 font-medium">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink-950 font-display">طق عصي</span>
            <span>—</span>
            <span>منصة ألعاب جماعية تفاعلية بنكهة أصيلة</span>
          </div>
          <div className="text-ink-500">
            Phase 1.1: Core Shell & Dynamic Category Browser
          </div>
        </div>
      </footer>
    </div>
  );
};
