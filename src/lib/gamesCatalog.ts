import { PlayerAvatar } from '../types/game';

export interface GameModeInfo {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  roundDurationMinutes: number;
  tag: string;
  category: 'letters' | 'geography' | 'words' | 'ai';
  icon: string;
  badgeColor: 'olive' | 'ochre' | 'sand';
}

export interface GameCategory {
  id: 'letters' | 'geography' | 'words' | 'ai';
  title: string;
  englishTitle: string;
  description: string;
  tag: string;
  modes: GameModeInfo[];
}

export const AVATAR_PRESETS: PlayerAvatar[] = [
  { id: 'dallah', name: 'الدلة', iconName: 'Coffee', bg: 'bg-ochre-100', fg: 'text-ochre-800' },
  { id: 'finjan', name: 'الفنجال', iconName: 'CupSoda', bg: 'bg-sand-200', fg: 'text-ink-900' },
  { id: 'palm', name: 'النخلة', iconName: 'Palmtree', bg: 'bg-olive-100', fg: 'text-olive-700' },
  { id: 'sword', name: 'السيف', iconName: 'Sword', bg: 'bg-ink-100', fg: 'text-ink-950' },
  { id: 'falcon', name: 'الصقر', iconName: 'Bird', bg: 'bg-ochre-200', fg: 'text-ochre-900' },
  { id: 'misbaha', name: 'السبحة', iconName: 'CircleDot', bg: 'bg-olive-200', fg: 'text-olive-800' },
  { id: 'camel', name: 'الهجين', iconName: 'Compass', bg: 'bg-sand-300', fg: 'text-ink-800' },
  { id: 'tent', name: 'البيت', iconName: 'Tent', bg: 'bg-ochre-100', fg: 'text-ochre-700' },
];

