import { supabase } from '../lib/supabase';
import {
  DraftContestant,
  SquadAIEvaluation,
  DraftVerdictResult,
  PlayerConditionVerification,
  DRAFT_SLOTS_ORDER,
  DraftPosition,
} from '../pages/football/draft-5/types';
import { DraftCondition } from '../data/draftConditions';
import { FootballPlayer, FOOTBALL_PLAYERS_MASTER } from '../data/footballMasterData';
import { normalizeArabicFootball } from './footballHistoryEngine';

/**
 * 3-Pillar AI Tactical Judge Engine
 *
 * Pillar 1: Condition Adherence (فحص استيفاء الشروط)
 * - Evaluates if each player genuinely meets the condition assigned to their slot.
 * - Explicit verdict: [✓ مطابق] or [✗ غير مطابق].
 * - Explicit failure reasons (e.g. "خطأ: ميسي لم يحقق شرط [لاعب أصلع]").
 *
 * Pillar 2: Positional Accuracy (فحص ملاءمة المركز)
 * - Checks whether the footballer actually played or is renowned in that slot:
 *   - GK: Must be a recognized goalkeeper.
 *   - DEF_1 / DEF_2: Center-back, full-back, or defensive wing-back.
 *   - MID: Central, attacking, or defensive midfielder.
 *   - FWD: Striker, winger, or center-forward.
 * - Sarcastic & tactical penalty for out-of-position selections!
 *
 * Pillar 3: Tactical Strength & Percentage Score (تقييم القوة العامة)
 * - Line-by-line rating: Goalkeeping, Defense, Midfield, Attack, Synergy (out of 100).
 * - Overall Strength Percentage (e.g. 88%).
 * - Winner Determination:
 *   Rule 1: Highest number of valid conditions and positions wins first.
 *   Rule 2 (Tie-break): Highest overall strength percentage wins.
 */
export async function evaluateDraftSquadsWithAI(
  contestants: DraftContestant[],
  usedConditions: DraftCondition[]
): Promise<DraftVerdictResult> {
  try {
    const payload = contestants.map((c) => {
      const picksArray = DRAFT_SLOTS_ORDER.map((pos) => {
        const player = c.picks[pos];
        const cond = c.pickConditions ? c.pickConditions[pos] : null;
        return {
          position: pos,
          playerName: player?.name || 'لم يحدد',
          conditionId: cond?.id || '',
          conditionTitle: cond?.title || 'شرط عام',
          conditionPrompt: cond?.rulePrompt || cond?.title || '',
        };
      });

      return {
        playerId: c.id,
        playerName: c.name,
        selectedClub: c.selectedClub,
        picks: picksArray,
      };
    });

    const response = await supabase.functions.invoke('ai-judge', {
      body: {
        mode: 'football_draft_3_pillar',
        contestants: payload,
      },
    });

    if (response.data?.evaluations && Array.isArray(response.data.evaluations)) {
      return buildVerdictResult(response.data.evaluations as SquadAIEvaluation[], contestants);
    }
  } catch (err) {
    console.warn('[AI Tactical Judge] Edge function unavailable, executing robust local engine:', err);
  }

  // Resilient Local Engine
  const evaluations = generateLocalThreePillarEvaluations(contestants);
  return buildVerdictResult(evaluations, contestants);
}

/**
 * Determine a player's natural position from master data or name lookup
 */
export function getPlayerNaturalPosition(player: FootballPlayer | { name: string; position?: string }): 'GK' | 'DEF' | 'MID' | 'FWD' {
  if (player.position && ['GK', 'DEF', 'MID', 'FWD'].includes(player.position)) {
    return player.position as 'GK' | 'DEF' | 'MID' | 'FWD';
  }

  const cleanName = normalizeArabicFootball(player.name);
  const found = FOOTBALL_PLAYERS_MASTER.find(
    (p) => normalizeArabicFootball(p.name) === cleanName || (p.aliases && p.aliases.some((a) => normalizeArabicFootball(a) === cleanName))
  );

  if (found && found.position) {
    return found.position;
  }

  // Heuristic fallbacks for well-known goalkeepers and defenders
  if (/بوفون|كاسياس|نوير|كورتوا|أليسون|إيدرسون|دي خيا|بونو|العويس|المعيوف|تير شتيغن|دوناروما|نافاس|بارتيز|تشيك|لوريس|خان/.test(player.name)) {
    return 'GK';
  }
  if (/مالديني|راموس|فان دايك|بويول|كانافارو|بيكي|سيلفا|كوليبالي|مارسيلو|ألفيس|أرنولد|روبرتسون|دياز|البليهي|هوساوي|حجازي|والكر|حكيمي/.test(player.name)) {
    return 'DEF';
  }
  if (/زيدان|مودريتش|تشافي|إنييستا|كروس|دي بروين|كانتي|كاسيميرو|بوسكيتس|بيرلو|جيرارد|لامبارد|سافيتش|نيفيز|سالم|عطيف|بيغبا|رودري/.test(player.name)) {
    return 'MID';
  }

  return 'FWD';
}

