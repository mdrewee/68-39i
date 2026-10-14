import { arabicDict, normalizeArabic, isValidArabicWord } from '../../../utils/arabicDictionary';
import { isNotArchaic } from '../../../utils/commonArabicWords';

export interface PentagonSeed {
  id: string;
  centerLetter: string;
  outerLetters: [string, string, string, string, string]; // 5 letters
  pangram: string; // 6-letter word using all letters
  validWords: string[]; // List of verified formable Arabic words
}

const VOWELS_CONNECTING = ['ا', 'و', 'ي', 'ر', 'م', 'ن', 'ل', 'ب', 'ت', 'س', 'د', 'ع'];
const CONSONANTS = ['ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'];

export const CURATED_FALLBACK_SEEDS: PentagonSeed[] = [
  {
    id: 'seed_1',
    centerLetter: 'ر',
    outerLetters: ['س', 'م', 'ا', 'ف', 'ت'],
    pangram: 'مسافرت',
    validWords: ['سافر', 'فارس', 'فرس', 'رسم', 'مسار', 'سمار', 'سفر', 'تمر', 'متر', 'فتر', 'رات', 'سما', 'فار', 'سار', 'سام', 'رمس', 'مات', 'فاز', 'استر', 'ستار', 'مرت', 'سارت', 'فرات', 'تامر', 'مسافرت', 'فترات', 'مسافر', 'فارست']
  },
  {
    id: 'seed_2',
    centerLetter: 'ل',
    outerLetters: ['ق', 'ا', 'ع', 'ت', 'د'],
    pangram: 'تعاقدل',
    validWords: ['قال', 'عقل', 'عدل', 'قلع', 'لقاء', 'قاتل', 'دلع', 'قتل', 'قعد', 'عقد', 'عاد', 'دعا', 'قلت', 'دلت', 'تقاعد', 'تعادل', 'قلعت', 'قاتلت', 'عاقل', 'عادل', 'قائد', 'لقد', 'عدت']
  },
  {
    id: 'seed_3',
    centerLetter: 'ك',
    outerLetters: ['م', 'ا', 'ت', 'ب', 'ه'],
    pangram: 'مكتبات',
    validWords: ['كتب', 'كاتب', 'كتاب', 'مكتب', 'كتم', 'بكت', 'مات', 'بات', 'تاب', 'تام', 'مكه', 'تبك', 'كتابه', 'مكتبه', 'كاتبه', 'مكتئب', 'تبات', 'بتات', 'تكاتب', 'مكتبات', 'كاتبات']
  },
  {
    id: 'seed_4',
    centerLetter: 'ن',
    outerLetters: ['س', 'ل', 'ط', 'ا', 'ه'],
    pangram: 'سلطانه',
    validWords: ['سلطان', 'لسان', 'سال', 'نال', 'طال', 'طلس', 'سنه', 'طنه', 'انس', 'سلا', 'طاسه', 'سلطه', 'لسانه', 'سلطانه', 'طنان', 'السن', 'سلان']
  },
  {
    id: 'seed_5',
    centerLetter: 'ص',
    outerLetters: ['ح', 'ر', 'ا', 'ء', 'ه'],
    pangram: 'صحراء',
    validWords: ['صحراء', 'صار', 'صاح', 'حرص', 'راح', 'حار', 'حصار', 'صره', 'حاره', 'صارح', 'صارحه', 'صحرا', 'حراء', 'احرص', 'صرح', 'صرخ']
  }
];

export function generateDynamicPentagonRound(
  roundNumber: number,
  previousLetterSets: Set<string> = new Set()
): PentagonSeed {
  // Try up to 40 randomized attempts
  for (let attempt = 0; attempt < 40; attempt++) {
    const numVowels = Math.random() > 0.5 ? 2 : 1;
    const shuffledVowels = [...VOWELS_CONNECTING].sort(() => Math.random() - 0.5);
    const chosenLetters = new Set<string>();

    for (let i = 0; i < numVowels; i++) {
      chosenLetters.add(shuffledVowels[i]);
    }

    const shuffledConsonants = [...CONSONANTS].sort(() => Math.random() - 0.5);
    for (const c of shuffledConsonants) {
      if (chosenLetters.size >= 6) break;
      chosenLetters.add(c);
    }

    const lettersArr = Array.from(chosenLetters);
    if (lettersArr.length !== 6) continue;

    const setKey = [...lettersArr].sort().join('');
    if (previousLetterSets.has(setKey)) continue;

    const shuffled = lettersArr.sort(() => Math.random() - 0.5);
    const center = shuffled[0];
    const outer: [string, string, string, string, string] = [
      shuffled[1], shuffled[2], shuffled[3], shuffled[4], shuffled[5]
    ];

    const formable = arabicDict.getWordsForLetters(shuffled, 3, 6)
      .filter(w => normalizeArabic(w).includes(normalizeArabic(center)) && isNotArchaic(w));

    if (formable.length >= 15) {
      previousLetterSets.add(setKey);
      return {
        id: `dynamic_${roundNumber}_${Date.now()}_${attempt}`,
        centerLetter: center,
        outerLetters: outer,
        pangram: formable.find(w => w.length >= 6) || formable[0] || '',
        validWords: formable
      };
    }
  }

  // Fallback seed with rotated center letter
  const fallback = CURATED_FALLBACK_SEEDS[(roundNumber - 1) % CURATED_FALLBACK_SEEDS.length];
  const allLetters = [fallback.centerLetter, ...fallback.outerLetters].sort(() => Math.random() - 0.5);
  const formable = arabicDict.getWordsForLetters(allLetters, 3, 6)
    .filter(w => normalizeArabic(w).includes(normalizeArabic(allLetters[0])));

  return {
    id: `fallback_${roundNumber}_${Date.now()}`,
    centerLetter: allLetters[0],
    outerLetters: [allLetters[1], allLetters[2], allLetters[3], allLetters[4], allLetters[5]],
    pangram: fallback.pangram,
    validWords: formable.length >= 10 ? formable : fallback.validWords
  };
}

export function isPentagonWordValid(
  word: string,
  centerLetter: string,
  outerLetters: string[],
  validWords?: string[]
): boolean {
  if (!word) return false;
  const clean = normalizeArabic(word);
  if (clean.length < 3 || clean.length > 6) return false;

  const centerNorm = normalizeArabic(centerLetter);
  if (!clean.includes(centerNorm)) return false;

  const allowed = new Set([centerLetter, ...outerLetters].map(normalizeArabic));
  for (const ch of Array.from(clean)) {
    if (!allowed.has(ch)) return false;
  }

  if (validWords && validWords.some(vw => normalizeArabic(vw) === clean)) {
    return true;
  }

  return isValidArabicWord(clean) && isNotArchaic(clean);
}

export function calculatePentagonWordScore(word: string, allLetters: string[]): number {
  const clean = normalizeArabic(word);
  const len = clean.length;
  const uniqueChars = new Set(Array.from(clean));
  const normLetters = allLetters.map(normalizeArabic);
  const isPangram = normLetters.every(ch => uniqueChars.has(ch)) || len >= 6;

  if (isPangram) return 8;
  if (len >= 5) return 4;
  if (len === 4) return 2;
  if (len === 3) return 1;
  return 0;
}

export function getPentagonPoints(cx: number, cy: number, r: number, rotationDeg: number = 0): string {
  const points: string[] = [];
  const rotRad = (rotationDeg * Math.PI) / 180;
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5 + rotRad;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(' ');
}
