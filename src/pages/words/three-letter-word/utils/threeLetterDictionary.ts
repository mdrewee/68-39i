import { arabicDict, normalizeArabic } from '../../../../utils/arabicDictionary';
import { ThreeLetterCardItem, BoardSlotState, MoveAttemptResult } from '../types';

export const RETRO_CARD_PALETTE = [
  '#C86D51', // Terracotta Rust
  '#7D8D53', // Vintage Olivine
  '#C68B59', // Warm Ochre
  '#486577', // Deep Slate Blue
  '#B86868', // Dusty Rose
  '#D49D42', // Muted Mustard
  '#9E5B42', // Rich Clay
  '#627D59'  // Desert Moss
];

export const ARABIC_ALPHABET_WEIGHTED = [
  'ا', 'ا', 'ا', 'ب', 'ب', 'ت', 'ت', 'ث',
  'ج', 'ح', 'خ', 'د', 'د', 'ذ', 'ر', 'ر',
  'ز', 'س', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ',
  'ع', 'ع', 'غ', 'ف', 'ف', 'ق', 'ق', 'ك',
  'ك', 'ل', 'ل', 'ل', 'م', 'م', 'م', 'ن',
  'ن', 'هـ', 'و', 'و', 'ي', 'ي'
];

// Blacklist of particles, interrogatives, prepositions, pronouns, and imperatives (ممنوع الحروف وأدوات الاستفهام والأمر)
export const BANNED_PARTICLES_AND_COMMANDS = new Set([
  'كيف', 'مما', 'على', 'الى', 'إلى', 'عنك', 'منك', 'فيك', 'حتى',
  'ليت', 'لعل', 'لكن', 'سوف', 'إذا', 'اذا', 'حيث', 'بلى', 'نعم',
  'عسى', 'ربت', 'بين', 'فوق', 'تحت', 'لدن', 'منذ', 'مذ', 'قبل', 'بعد',
  'معي', 'معك', 'لنا', 'لكم', 'لهم', 'منه', 'منها', 'فيهم', 'عنهم',
  'هذا', 'هذه', 'هنا', 'هناك', 'التي', 'الذي', 'متى', 'اين', 'أين', 'ايان',
  'هيا', 'مهلا', 'صهل',
  // 3-letter imperatives and particles:
  'اكتب', 'اخرج', 'اشرب', 'العب', 'اقفز', 'اسمع', 'انظر', 'ارسم', 'ادخل',
  'قف', 'نم', 'قل', 'زر', 'بع', 'سر', 'ضع', 'دع', 'خذ', 'كل', 'صل', 'سل'
]);

// Massive vetted bank of authentic 3-letter Arabic nouns & past/present verbs (أسماء وأفعال ماضية ومضارعة)
export const VETTED_THREE_LETTER_WORDS: string[] = [
  'كتب', 'علم', 'نصر', 'ذهب', 'حمد', 'شكر', 'ملك', 'حكم',
  'درس', 'صنع', 'قفل', 'فتح', 'رسم', 'جمع', 'طرد', 'قصد',
  'بحر', 'شمس', 'قمر', 'نجم', 'عقل', 'قلب', 'صوت', 'نور',
  'سعد', 'وصل', 'وقف', 'فهم', 'حفظ', 'زرع', 'شرب', 'اكل',
  'ضرب', 'نظر', 'طلب', 'عرف', 'عقد', 'نقل', 'صبر', 'فرح',
  'سبح', 'قطع', 'رفع', 'وضع', 'سكن', 'دخل', 'خرج', 'رجع',
  'غرس', 'حصد', 'بنى', 'هدم', 'سأل', 'أجاب', 'وجد', 'فقد',
  'ربح', 'خسر', 'نصح', 'مدح', 'ذم', 'شهد', 'سمع', 'بصر',
  'نطق', 'صمت', 'ركب', 'نزل', 'دفع', 'سحب', 'حمل', 'وضع',
  'خلق', 'رزق', 'بعث', 'حشر', 'غفر', 'رحم', 'ستر', 'كرم',
  'جود', 'فخر', 'عز', 'مجد', 'شرف', 'نبل', 'صدق', 'عدل',
  'ظلم', 'قهر', 'غلب', 'هزم', 'صلح', 'فسد', 'طهر', 'نجس',
  'خبز', 'طبخ', 'عجن', 'طحن', 'غسل', 'كوى', 'خاط', 'لبس',
  'خلع', 'ستر', 'كشف', 'ظهر', 'خفي', 'كتم', 'باح', 'سرر',
  'نهر', 'جبل', 'سهل', 'وادي', 'غاب', 'شجر', 'ثمر', 'زهر',
  'ورد', 'عشب', 'نخل', 'تمر', 'عنب', 'تين', 'رمان', 'زيت',
  'لحم', 'طير', 'سمك', 'وحش', 'سبع', 'فهد', 'نمر', 'اسد',
  'ذئب', 'ثعلب', 'ضبع', 'غزال', 'ظبي', 'وعل', 'جمل', 'ناقة',
  'فرس', 'مهر', 'حمار', 'بغل', 'ثور', 'بقر', 'غنم', 'ماعز',
  'كبش', 'حمل', 'كلب', 'قط', 'فأر', 'جرد', 'قرد', 'فيل',
  'صقر', 'نسر', 'عقاب', 'غراب', 'حمام', 'يمام', 'بلبل', 'هدهد',
  'نحل', 'نمل', 'فراش', 'ذباب', 'بعوض', 'عنكب', 'عقرب', 'حية',
  'ثعبان', 'ضفدع', 'سلحف', 'تمساح', 'حوت', 'قرش', 'دولف', 'سردين',
  'سيف', 'رمح', 'قوس', 'سهم', 'درع', 'خوذة', 'ترس', 'خنجر',
  'قلم', 'حبر', 'ورق', 'جلد', 'لوح', 'خط', 'نقش', 'رقم',
  'بيت', 'دار', 'قصر', 'كوخ', 'خيمة', 'غرفة', 'باب', 'نافذة',
  'سقف', 'جدار', 'عمود', 'بساط', 'فرش', 'وسادة', 'سرير', 'كرسي',
  'قدر', 'صحن', 'كوب', 'كأس', 'ابريق', 'ملعقة', 'سكين', 'موقد',
  'سوق', 'دكان', 'متجر', 'مال', 'ذهب', 'فضة', 'نحاس', 'حديد',
  'حجر', 'طين', 'رمل', 'تراب', 'غبار', 'دخان', 'نار', 'لهب',
  'رماد', 'شرر', 'جليد', 'ثلج', 'مطر', 'سحاب', 'غيم', 'ضباب',
  'ريح', 'عاصف', 'نسيم', 'حر', 'برد', 'دفء', 'ظل', 'ضوء',
  'ظلام', 'ليل', 'نهار', 'فجر', 'صبح', 'ظهر', 'عصر', 'مغرب',
  'عشاء', 'سحر', 'غسق', 'شفق', 'سنة', 'شهر', 'يوم', 'ساعة',
  'حلم', 'رؤيا', 'فكر', 'ظن', 'شك', 'يقين', 'علم', 'جهل',
  'حكم', 'رشد', 'ضلال', 'هدى', 'حق', 'باطل', 'خير', 'شر',
  'نفع', 'ضر', 'ألم', 'وجع', 'سقم', 'مرض', 'شفاء', 'دواء'
];