/**
 * Format position names in Arabic
 */
const POSITION_ARABIC_NAMES: Record<string, string> = {
  GK: 'حارس مرمى',
  DEF: 'مدافع',
  DEF_1: 'مدافع أول',
  DEF_2: 'مدافع ثانٍ',
  MID: 'خط وسط',
  FWD: 'مهاجم',
};

/**
 * Pillar 2: Positional Accuracy Check
 */
function verifyPlayerPosition(
  player: FootballPlayer,
  slot: DraftPosition
): { isPositionValid: boolean; positionReason: string; naturalPosition: string } {
  const naturalPos = getPlayerNaturalPosition(player);
  const naturalName = POSITION_ARABIC_NAMES[naturalPos] || naturalPos;
  const slotName = POSITION_ARABIC_NAMES[slot] || slot;

  let isPositionValid = false;
  let positionReason = '';

  if (slot === 'GK') {
    isPositionValid = naturalPos === 'GK';
    positionReason = isPositionValid
      ? `مركز سليم: ${player.name} حارس مرمى خبير ويعتمد عليه.`
      : `كارثة تكتيكية: وضع ${player.name} في حراسة المرمى سيكلف الفريق كوارث، فهو لاعب ${naturalName}!`;
  } else if (slot === 'DEF_1' || slot === 'DEF_2') {
    isPositionValid = naturalPos === 'DEF';
    positionReason = isPositionValid
      ? `مركز سليم: ${player.name} صخرة دفاعية في مكانه الطبيعي.`
      : `ثغرة دفاعية فادحة: إشراك ${player.name} في الخط الخلفي مجازفة انتحارية، مركزه الحقيقي ${naturalName}!`;
  } else if (slot === 'MID') {
    isPositionValid = naturalPos === 'MID';
    positionReason = isPositionValid
      ? `مركز سليم: ${player.name} مايسترو خط الوسط وقائد الإيقاع.`
      : `خلل في التوزيع: وضع ${player.name} في خط الوسط يفقده بريقه، فهو في الأصل ${naturalName}!`;
  } else if (slot === 'FWD') {
    isPositionValid = naturalPos === 'FWD';
    positionReason = isPositionValid
      ? `مركز سليم: ${player.name} هداف فتاك ومرعب لحراس الخصم.`
      : `عقم هجومي: وضع ${player.name} كرأس حربة قرار غير مفهوم لأنه لاعب ${naturalName}!`;
  }

  return { isPositionValid, positionReason, naturalPosition: naturalName };
}

/**
 * Robust Local 3-Pillar Evaluation Engine
 */
