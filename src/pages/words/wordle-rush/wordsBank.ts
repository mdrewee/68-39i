/**
 * Wordle Rush 5-letter target words and dictionary.
 * All words are guaranteed strictly 5 characters (Arabic).
 */

export const WORDLE_TARGET_WORDS: string[] = [
  'سفينة', 'صحراء', 'بركان', 'كواكب', 'ياقوت',
  'سلطان', 'فيروز', 'مسافر', 'مدينة', 'كتابة',
  'حديقة', 'زرافة', 'شواطئ', 'أبطال', 'أزهار',
  'أشجار', 'جزيرة', 'قاهرة', 'سحابة', 'منارة',
  'فارسة', 'قاطرة', 'أعلام', 'أنهار', 'أمواج',
  'أسوار', 'أنوار', 'فراشة', 'ليمون', 'زيتون',
  'غواصة', 'عاصفة', 'مملكة', 'فرسان', 'بستان',
  'مفتاح', 'مصباح', 'تمثال', 'مرجان', 'فنجان',
  'بلابل', 'أقمار', 'طائرة', 'نخيلة', 'رمانة'
];

// Comprehensive valid 5-letter words dictionary for verification
export const VALID_DICTIONARY: Set<string> = new Set([
  ...WORDLE_TARGET_WORDS,
  'حمامة', 'طبيعة', 'عصفور', 'شجاعة', 'كرامة',
  'شهامة', 'سلامة', 'طاولة', 'لوحات', 'عجلات',
  'نظارة', 'سماعة', 'سيارة', 'حافلة', 'دراجة',
  'معركة', 'حكاية', 'رواية', 'قصيدة', 'مغامر',
  'مبتكر', 'مخترع', 'محارب', 'مقاتل', 'شاعرن',
  'رسامة', 'كاتبة', 'طبيبة', 'مهندس', 'محامي',
  'قبطان', 'صيادو', 'فلاحو', 'صانعة', 'تاجرة',
  'خياطة', 'نجارة', 'حدادة', 'سباحة', 'رماية',
  'فروسة', 'وثيقة', 'خريطة', 'بوصلة', 'سياحة',
  'متحفو', 'مكتبة', 'مدرسة', 'جامعة', 'معهدك',
  'أوطان', 'أحلام', 'أيامك', 'سنينك', 'شهورك',
  'أفراح', 'أحزان', 'أسرار', 'ألغاز', 'كنوزك'
]);

export type TileStatus = 'correct' | 'present' | 'absent' | 'empty';

/**
 * Normalizes an Arabic letter for comparison
 */
export function normalizeChar(ch: string): string {
  if (!ch) return '';
  return ch
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

/**
 * Standard Wordle guess evaluation (handles duplicate letters correctly).
 * Returns array of 5 statuses.
 */
export function evaluateWordleGuess(guess: string, target: string): TileStatus[] {
  const result: TileStatus[] = ['absent', 'absent', 'absent', 'absent', 'absent'];
  const guessChars = Array.from(guess);
  const targetChars = Array.from(target);

  if (guessChars.length !== 5 || targetChars.length !== 5) {
    return result;
  }

  const targetUsed = [false, false, false, false, false];
  const guessUsed = [false, false, false, false, false];

  // 1st Pass: Find Greens (Correct)
  for (let i = 0; i < 5; i++) {
    if (normalizeChar(guessChars[i]) === normalizeChar(targetChars[i])) {
      result[i] = 'correct';
      targetUsed[i] = true;
      guessUsed[i] = true;
    }
  }

  // 2nd Pass: Find Yellows (Present)
  for (let i = 0; i < 5; i++) {
    if (guessUsed[i]) continue;
    const gNorm = normalizeChar(guessChars[i]);

    for (let j = 0; j < 5; j++) {
      if (!targetUsed[j] && gNorm === normalizeChar(targetChars[j])) {
        result[i] = 'present';
        targetUsed[j] = true;
        break;
      }
    }
  }

  return result;
}

/**
 * Checks if a 5-letter word is considered valid
 */
export function isValidWord(word: string): boolean {
  if (!word || Array.from(word).length !== 5) return false;
  // If in dictionary, valid!
  if (VALID_DICTIONARY.has(word)) return true;
  // Fallback: check normalized form
  for (const item of VALID_DICTIONARY) {
    if (Array.from(item).map(normalizeChar).join('') === Array.from(word).map(normalizeChar).join('')) {
      return true;
    }
  }
  // Allow all target words unconditionally
  return WORDLE_TARGET_WORDS.includes(word);
}