// Normalize and compile set for instant lookup
const VETTED_SET = new Set(VETTED_THREE_LETTER_WORDS.map((w) => normalizeArabic(w)));

export const isValidThreeLetterWord = (candidate: string): boolean => {
  const norm = normalizeArabic(candidate);
  if (norm.length !== 3) return false;
  if (BANNED_PARTICLES_AND_COMMANDS.has(norm) || BANNED_PARTICLES_AND_COMMANDS.has(candidate)) {
    return false;
  }

  // Check fast vetted set first
  if (VETTED_SET.has(norm)) return true;

  // Fallback to full dictionary if valid 3-letter word
  return arabicDict.isValid(norm, 3);
};

export const getRandomCardColor = (exclude?: string): string => {
  const available = exclude ? RETRO_CARD_PALETTE.filter((c) => c !== exclude) : RETRO_CARD_PALETTE;
  return available[Math.floor(Math.random() * available.length)];
};

export const generateInitialHand = (count: number = 8): ThreeLetterCardItem[] => {
  return Array.from({ length: count }, (_, idx) => {
    const letter = ARABIC_ALPHABET_WEIGHTED[Math.floor(Math.random() * ARABIC_ALPHABET_WEIGHTED.length)];
    const colorBg = RETRO_CARD_PALETTE[idx % RETRO_CARD_PALETTE.length] || getRandomCardColor();
    return {
      id: 'c_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 9)),
      letter,
      colorBg
    };
  });
};

export const generateInitialBoard = (): [BoardSlotState, BoardSlotState, BoardSlotState] => {
  const starterWords = ['كتب', 'علم', 'نصر', 'ذهب', 'حمد', 'شكر', 'ملك', 'حكم', 'درس', 'فتح', 'رسم', 'بحر', 'شمس', 'قمر', 'نجم', 'قلب', 'صوت', 'نور'];
  const chosenWord = starterWords[Math.floor(Math.random() * starterWords.length)];
  const letters = chosenWord.split('');

  return [
    {
      positionIndex: 0,
      topCard: {
        id: 'init_0_' + Date.now(),
        letter: letters[0] || 'ك',
        colorBg: RETRO_CARD_PALETTE[0]
      },
      stackHistory: []
    },
    {
      positionIndex: 1,
      topCard: {
        id: 'init_1_' + Date.now(),
        letter: letters[1] || 'ت',
        colorBg: RETRO_CARD_PALETTE[1]
      },
      stackHistory: []
    },
    {
      positionIndex: 2,
      topCard: {
        id: 'init_2_' + Date.now(),
        letter: letters[2] || 'ب',
        colorBg: RETRO_CARD_PALETTE[2]
      },
      stackHistory: []
    }
  ];
};

export const validateWordPlacement = (
  currentBoard: [BoardSlotState, BoardSlotState, BoardSlotState],
  slotIndex: 0 | 1 | 2,
  newLetter: string
): MoveAttemptResult => {
  // Construct resulting 3-letter word
  const letters = currentBoard.map((slot, idx) => (idx === slotIndex ? newLetter : slot.topCard.letter));
  const candidateWord = letters.join('');
  const normCandidate = normalizeArabic(candidateWord);

  // Check identical letter on same slot
  if (currentBoard[slotIndex].topCard.letter === newLetter) {
    return {
      isValid: false,
      resultingWord: candidateWord,
      errorMessage: 'الحرف مطابق للحرف الموجود حالياً في نفس المكان!'
    };
  }

  // Check if banned
  if (BANNED_PARTICLES_AND_COMMANDS.has(normCandidate) || BANNED_PARTICLES_AND_COMMANDS.has(candidateWord)) {
    return {
      isValid: false,
      resultingWord: candidateWord,
      errorMessage: `كلمة (${candidateWord}) أداة أو حرف وليست اسماً أو فعلاً معتمداً!`
    };
  }

  const isValid = isValidThreeLetterWord(candidateWord);

  return {
    isValid,
    resultingWord: candidateWord,
    errorMessage: isValid ? undefined : `كلمة (${candidateWord}) غير صحيحة في المعجم العربي!`
  };
};