function generateLocalThreePillarEvaluations(
  contestants: DraftContestant[]
): SquadAIEvaluation[] {
  return contestants.map((c) => {
    const verifications: PlayerConditionVerification[] = [];
    let validCondCount = 0;
    let validPosCount = 0;

    DRAFT_SLOTS_ORDER.forEach((pos) => {
      const player = c.picks[pos];
      const cond = c.pickConditions ? c.pickConditions[pos] : null;

      if (!player) {
        verifications.push({
          position: pos,
          playerName: 'فارغ',
          playerPhoto: '',
          conditionTitle: cond?.title || 'شرط الجولة',
          isValid: false,
          reason: 'لم يتم اختيار أي لاعب في هذا المركز!',
          isPositionValid: false,
          positionReason: 'المركز فارغ تماماً!',
          naturalPosition: '-',
        });
        return;
      }

      // Pillar 1: Condition Adherence
      const condCheck = verifyPlayerConditionLocal(player, cond);
      if (condCheck.isValid) validCondCount++;

      // Pillar 2: Positional Accuracy
      const posCheck = verifyPlayerPosition(player, pos);
      if (posCheck.isPositionValid) validPosCount++;

      verifications.push({
        position: pos,
        playerName: player.name,
        playerPhoto: player.photo || '',
        conditionTitle: cond?.title || 'بدون شرط',
        isValid: condCheck.isValid,
        reason: condCheck.reason,
        isPositionValid: posCheck.isPositionValid,
        positionReason: posCheck.positionReason,
        naturalPosition: posCheck.naturalPosition,
      });
    });

    // Pillar 3: Tactical Strength & Percentage Score
    const gk = c.picks.GK;
    const def1 = c.picks.DEF_1;
    const def2 = c.picks.DEF_2;
    const mid = c.picks.MID;
    const fwd = c.picks.FWD;

    const gkPosValid = gk ? verifyPlayerPosition(gk, 'GK').isPositionValid : false;
    const def1PosValid = def1 ? verifyPlayerPosition(def1, 'DEF_1').isPositionValid : false;
    const def2PosValid = def2 ? verifyPlayerPosition(def2, 'DEF_2').isPositionValid : false;
    const midPosValid = mid ? verifyPlayerPosition(mid, 'MID').isPositionValid : false;
    const fwdPosValid = fwd ? verifyPlayerPosition(fwd, 'FWD').isPositionValid : false;

    // Goalkeeping rating (80-99 if valid GK, 15-35 if wrong position or empty)
    let gkScore = gk ? (gkPosValid ? Math.floor(82 + Math.random() * 16) : 25) : 10;
    
    // Defense rating
    let defBase = (def1 ? (def1PosValid ? 42 : 15) : 5) + (def2 ? (def2PosValid ? 42 : 15) : 5);
    let defScore = Math.min(99, Math.max(15, defBase + Math.floor(Math.random() * 12)));

    // Midfield rating
    let midScore = mid ? (midPosValid ? Math.floor(82 + Math.random() * 16) : 30) : 10;

    // Forward rating
    let fwdScore = fwd ? (fwdPosValid ? Math.floor(84 + Math.random() * 15) : 30) : 10;

    // Synergy: Reward matching clubs or valid positions
    let synergyScore = 50 + validPosCount * 8 + (validCondCount >= 4 ? 10 : 0);
    synergyScore = Math.min(99, Math.max(30, synergyScore));

    // Boost for trophies & pedigree
    if (gk?.trophies?.length && gkPosValid) gkScore = Math.min(99, gkScore + 4);
    if ((def1?.trophies?.length || def2?.trophies?.length) && (def1PosValid || def2PosValid)) defScore = Math.min(99, defScore + 4);
    if (mid?.trophies?.length && midPosValid) midScore = Math.min(99, midScore + 4);
    if (fwd?.trophies?.length && fwdPosValid) fwdScore = Math.min(99, fwdScore + 4);

    const overallPercentage = Math.round(
      gkScore * 0.18 + defScore * 0.26 + midScore * 0.26 + fwdScore * 0.22 + synergyScore * 0.08
    );

    const critiqueTitles = [
      'توليفة أسطورية بتناغم استثنائي بين الخطوط',
      'هجوم كاسح ووسط ممتع مع بعض التحفظ الدفاعي',
      'منظومة صلبة بروح إيطالية لا تخترق',
      'فريق استعراضي مليء بالسحر والمهارة الفردية',
      'تكتيك عصري بضغط عالٍ وسرعات خارقة في المرتدات',
      'قوة بدنية جبارة وهيمنة على الكرات الهوائية',
      'فريق مليء بالثغرات بسبب توظيف عشوائي للمراكز'
    ];
    const critiqueTitle = validPosCount <= 2
      ? 'فريق يعاني من تخبط تكتيكي وتوظيف خاطئ للمراكز'
      : critiqueTitles[Math.floor(Math.random() * (critiqueTitles.length - 1))];

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (fwd && fwdPosValid) strengths.push(`حسم مرعب أمام المرمى بفضل ${fwd.name}`);
    if (mid && midPosValid) strengths.push(`تحكم وإيقاع سلس في خط الوسط بقيادة ${mid.name}`);
    if ((def1 || def2) && (def1PosValid || def2PosValid)) {
      strengths.push(`صلابة دفاعية بتواجد ${[def1?.name, def2?.name].filter(Boolean).join(' و')}`);
    }
    if (gk && gkPosValid) strengths.push(`أمان مطلق وردات فعل حاسمة مع الحارس ${gk.name}`);

    if (!gk || !gkPosValid) weaknesses.push(gk ? `كارثة الحراسة: ${gk.name} ليس حارساً مرمى وسيتلقى أهدافاً سهلة` : 'غياب الحارس الأساسي تماماً');
    if (!def1PosValid || !def2PosValid) weaknesses.push('ثغرات في العمق الدفاعي بسبب أخطاء تمركز أو غياب المدافعين الصريحين');
    if (!midPosValid) weaknesses.push('صعوبة في الربط بين الخطوط بسبب مركز الوسط غير السليم');
    if (!fwdPosValid) weaknesses.push('غياب المهاجم الهداف يعطل الفاعلية الهجومية');
    if (weaknesses.length === 0) weaknesses.push('اندفاع هجومي مبالغ فيه قد يترك مساحات في المرتدات');

    const tacticalSummary = `تشكيلة ${c.name} حققت ${validCondCount}/5 من شروط الجولة و ${validPosCount}/5 من المراكز السليمة. القوة التكتيكية الإجمالية وصلت إلى ${overallPercentage}%.`;

    return {
      playerId: c.id,
      playerName: c.name,
      selectedClub: c.selectedClub,
      validConditionsCount: validCondCount,
      validPositionsCount: validPosCount,
      totalValidCount: validCondCount + validPosCount,
      conditionVerifications: verifications,
      ratings: {
        gk: gkScore,
        defense: defScore,
        midfield: midScore,
        attack: fwdScore,
        synergy: synergyScore,
      },
      overallPercentage,
      critiqueTitle,
      detailedBreakdown: {
        strengths: strengths.slice(0, 3),
        weaknesses: weaknesses.slice(0, 2),
        tacticalSummary,
      },
    };
  });
}

