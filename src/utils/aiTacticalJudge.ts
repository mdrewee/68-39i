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
import { FootballPlayer } from '../data/footballMasterData';

/**
 * Two-Tier AI Verification & Tie-Breaking Engine
 *
 * Step 1: Condition Verification (فحص الشروط والعد التراكمي مع تفصيل صريح للخطأ)
 * - Verifies whether each player fulfills the assigned round condition.
 * - Explains specifically why a player failed (e.g. "محمد صلاح لم يحقق شرط لاعب أصلع").
 * - Counts validConditionsCount (0 to 5) for each contestant.
 *
 * Step 2: Determination Rule (قاعدة الفوز والتفضيل الصارمة)
 * - If one contestant has higher valid conditions than everyone else, they win directly!
 * - If multiple contestants are TIED on the highest condition count:
 *   Trigger head-to-head tactical breakdown:
 *   Compare GK, Defense (DEF_1 + DEF_2), Midfield (MID), Attack (FWD).
 *   Calculate overall percentage (0% - 100%).
 *   Pundit banter highlights superior lines, and the highest percentage wins!
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
        mode: 'football_draft_v2',
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
  const evaluations = generateLocalTwoTierEvaluations(contestants);
  return buildVerdictResult(evaluations, contestants);
}

/**
 * Robust Local Evaluation Engine
 */
