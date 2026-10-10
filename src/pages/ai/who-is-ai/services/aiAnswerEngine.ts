// src/pages/ai/who-is-ai/services/aiAnswerEngine.ts
import { supabase } from '../../../../lib/supabase';
import { RoomQuestion, RoomAnswer } from '../types';
import { profileGroupStyle } from './answerProfiler';

const QUESTION_EXAMPLES = [
  'وش أغرب سالفة صارت لك في مشوار أوبر؟',
  'وش الكذبة اللي دايم تمشيها إذا تأخرت على الاستراحة؟',
  'وش أكثر تصرف ينرفزك بالجمعات وتكتم غيظك؟',
  'لو طردوك من وظيفتك الحين وش أول شي تسويه؟',
  'أغرب شي شريته من حراج أو نون وندمت فوراً؟',
  'وش الأكلة اللي يمدحونها كل الناس وأنت تشوفها مقلب؟',
  'وش الفوبيا الغريبة اللي عندك وتستحي تقولها لأخوياك؟',
  'لو جاك اتصال بنص الليل وقالوا قطيتك 500 ريال وش ترد؟',
  'أغبى عذر سلكت فيه عشان تسحب على عزيمة؟',
  'وش أغرب موقف سويته مع الوالد ولا يدري عنه؟',
  'لو انحشرت في مصعد مع واحد تكرهه وش تسوي؟',
  'وش الموقف اللي تذكرته وفجأة ضحكت لحالك بالشارع؟',
  'وش المشروع اللي تحس إنه فاشل بس ودك تفتحه عناد؟',
  'لو صحيت ولقيت حسابك فيه 100 ألف بالغلط ترجعها؟',
  'وش الكلمة اللي إذا سمعتها من خويك تدري إنه بينكبك؟',
  'وش الحركة اللي دايم تسويها إذا تبي تطرد ضيوفك بأدب؟',
  'وش أكثر شي ضيعت فيه فلوسك هالشهر وندمان عليه؟',
  'لو معك فرصة تكفخ شخص واحد بالدوام بدون عقاب مين تختار؟',
  'وش السالفة اللي دايم تكررها بكل جلسة والشباب حفظوها؟'
];

const FAST_SHORT_FALLBACKS = [
  'علمي علمك',
  'سلك بس',
  'والله مدري',
  'ما ادري والله',
  'اصرفها وامش',
  'انحاش واقفل جوالي',
  'اسلك وامشي'
];

const CATEGORIZED_FALLBACKS: Record<string, string[]> = {
  food: ['شاورما هليل بدون ثوم', 'ماما نورة صراحة', 'بيك مسحب حراق', 'بخاري مع لبن'],
  car: ['باترول فتك بيج', 'لاندكروزر ديزل', 'كامري قراندي', 'هايلكس غمارتين'],
  place: ['الخبر على البحر', 'ابها بالصيف', 'الاستراحة مع الشباب', 'العلا يومين'],
  fear: ['اقفل الباب وانام', 'افجر الغرفة بف باف', 'انحاش واقفل الغرفة', 'اصارخ وانادي اخوي'],
  regret: ['ساعة تقليد خربت', 'اشتراك نادي مسحوب', 'شريت جهاز وما استخدمته', 'طلبت من موقع مقلب'],
  excuse: ['نمت وما حسيت', 'الوالد يبيني بمشوار', 'سيارتي بنشرت فجأة', 'جوالي كان صامت'],
  general: ['ما اذكر صراحة', 'يمكن قبل كم سنة', 'على حسب المود', 'والله يعتمد ع الوضع']
};

