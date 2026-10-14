import { arabicDict } from '../../../../utils/arabicDictionary';
import { ThreeLetterCardItem, BoardSlotState, MoveAttemptResult } from '../types';
import { verifiedThreeLetterWordsSet, normalizeArabicWord } from '../data/verifiedThreeLetterWords';
import { isNotArchaic } from '../../../../utils/commonArabicWords';

export { normalizeArabicWord };

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
  'هيا', 'مهلا', 'صهل', 'عما', 'بما', 'كما', 'لما', 'فما', 'فمن', 'وعن',
  'ففي', 'وبك', 'ولك', 'فلك', 'فمن', 'ومن', 'وهل', 'فهل', 'ولن', 'فلن',
  // Imperative verbs (أفعال الأمر)
  'اكتب', 'اخرج', 'اشرب', 'العب', 'اقفز', 'اسمع', 'انظر', 'ارسم', 'ادخل',
  'قف', 'نم', 'قل', 'زر', 'بع', 'سر', 'ضع', 'دع', 'خذ', 'كل', 'صل', 'سل'
]);

// Strict Arabic 3-letter word check
export const isValidThreeLetterWord = (candidate: string): boolean => {
  if (!candidate) return false;

  const normalized = normalizeArabicWord(candidate);
  if (normalized.length !== 3) return false;

  // Reject banned particles, prepositions, imperatives, and archaic obsolete words
  if (
    BANNED_PARTICLES_AND_COMMANDS.has(normalized) ||
    BANNED_PARTICLES_AND_COMMANDS.has(candidate) ||
    !isNotArchaic(normalized) ||
    !isNotArchaic(candidate)
  ) {
    return false;
  }

  // 1. Check verified authentic 3-letter words set
  if (verifiedThreeLetterWordsSet.has(normalized)) {
    return true;
  }

  // 2. Strict dictionary check: must strictly be an existing 3-letter word
  if (arabicDict.isValid(normalized, 3) || arabicDict.isValid(candidate, 3)) {
    return true;
  }

  return false;
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
  const normCandidate = normalizeArabicWord(candidateWord);

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