/**
 * Local condition verifier with EXPLICIT failure explanations
 */
function verifyPlayerConditionLocal(
  player: FootballPlayer,
  condition: DraftCondition | null
): { isValid: boolean; reason: string } {
  if (!condition) {
    return {
      isValid: true,
      reason: 'تم قبول الاختيار بنجاح (بدون شرط محدد).',
    };
  }

  const pName = player.name.toLowerCase();
  const cId = condition.id;
  const traits = (player.traits || []).join(' ').toLowerCase();
  const trophies = (player.trophies || []).join(' ').toLowerCase();
  const clubs = (player.clubs || []).join(' ').toLowerCase();

  let isValid = true;
  let reason = `${player.name} حقق شرط: [${condition.title}] بنجاح`;

  switch (cId) {
    case 'c_bald':
      isValid = /زيدان|روبين|كانتي|كومباني|ستام|بارتيز|هنري|بيبي|سكيرتل|كولاردوف|شيلفي/.test(pName) || traits.includes('أصلع');
      reason = isValid ? `${player.name} أصلع بالكامل أو حليق الرأس` : `خطأ: ${player.name} لم يحقق شرط [لاعب أصلع]`;
      break;

    case 'c_afro':
      isValid = /فيلاني|كوكوريلا|ساني|مارسيلو|لويز|فلاح|غوندوزي|ويليان|فالديراما|كولوتشيني/.test(pName) || traits.includes('كدش') || traits.includes('أفروا');
      reason = isValid ? `${player.name} يمتلك شعر كدش / أفروا كثيف` : `خطأ: ${player.name} لم يحقق شرط [شعر كدش أو أفروا]`;
      break;

    case 'c_long_hair':
      isValid = /مودريتش|إبراهيموفيتش|كافاني|بويول|كانيجيا|باتيستوتا|راموس|بيرلو|نيدفيد|غريزمان|هالاند/.test(pName) || traits.includes('طويل');
      reason = isValid ? `${player.name} معروف بشعره الطويل المربوط أو المسدول` : `خطأ: ${player.name} شعره قصير ولم يحقق شرط [شعر طويل]`;
      break;

    case 'c_beard':
      isValid = /صلاح|بنزيما|ميسي|جيرو|أليسون|بيكيه|توران|دي روسي|راموس|كافاني/.test(pName) || traits.includes('لحية');
      reason = isValid ? `${player.name} يمتلك لحية واضحة وكثيفة` : `خطأ: ${player.name} حليق اللحية ولم يحقق شرط [يمتلك لحية]`;
      break;

    case 'c_dark_skin':
      isValid = /كانتي|فينيسيوس|مبابي|كوليبالي|بوغبا|توريه|ماني|ديمبيلي|سيسوكو|ساني|كامافينغا/.test(pName) || traits.includes('أسمر');
      reason = isValid ? `${player.name} من ذوي البشرة السمراء` : `خطأ: ${player.name} لا تنطبق عليه سمات [بشرة سمراء]`;
      break;

    case 'c_handsome':
      isValid = /بيكهام|جيرو|مالديني|كاكا|رونالدو|كانافارو|غريزمان|موراتا|توريس/.test(pName) || traits.includes('وسيم');
      reason = isValid ? `${player.name} مشهور بوسامته وجاذبيته الإعلامية` : `خطأ: ${player.name} لم يصنف ضمن [وسماء الملاعب]`;
      break;

    case 'c_no_tattoos':
      isValid = /رونالدو|صلاح|ماني|كانتي|كاسيميرو|بوسكيتس|إنييستا|تشافي/.test(pName) || traits.includes('بدون وشم');
      reason = isValid ? `${player.name} معروف بعدم رسم أي وشم على جسده` : `خطأ: ${player.name} يمتلك وشوماً على جسده`;
      break;

    case 'c_tall_giant':
      isValid = /هالاند|كورتوا|فان دايك|إبراهيموفيتش|بيكيه|بونو|نوير|دوناروما|ماتيغ/.test(pName) || traits.includes('طويل') || traits.includes('عملاق');
      reason = isValid ? `${player.name} طوله يتجاوز 190 سم` : `خطأ: ${player.name} طوله أقل من 190 سم ولم يحقق شرط [العملاق]`;
      break;

    case 'c_short_speed':
      isValid = /ميسي|كانتي|إنسيني|فيراتي|مارادونا|كازورلا|جيوفينكو|مودريتش/.test(pName) || traits.includes('قصير');
      reason = isValid ? `${player.name} طوله أقل من 172 سم` : `خطأ: ${player.name} طوله يزيد عن 172 سم ولم يحقق شرط [قصير القامة]`;
      break;

    case 'c_lefty':
      isValid = /ميسي|روبين|ديماريا|محرز|صلاح|مالديني|مارادونا|بيل|سيلفا|خاميس|كاسياس/.test(pName) || traits.includes('أعسر') || traits.includes('أشول');
      reason = isValid ? `${player.name} يعتمد كلياً على قدمه اليسرى` : `خطأ: ${player.name} يلعب بقدمه اليمنى وليس أشول`;
      break;

    case 'c_captain':
      isValid = /راموس|ميسي|رونالدو|مالديني|جيرارد|توتي|بوفون|نوير|بويول|كومباني|كين/.test(pName) || traits.includes('قائد') || traits.includes('كابتن');
      reason = isValid ? `${player.name} ارتدى شارة القيادة لفريقه أو منتخبه` : `خطأ: ${player.name} لم يحمل شارة القيادة بصفة مستمرة`;
      break;

    case 'c_shirt_10':
      isValid = /ميسي|بيليه|مارادونا|زيدان|مودريتش|توتي|نيمار|رونالدينيو|هازارد|مبابي|أوزيل/.test(pName) || traits.includes('10');
      reason = isValid ? `${player.name} ارتدى القميص رقم 10 الأسطوري` : `خطأ: ${player.name} لم يشتهر بارتداء الرقم 10`;
      break;

    case 'c_shirt_7':
      isValid = /رونالدو|بيكهام|كانتونا|راؤول|سون|ريبيري|فيغو|غريزمان|مبابي|كانيدو/.test(pName) || traits.includes('7');
      reason = isValid ? `${player.name} ارتدى القميص رقم 7 في مسيرته` : `خطأ: ${player.name} لم يشتهر بارتداء الرقم 7`;
      break;

    case 'c_muslim':
      isValid = /بنزيما|صلاح|كانتي|ماني|زيدان|أوزيل|بوغبا|حكيمي|محرز|ريبيري|توريه|ديمبيلي/.test(pName) || traits.includes('مسلم');
      reason = isValid ? `${player.name} مسلم الديانة رسمياً` : `خطأ: ${player.name} ديانته ليست مسلمة`;
      break;

    case 'c_roshn':
      isValid = clubs.includes('هلال') || clubs.includes('نصر') || clubs.includes('اتحاد') || clubs.includes('أهلي') || clubs.includes('شباب') || clubs.includes('اتفاق') || clubs.includes('قادسية') || /رونالدو|بنزيما|نيمار|كانتي|سالم|البليهي|بونو|محرز|فيرمينو|سافيتش|نيفيز|ميتروفيتش/.test(pName);
      reason = isValid ? `${player.name} مثل أحد أندية دوري روشن السعودي` : `خطأ: ${player.name} لم يسبق له اللعب في الدوري السعودي للمحترفين`;
      break;

    case 'c_world_cup_winner':
      isValid = trophies.includes('كأس العالم') || /ميسي|مبابي|كانتي|بوفون|إنييستا|زيدان|رونالدو|ريفالدو|تشافي|راموس|نوير|كروس|فاران|لوريس/.test(pName);
      reason = isValid ? `${player.name} توج ببطولة كأس العالم` : `خطأ: ${player.name} لم يتوج بلقب كأس العالم مع منتخب بلاده`;
      break;

    default:
      isValid = true;
      reason = `${player.name} مطابق لشرط: [${condition.title}]`;
  }

  return { isValid, reason };
}