function generateLocalTwoTierEvaluations(
  contestants: DraftContestant[]
): SquadAIEvaluation[] {
  return contestants.map((c) => {
    const verifications: PlayerConditionVerification[] = [];
    let validCount = 0;

    DRAFT_SLOTS_ORDER.forEach((pos) => {
      const player = c.picks[pos];
      const cond = c.pickConditions ? c.pickConditions[pos] : null;

      if (!player) {
        verifications.push({
          position: pos,
          playerName: 'فارغ',
          conditionTitle: cond?.title || 'شرط الجولة',
          isValid: false,
          reason: 'لم يتم اختيار أي لاعب في هذا المركز!',
        });
        return;
      }

      // Check player against condition with explicit error breakdown
      const checkResult = verifyPlayerConditionLocal(player, cond);
      verifications.push(checkResult);
      if (checkResult.isValid) validCount++;
    });

    // Tactical Line Ratings
    const gk = c.picks.GK;
    const def1 = c.picks.DEF_1;
    const def2 = c.picks.DEF_2;
    const mid = c.picks.MID;
    const fwd = c.picks.FWD;

    let gkScore = gk ? Math.floor(78 + Math.random() * 18) : 35;
    let defScore = def1 && def2 ? Math.floor(80 + Math.random() * 16) : (def1 || def2 ? 55 : 30);
    let midScore = mid ? Math.floor(80 + Math.random() * 16) : 35;
    let fwdScore = fwd ? Math.floor(82 + Math.random() * 16) : 35;
    let synergyScore = Math.floor(70 + Math.random() * 25);

    // Boost for trophies & real-world pedigree
    if (gk?.trophies?.length) gkScore = Math.min(99, gkScore + 5);
    if (def1?.trophies?.length || def2?.trophies?.length) defScore = Math.min(99, defScore + 4);
    if (mid?.trophies?.length) midScore = Math.min(99, midScore + 5);
    if (fwd?.trophies?.length) fwdScore = Math.min(99, fwdScore + 5);

    const overallPercentage = Math.round(
      gkScore * 0.15 + defScore * 0.25 + midScore * 0.25 + fwdScore * 0.25 + synergyScore * 0.1
    );

    const critiqueTitles = [
      'توليفة أسطورية بتناغم استثنائي بين الخطوط',
      'هجوم كاسح ووسط ممتع مع بعض التحفظ الدفاعي',
      'منظومة صلبة بروح إيطالية لا تخترق',
      'فريق استعراضي مليء بالسحر والمهارة الفردية',
      'تكتيك عصري بضغط عالٍ وسرعات خارقة في المرتدات',
      'قوة بدنية جبارة وهيمنة على الكرات الهوائية'
    ];
    const critiqueTitle = critiqueTitles[Math.floor(Math.random() * critiqueTitles.length)];

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (fwd) strengths.push(`حسم مرعب أمام المرمى بفضل ${fwd.name}`);
    if (mid) strengths.push(`تحكم وإيقاع سلس في خط الوسط بقيادة ${mid.name}`);
    if (def1 || def2) strengths.push(`تغطية دفاعية قوية مع ${[def1?.name, def2?.name].filter(Boolean).join(' و')}`);
    if (gk) strengths.push(`جدار أمان وردات فعل حاسمة مع ${gk.name}`);

    if (!gk) weaknesses.push('غياب الحارس الأساسي يكلف الفريق أهدافاً سهلة');
    if (!def1 || !def2) weaknesses.push('نقص في عمق الدفاع قد يسبب ارتباكاً في العرضيات');
    if (!mid) weaknesses.push('صعوبة في الخروج بالكرة والربط بين الدفاع والهجوم');
    if (!fwd) weaknesses.push('عقم هجومي واضح بغياب المهاجم الصريح');
    if (weaknesses.length === 0) weaknesses.push('اندفاع هجومي قد يترك مساحات في الهجمات المرتدة');

    const tacticalSummary = `تشكيلة ${c.name} (${c.selectedClub?.name || 'فريق الأحلام'}) حققت ${validCount}/5 من الشروط الرسمية. الخطوط مترابطة والتوازن التكتيكي واضح، والاعتماد الأكبر على قوة ${fwd?.name || mid?.name || 'المنظومة الجماعية'}.`;

    return {
      playerId: c.id,
      playerName: c.name,
      selectedClub: c.selectedClub,
      validConditionsCount: validCount,
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
): PlayerConditionVerification {
  if (!condition) {
    return {
      position: (player.position || 'FWD') as DraftPosition,
      playerName: player.name,
      conditionTitle: 'بدون شرط',
      isValid: true,
      reason: 'تم قبول الاختيار بنجاح.',
    };
  }

  const pName = player.name.toLowerCase();
  const cId = condition.id;
  const traits = (player.traits || []).join(' ').toLowerCase();
  const trophies = (player.trophies || []).join(' ').toLowerCase();
  const clubs = (player.clubs || []).join(' ').toLowerCase();

  let isValid = true;
  let reason = `${player.name} حقق شرط: ${condition.title}`;

  switch (cId) {
    case 'c_bald':
      isValid = /زيدان|روبين|كانتي|كومباني|ستام|بارتيز|هنري|بيبي|سكيرتل|كولاردوف|شيلفي/.test(pName) || traits.includes('أصلع');
      reason = isValid ? `${player.name} أصلع بالكامل أو حليق الرأس` : `${player.name} لم يحقق شرط لاعب أصلع (يمتلك شعراً كافياً)`;
      break;

    case 'c_afro':
      isValid = /فيلاني|كوكوريلا|ساني|مارسيلو|لويز|فلاح|غوندوزي|ويليان|فالديراما|كولوتشيني/.test(pName) || traits.includes('كدش') || traits.includes('أفروا');
      reason = isValid ? `${player.name} يمتلك شعر كدش / أفروا كثيف` : `${player.name} لم يحقق شرط الكدش أو الأفروا`;
      break;

    case 'c_long_hair':
      isValid = /مودريتش|إبراهيموفيتش|كافاني|بويول|كانيجيا|باتيستوتا|راموس|بيرلو|نيدفيد|غريزمان|هالاند/.test(pName) || traits.includes('طويل');
      reason = isValid ? `${player.name} معروف بشعره الطويل المربوط أو المسدول` : `${player.name} شعره قصير ولم يحقق شرط الشعر الطويل`;
      break;

    case 'c_beard':
      isValid = /صلاح|بنزيما|ميسي|جيرو|أليسون|بيكيه|توران|دي روسي|راموس|كافاني/.test(pName) || traits.includes('لحية');
      reason = isValid ? `${player.name} يمتلك لحية واضحة وكثيفة` : `${player.name} حليق اللحية ولم يحقق الشرط`;
      break;

    case 'c_dark_skin':
      isValid = /كانتي|فينيسيوس|مبابي|كوليبالي|بوغبا|توريه|ماني|ديمبيلي|سيسوكو|ساني|كامافينغا/.test(pName) || traits.includes('أسمر');
      reason = isValid ? `${player.name} من ذوي البشرة السمراء` : `${player.name} لا تنطبق عليه سمات البشرة المطلوبة`;
      break;

    case 'c_handsome':
      isValid = /بيكهام|جيرو|مالديني|كاكا|رونالدو|كانافارو|غريزمان|موراتا|توريس/.test(pName) || traits.includes('وسيم');
      reason = isValid ? `${player.name} مشهور بوسامته وجاذبيته الإعلامية` : `${player.name} لم يصنف ضمن وسماء الملاعب الرياضية`;
      break;

    case 'c_no_tattoos':
      isValid = /رونالدو|صلاح|ماني|كانتي|كاسيميرو|بوسكيتس|إنييستا|تشافي/.test(pName) || traits.includes('بدون وشم');
      reason = isValid ? `${player.name} معروف بعدم رسم أي وشم على جسده` : `${player.name} يمتلك وشوماً على جسده`;
      break;

    case 'c_tall_giant':
      isValid = /هالاند|كورتوا|فان دايك|إبراهيموفيتش|بيكيه|بونو|نوير|دوناروما|ماتيغ/.test(pName) || traits.includes('طويل') || traits.includes('عملاق');
      reason = isValid ? `${player.name} طوله يتجاوز 190 سم` : `${player.name} طوله أقل من 190 سم ولم يحقق شرط الطول`;
      break;

    case 'c_short_speed':
      isValid = /ميسي|كانتي|إنسيني|فيراتي|مارادونا|كازورلا|جيوفينكو|مودريتش/.test(pName) || traits.includes('قصير');
      reason = isValid ? `${player.name} طوله أقل من 172 سم` : `${player.name} طوله يزيد عن 172 سم`;
      break;

    case 'c_lefty':
      isValid = /ميسي|روبين|ديماريا|محرز|صلاح|مالديني|مارادونا|بيل|سيلفا|خاميس|كاسياس/.test(pName) || traits.includes('أعسر') || traits.includes('أشول');
      reason = isValid ? `${player.name} يعتمد كلياً على قدمه اليسرى` : `${player.name} يلعب بقدمه اليمنى وليس أشول`;
      break;

    case 'c_captain':
      isValid = /راموس|ميسي|رونالدو|مالديني|جيرارد|توتي|بوفون|نوير|بويول|كومباني|كين/.test(pName) || traits.includes('قائد') || traits.includes('كابتن');
      reason = isValid ? `${player.name} ارتدى شارة القيادة لفريقه أو منتخبه` : `${player.name} لم يحمل شارة القيادة بصفة مستمرة`;
      break;

    case 'c_shirt_10':
      isValid = /ميسي|بيليه|مارادونا|زيدان|مودريتش|توتي|نيمار|رونالدينيو|هازارد|مبابي|أوزيل/.test(pName) || traits.includes('10');
      reason = isValid ? `${player.name} ارتدى القميص رقم 10 الأسطوري` : `${player.name} لم يشتهر بارتداء الرقم 10`;
      break;

    case 'c_shirt_7':
      isValid = /رونالدو|بيكهام|كانتونا|راؤول|سون|ريبيري|فيغو|غريزمان|مبابي|كانيدو/.test(pName) || traits.includes('7');
      reason = isValid ? `${player.name} ارتدى القميص رقم 7 في مسيرته` : `${player.name} لم يشتهر بارتداء الرقم 7`;
      break;

    case 'c_muslim':
      isValid = /بنزيما|صلاح|كانتي|ماني|زيدان|أوزيل|بوغبا|حكيمي|محرز|ريبيري|توريه|ديمبيلي/.test(pName) || traits.includes('مسلم');
      reason = isValid ? `${player.name} مسلم الديانة رسمياً` : `${player.name} ديانته ليست مسلمة`;
      break;

    case 'c_roshn':
      isValid = clubs.includes('هلال') || clubs.includes('نصر') || clubs.includes('اتحاد') || clubs.includes('أهلي') || clubs.includes('شباب') || clubs.includes('اتفاق') || clubs.includes('قادسية') || /رونالدو|بنزيما|نيمار|كانتي|سالم|البليهي|بونو|محرز|فيرمينو|سافيتش|نيفيز|ميتروفيتش/.test(pName);
      reason = isValid ? `${player.name} مثل أحد أندية دوري روشن السعودي` : `${player.name} لم يسبق له اللعب في الدوري السعودي للمحترفين`;
      break;

    case 'c_world_cup_winner':
      isValid = trophies.includes('كأس العالم') || /ميسي|مبابي|كانتي|بوفون|إنييستا|زيدان|رونالدو|ريفالدو|تشافي|راموس|نوير|كروس|فاران|لوريس/.test(pName);
      reason = isValid ? `${player.name} توج ببطولة كأس العالم` : `${player.name} لم يتوج بلقب كأس العالم مع منتخب بلاده`;
      break;

    default:
      isValid = true;
      reason = `${player.name} مطابق لشرط: ${condition.title}`;
  }

  return {
    position: (player.position || 'FWD') as DraftPosition,
    playerName: player.name,
    conditionTitle: condition.title,
    isValid,
    reason,
  };
}

/**
 * Step 2: Determination Rule (قاعدة الفوز والتفضيل الصارمة)
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
  });

  // 1. Find maximum conditions fulfilled
  const maxConditionsMet = Math.max(...evaluations.map((e) => e.validConditionsCount));

  // 2. Filter contestants who achieved max conditions
  const topConditionPlayers = evaluations.filter((e) => e.validConditionsCount === maxConditionsMet);

  // Immediate Winner by Condition Count:
  if (topConditionPlayers.length === 1) {
    const winner = topConditionPlayers[0];
    return {
      evaluations,
      winnerId: winner.playerId,
      winnerName: winner.playerName,
      winnerClub: winner.selectedClub,
      isTie: false,
      tiedContestantIds: [],
      maxConditionsMet,
      verdictBanner: `${winner.playerName} حقق [${winner.validConditionsCount}/5] شروط وفاز بالبطولة! 🥇`,
    };
  }

  // TIE EXISTS! Multiple contestants achieved max conditions
  // Resolve by overall tactical strength percentage
  const sortedTied = [...topConditionPlayers].sort((a, b) => b.overallPercentage - a.overallPercentage);
  const winner = sortedTied[0];
  const runnerUp = sortedTied[1];

  const tieBreakAnalysis = `مقارنة الحراسة والدفاع والوسط والهجوم بين ${winner.playerName} (${winner.overallPercentage}%) و ${runnerUp?.playerName || 'المنافسين'} (${runnerUp?.overallPercentage || 0}%) رجحت كفة فريق ${winner.playerName} بفضل التناغم الهجومي وصلابة الخطوط!`;

  return {
    evaluations,
    winnerId: winner.playerId,
    winnerName: winner.playerName,
    winnerClub: winner.selectedClub,
    isTie: true,
    tiedContestantIds: topConditionPlayers.map((p) => p.playerId),
    maxConditionsMet,
    verdictBanner: `تعادل في الشروط (${maxConditionsMet}/5)! حُسمت بالمقارنة التكتيكية المباشرة وتفوق فريق ${winner.playerName} بنسبة ${winner.overallPercentage}%! 🏆`,
    tieBreakAnalysis,
  };
}