// 1. Post-processing: clean tashkeel, markdown, quotes, brackets, and trailing dots
export function sanitizeOutputText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[\u064B-\u065F\u0670]/g, '') // strip tashkeel
    .replace(/[*_~`#]/g, '')                // strip markdown
    .replace(/["'«»“”()[\]{}]/g, '')       // strip quotes and brackets
    .replace(/[.،؛!؟?~]+$/g, '')            // strip trailing punctuation
    .trim();
}

// 2. Truncate in code to 15 words max
export function truncateWords(text: string, maxWords: number = 5): string {
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length > maxWords) {
    return parts.slice(0, maxWords).join(' ');
  }
  return text;
}

// 3. Reject criteria
export function containsBannedPatterns(text: string): boolean {
  // Check AI admission or english letters
  if (/كنموذج|ذكاء\s*اصطناعي|روبوت|[a-zA-Z]/i.test(text)) {
    return true;
  }
  // Check heavy formal Arabic
  if (/بالتأكيد|بالطبع|يمكنني|حيث\s*أن|بلا\s*شك|مما\s*لا\s*شك/i.test(text)) {
    return true;
  }
  return false;
}

// Check high similarity with existing answers
function isTooSimilar(candidate: string, existingList: string[]): boolean {
  const normCand = candidate.trim().replace(/\s+/g, ' ');
  if (!normCand || normCand.length < 3) return false;

  return existingList.some((ex) => {
    const normEx = ex.trim().replace(/\s+/g, ' ');
    if (normCand === normEx) return true;
    if (normCand.length > 8 && normEx.includes(normCand)) return true;
    if (normEx.length > 8 && normCand.includes(normEx)) return true;
    return false;
  });
}

// 4. Low-probability mild typo (dropped hamza / dropped taa marbuta)
function applyMildColloquialTypo(text: string): string {
  if (Math.random() > 0.25) return text;
  if (/[أإآ]/.test(text) && Math.random() < 0.7) {
    return text.replace(/[أإآ]/, 'ا');
  }
  if (/ة\b/.test(text) && Math.random() < 0.5) {
    return text.replace(/ة\b/, 'ه');
  }
  return text;
}

// Pick contextual fallback based on question content
function getContextualFallback(questionText: string, index: number): string {
  const qText = (questionText || '').toLowerCase();
  let pool = CATEGORIZED_FALLBACKS.general;

  if (/أكل|مطعم|وجبة|شاورما|طعام|كبسة|برجر/.test(qText)) {
    pool = CATEGORIZED_FALLBACKS.food;
  } else if (/سيار|موتر|كامري|جيب|هايلكس|فتك/.test(qText)) {
    pool = CATEGORIZED_FALLBACKS.car;
  } else if (/صرصور|حشرة|فوبيا|خوف|تخاف|تسويه|ردة فعل/.test(qText)) {
    pool = CATEGORIZED_FALLBACKS.fear;
  } else if (/سفر|مكان|ديرة|دولة|وين|مدينة/.test(qText)) {
    pool = CATEGORIZED_FALLBACKS.place;
  } else if (/شريت|فلوس|مشروع|ندمت|دفعت|خسرت/.test(qText)) {
    pool = CATEGORIZED_FALLBACKS.regret;
  } else if (/عذر|تأخرت|سحبت|كذبة|تصريفة/.test(qText)) {
    pool = CATEGORIZED_FALLBACKS.excuse;
  }

  return pool[(index + Math.floor(Math.random() * pool.length)) % pool.length];
}

// Timeout wrapper for Supabase Edge Function calls (6s timeout)
async function invokeWithTimeout<T>(
  functionName: string,
  body: any,
  timeoutMs: number = 12000
): Promise<T | null> {
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });

  const apiPromise = supabase.functions
    .invoke(functionName, { body })
    .then(({ data, error }) => {
      if (error || !data) return null;
      return data as T;
    })
    .catch(() => null);

  return Promise.race([apiPromise, timeoutPromise]);
}

export async function generateAiQuestion(
  aiAvatarName: string,
  existingQuestions: string[]
): Promise<string> {
  try {
    const data = await invokeWithTimeout<{ question?: string }>(
      'who-is-ai',
      {
        action: 'generate_question',
        aiAvatarName,
        existingQuestions
      },
      5000
    );

    if (data?.question && typeof data.question === 'string') {
      const cleaned = truncateWords(sanitizeOutputText(data.question), 15);
      if (
        cleaned.length >= 6 &&
        !containsBannedPatterns(cleaned) &&
        !cleaned.startsWith('لو خيروك بين') &&
        !cleaned.startsWith('ما هو')
      ) {
        return applyMildColloquialTypo(cleaned);
      }
    }
  } catch (err) {
    console.warn('generateAiQuestion error:', err);
  }

  // Curated Fallback
  const unused = QUESTION_EXAMPLES.filter((q) => !existingQuestions.includes(q));
  const pool = unused.length > 0 ? unused : QUESTION_EXAMPLES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function generateAiAnswers(
  aiAvatarName: string,
  questions: RoomQuestion[],
  humanAnswers: RoomAnswer[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const styleProfile = profileGroupStyle(questions, humanAnswers);

  const humanAnswersTexts = humanAnswers
    .filter((a) => !a.isAi && a.text && a.text.trim().length > 0)
    .map((a) => a.text.trim());

  try {
    const questionsPayload = questions.map((q) => ({
      id: q.id,
      questionText: q.text,
      text: q.text,
      askerAvatarName: q.askerAvatarName
    }));

    const sampleHumanAnswers = humanAnswers
      .filter((a) => !a.isAi && a.text && a.text.trim().length > 0 && a.text !== '—')
      .map((a) => ({ questionId: a.questionId, text: a.text.trim() }));

    const data = await invokeWithTimeout<any>(
      'who-is-ai',
      {
        aiAvatar: aiAvatarName,
        aiAvatarName,
        questions: questionsPayload,
        sampleHumanAnswers,
        humanAnswers: humanAnswersTexts,
        styleProfile
      },
      6000
    );

    const generatedList: string[] = [];
    const answersMap: Record<string, string> = {};

    if (Array.isArray(data?.answers)) {
      data.answers.forEach((item: any) => {
        if (item && item.questionId) {
          answersMap[item.questionId] = item.answerText || item.text || '';
        }
      });
    } else if (data?.answers && typeof data.answers === 'object') {
      Object.assign(answersMap, data.answers);
    }

    questions.forEach((q) => {
      const rawAns = answersMap[q.id];
      if (typeof rawAns === 'string' && rawAns.trim().length > 0) {
        if (rawAns.trim() === '—') {
          result[q.id] = '—';
          return;
        }

        const cleaned = truncateWords(sanitizeOutputText(rawAns), 5);
        if (
          cleaned &&
          !containsBannedPatterns(cleaned) &&
          !isTooSimilar(cleaned, humanAnswersTexts) &&
          !isTooSimilar(cleaned, generatedList)
        ) {
          const finalAns = applyMildColloquialTypo(cleaned);
          result[q.id] = finalAns;
          generatedList.push(finalAns);
        }
      }
    });
  } catch (err) {
    console.warn('generateAiAnswers error, applying contextual fallbacks:', err);
  }

  // Determine random skip count (5-10% of questions skipped by AI, replaced with "—", max 2 per round)
  const totalQ = questions.length;
  const maxSkips = Math.min(2, Math.max(0, Math.floor(totalQ * 0.1)));
  const skipIndices = new Set<number>();

  if (maxSkips > 0 && Math.random() < 0.6) {
    const randIdx = Math.floor(Math.random() * totalQ);
    skipIndices.add(randIdx);
    if (maxSkips > 1 && totalQ > 5 && Math.random() < 0.3) {
      skipIndices.add((randIdx + 2) % totalQ);
    }
  }

  // Ensure every question has an answer or contextual fallback
  questions.forEach((q, idx) => {
    if (!result[q.id]) {
      if (skipIndices.has(idx)) {
        result[q.id] = '—';
      } else {
        result[q.id] = getContextualFallback(q.text, idx);
      }
    }
  });

  return result;
}