export const GAME_CATEGORIES: GameCategory[] = [
  {
    id: 'ai',
    title: 'فئة الذكاء الاصطناعي',
    englishTitle: 'AI Games',
    description: 'تحديات كشف الروبوتات والذكاء الاصطناعي والتجارب التفاعلية',
    tag: 'ذكاء ومكر',
    modes: [
      {
        id: 'conspiracy-maker',
        title: 'صانع المؤامرة',
        subtitle: 'صياغة ونقد خيوط المؤامرات السرية وتقييمها بالـ AI',
        description: 'حدثين عشوائيين مالهم دخل ببعض.. والمطلوب منك تسك خطوط مؤامرة سرية ترتبط بينهم والـ AI يقيّم ملفك السري!',
        minPlayers: 2,
        maxPlayers: 12,
        roundDurationMinutes: 5,
        tag: 'جديد',
        category: 'ai',
        icon: 'FileText',
        badgeColor: 'olive',
      },
      {
        id: 'the-scammer',
        title: 'النصاب',
        subtitle: 'حراج ومفاوضات بالذكاء الاصطناعي مع زبون شريطي',
        description: 'منتج غريب ومطلوب منك تصرفه على زبون AI شكّاك.. أقنعه يرفع السوم وأعلى بياع تنعرض محادثته بالشاشة!',
        minPlayers: 2,
        maxPlayers: 12,
        roundDurationMinutes: 5,
        tag: 'جديد',
        category: 'ai',
        icon: 'Gavel',
        badgeColor: 'olive',
      },
      {
        id: 'ai-lawyer',
        title: 'المحامي الـ AI',
        subtitle: 'محاكمة الأعذار والترقيعات بذكاء وتحكيم ساخر',
        description: 'قضية تورط الكل ومطلوب منك ترقع لنفسك.. والقاضي يحلل عذرك ويجلد ترقيعك!',
        minPlayers: 2,
        maxPlayers: 10,
        roundDurationMinutes: 5,
        tag: 'جديد',
        category: 'ai',
        icon: 'Scale',
        badgeColor: 'olive',
      },
      {
        id: 'who-is-ai',
        title: 'مين الـ AI فينا؟',
        subtitle: 'كشف الروبوت المندس ومقارنة الإجابات',
        description: 'كل واحد يسأل ويجاوب بأسماء مجهولة.. ركزوا في الأجوبة واكشفوا مين الروبوت اللي بينكم!',
        minPlayers: 3,
        maxPlayers: 7,
        roundDurationMinutes: 6,
        tag: 'أرشيف',
        category: 'ai',
        icon: 'Bot',
        badgeColor: 'sand',
      },
    ],
  },

  {
    id: 'letters',
    title: 'فئة الحروف',
    englishTitle: 'Letter Cells',
    description: 'تحديات سرعة البديهة والكلمات العربية والإنجليزية في خلايا الحروف التفاعلية',
    tag: 'سرعة ولغة',
    modes: [
      {
        id: 'letter-classic',
        title: 'حروف كلاسيكية',
        subtitle: 'تكوين الكلمات وسرعة البديهة',
        description: 'تظهر خلية الحروف على الشاشة، يتسابق اللاعبون على إيجاد أطول وأصح الكلمات قبل انتهاء الوقت.',
        minPlayers: 2,
        maxPlayers: 12,
        roundDurationMinutes: 12,
        tag: 'كلاسيك',
        category: 'letters',
        icon: 'Grid',
        badgeColor: 'olive',
      },
      {
        id: 'letter-en',
        title: 'حروف إنجليزية',
        subtitle: 'English Vocabulary Challenge',
        description: 'تحدي الكلمات باللغة الإنجليزية في شبكة الحروف، ممتاز للجلسات السريعة ومحبي المفردات.',
        minPlayers: 2,
        maxPlayers: 12,
        roundDurationMinutes: 10,
        tag: 'English',
        category: 'letters',
        icon: 'Languages',
        badgeColor: 'ochre',
      },
      {
        id: 'letter-last',
        title: 'آخر حرف',
        subtitle: 'الجواب ينتهي بالحرف المحدد',
        description: 'تحدي معاكس يتطلب إعطاء إجابات تنتهي بالحرف المعروض على الشاشة وليس بالبداية!',
        minPlayers: 3,
        maxPlayers: 10,
        roundDurationMinutes: 15,
        tag: 'تحدي عكسي',
        category: 'letters',
        icon: 'CornerDownLeft',
        badgeColor: 'olive',
      },
      {
        id: 'letter-categories',
        title: 'الأصناف',
        subtitle: 'حرف + تصنيف محدد',
        description: 'حرف عشوائي مع تصنيف (جماد، بلاد، أكلة، شخصية) وأسرع من يضغط الجرس أو يكتب الإجابة يفوز.',
        minPlayers: 2,
        maxPlayers: 14,
        roundDurationMinutes: 15,
        tag: 'تصنيفات',
        category: 'letters',
        icon: 'Layers',
        badgeColor: 'sand',
      },
    ],
  },
  {
    id: 'geography',
    title: 'فئة الجغرافيا',
    englishTitle: 'Geography & Flags',
    description: 'تحديات الألوان والخرائط الدقيقة واستكشاف شبه الجزيرة والعالم',
    tag: 'خرائط ومعالم',
    modes: [
      {
        id: 'geo-flag-color',
        title: 'لون العلم',
        subtitle: 'تخمين درجة لون العلم الصحيحة',
        description: 'يظهر علم مع جزء مخفي باللون الرمادي، قم باختيار اللون الصحيح بدقة من شريط الألوان. الأقرب للون الحقيقي يفوز!',
        minPlayers: 2,
        maxPlayers: 12,
        roundDurationMinutes: 5,
        tag: 'جاهزة للعب',
        category: 'geography',
        icon: 'Palette',
        badgeColor: 'ochre',
      },
      {
        id: 'geo-pin-landmark',
        title: 'حدد الموقع',
        subtitle: 'تحديد إحداثيات المعالم على الخريطة',
        description: 'يظهر اسم معلم بارز، حدد موقعه على الخريطة بدقة وتنافس مع زملائك في المجلس. الأقرب جغرافياً يحصد أعلى النقاط!',
        minPlayers: 1,
        maxPlayers: 16,
        roundDurationMinutes: 5,
        tag: 'جاهزة للعب',
        category: 'geography',
        icon: 'MapPin',
        badgeColor: 'olive',
      },
      {
        id: 'geo-trajectory',
        title: 'على مسار الخط',
        subtitle: 'توقع الدول الواقعة على امتداد المسار',
        description: 'ينطلق مسار مستقيم عبر العالم بزاوية محددة من دولة الانطلاق. سمّ أبعد دولة يمر بها الخط لكسب أعلى النقاط، وتجنب الخطأ!',
        minPlayers: 1,
        maxPlayers: 16,
        roundDurationMinutes: 5,
        tag: 'جاهزة للعب',
        category: 'geography',
        icon: 'Compass',
        badgeColor: 'ochre',
      },
      {
        id: 'geo-blind-tourism',
        title: 'سياحة عمياء',
        subtitle: 'تخمين الوجهة من ٥ تلميحات تدريجية',
        description: 'تظهر تلميحات تدريجية كل ١٥ ثانية، كلما قفلت إجابتك مبكراً حصدت نقاطاً أعلى (٥ إلى ١). احذر التسرع والخطأ!',
        minPlayers: 1,
        maxPlayers: 16,
        roundDurationMinutes: 5,
        tag: 'جاهزة للعب',
        category: 'geography',
        icon: 'HelpCircle',
        badgeColor: 'olive',
      },
    ],
  },
  {
    id: 'words',
    title: 'فئة الكلمات',
    englishTitle: 'Word Games',
    description: 'تحديات لغوية وسرعة بديهة وتنافس مباشر في الكلمات والمفردات',
    tag: 'لغة وتحدي',
    modes: [
      {
        id: 'three-letter-word',
        title: 'كلمة ثلاثية',
        subtitle: 'تبديل وتكديس الحروف الثلاثية وتصفير اليد',
        description: 'بدّل حرف واحد من كروتك ونزله فوق الكروت بالساحة لتكوين كلمة ثلاثية صحيحة.. أول من يخلّص كروته الثمانية يفوز!',
        minPlayers: 2,
        maxPlayers: 12,
        roundDurationMinutes: 5,
        tag: 'جديد',
        category: 'words',
        icon: 'Layers',
        badgeColor: 'olive',
      },
      {
        id: 'scattergories',
        title: 'اسم جماد نبات',
        subtitle: 'التحدي الكلاسيكي بفئات عصرية',
        description: 'التحدي الكلاسيكي بفئات عصرية واختيار وتحكيم يدوي من المضيف للكلمات والنتائج.',
        minPlayers: 1,
        maxPlayers: 16,
        roundDurationMinutes: 5,
        tag: 'جاهزة للعب',
        category: 'words',
        icon: 'Sparkles',
        badgeColor: 'olive',
      },
      {
        id: 'wordle-rush',
        title: 'سباق ووردل',
        subtitle: 'سباق تخمين الكلمة السرية',
        description: 'سباق تخمين لحظي بدون إظهار الحروف على الشاشة لمنع الغش؛ أول من يفك الكلمة يفوز!',
        minPlayers: 1,
        maxPlayers: 16,
        roundDurationMinutes: 5,
        tag: 'جاهزة للعب',
        category: 'words',
        icon: 'Layers',
        badgeColor: 'ochre',
      },
      {
        id: 'pentagon-clash',
        title: 'خلية الخماسيات',
        subtitle: 'خطف الكلمات وتنافس فوري',
        description: '6 أشكال خماسية؛ كوّن كلماتك واخطفها واقفلها قبل باقي المتسابقين في المجلس!',
        minPlayers: 1,
        maxPlayers: 16,
        roundDurationMinutes: 5,
        tag: 'جاهزة للعب',
        category: 'words',
        icon: 'Hexagon',
        badgeColor: 'olive',
      },
    ],
  },
];

// Flattened list of all modes for easy lookup
export const ALL_GAME_MODES: GameModeInfo[] = GAME_CATEGORIES.flatMap((c) => c.modes);

// Backwards compatibility alias for older imports
export const GAMES_CATALOG = ALL_GAME_MODES.map((mode) => ({
  ...mode,
  status: 'ready' as const,
}));