/**
 * Grand Final Scoring & Winner Determination
 * Rule 1: Highest number of valid conditions and positions wins first.
 * Rule 2 (Tie-break): Highest overall strength percentage wins.
 */
function buildVerdictResult(
  evaluations: SquadAIEvaluation[],
  contestants: DraftContestant[]
): DraftVerdictResult {
  if (evaluations.length === 0) {
    return {
      evaluations: [],
      winnerId: '',
      winnerName: '',
      isTie: false,
      tiedContestantIds: [],
      maxConditionsMet: 0,
      verdictBanner: 'لا يوجد متسابقون لتقييمهم',
    };
  }

  // Attach selectedClub if missing in evaluation
  evaluations.forEach((ev) => {
    if (!ev.selectedClub) {
      const match = contestants.find((c) => c.id === ev.playerId);
      if (match?.selectedClub) ev.selectedClub = match.selectedClub;
    }
    // Calculate total valid points (conditions + positions)
    if (ev.totalValidCount === undefined) {
      ev.totalValidCount = (ev.validConditionsCount || 0) + (ev.validPositionsCount || 0);
    }
  });

  // Sort by Rule 1 (highest valid conditions & positions) then Rule 2 (highest overall strength %)
  const sorted = [...evaluations].sort((a, b) => {
    const totalA = a.totalValidCount ?? (a.validConditionsCount + a.validPositionsCount);
    const totalB = b.totalValidCount ?? (b.validConditionsCount + b.validPositionsCount);
    if (totalB !== totalA) {
      return totalB - totalA;
    }
    // If tied on total valid count, sort by condition count first
    if (b.validConditionsCount !== a.validConditionsCount) {
      return b.validConditionsCount - a.validConditionsCount;
    }
    // Rule 2 Tie-breaker: Highest overall percentage
    return b.overallPercentage - a.overallPercentage;
  });

  const winner = sorted[0];
  const maxConditionsMet = winner.validConditionsCount;

  // Check if there was a tie on valid counts with runner up
  const runnerUp = sorted[1];
  const totalWinnerValid = winner.totalValidCount ?? (winner.validConditionsCount + winner.validPositionsCount);
  const totalRunnerValid = runnerUp ? (runnerUp.totalValidCount ?? (runnerUp.validConditionsCount + runnerUp.validPositionsCount)) : -1;

  const isTie = runnerUp && totalWinnerValid === totalRunnerValid;
  const tiedIds = sorted
    .filter((e) => (e.totalValidCount ?? (e.validConditionsCount + e.validPositionsCount)) === totalWinnerValid)
    .map((e) => e.playerId);

  const verdictBanner = `🏆 بطل الجولة: ${winner.playerName} بنسبة قوة [${winner.overallPercentage}%] و [${winner.validConditionsCount}/5] شروط متطابقة!`;

  const tieBreakAnalysis = isTie
    ? `تعادل في استيفاء الشروط والمراكز (${totalWinnerValid}/10)! حسمت اللائحة التكتيكية الفوز لصالح ${winner.playerName} بنسبة قوة إجمالية بلغت ${winner.overallPercentage}% مقابل ${runnerUp.overallPercentage}% لـ ${runnerUp.playerName} بفضل التناغم الهجومي والتوازن الدفاعي!`
    : undefined;

  return {
    evaluations: sorted,
    winnerId: winner.playerId,
    winnerName: winner.playerName,
    winnerClub: winner.selectedClub,
    isTie: Boolean(isTie),
    tiedContestantIds: isTie ? tiedIds : [],
    maxConditionsMet,
    verdictBanner,
    tieBreakAnalysis,
  };
}
