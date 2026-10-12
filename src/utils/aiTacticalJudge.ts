import { supabase } from '../lib/supabase';
import { DraftContestant, SquadAIEvaluation } from '../pages/football/draft-5/types';
import { DraftCondition } from '../data/draftConditions';

/**
 * Tactical AI Evaluation Engine for 5-a-side Football Drafts.
 * Evaluates GK, DEF, MID, FWD, and Criteria/Synergy with humorous Arabic banter.
 */
export async function evaluateDraftSquadsWithAI(
  contestants: DraftContestant[],
  conditions: DraftCondition[]
): Promise<SquadAIEvaluation[]> {
  try {
    const payload = contestants.map((c) => ({
      playerId: c.id,
      playerName: c.name,
      squad: {
        gk: c.picks.GK?.name || 'بدون حارس',
        def: c.picks.DEF?.name || 'بدون مدافع',
        mid: c.picks.MID?.name || 'بدون وسط',
        fwd: c.picks.FWD?.name || 'بدون مهاجم',
        wildcard: c.picks.WILDCARD?.name || 'بدون ورقة رابحة',
      },
      conditions: conditions.map((cond) => ({
        title: cond.title,
        desc: cond.description,
      })),
    }));

    const response = await supabase.functions.invoke('ai-judge', {
      body: {
        mode: 'football_draft',
        contestants: payload,
      },
    });

    if (response.data?.evaluations && Array.isArray(response.data.evaluations)) {
      return response.data.evaluations as SquadAIEvaluation[];
    }
  } catch (err) {
    console.warn('[AI Tactical Judge] Edge function unavailable, executing heuristic evaluator:', err);
  }

  // Resilient Local Tactical Analyst Engine
  return generateHeuristicEvaluations(contestants, conditions);
}

function generateHeuristicEvaluations(
  contestants: DraftContestant[],
  conditions: DraftCondition[]
): SquadAIEvaluation[] {
  return contestants.map((c) => {
    const gk = c.picks.GK;
    const def = c.picks.DEF;
    const mid = c.picks.MID;
    const fwd = c.picks.FWD;
    const wild = c.picks.WILDCARD;

    let gkScore = gk ? Math.floor(75 + Math.random() * 20) : 40;
    let defScore = def ? Math.floor(75 + Math.random() * 20) : 40;
    let midScore = mid ? Math.floor(78 + Math.random() * 20) : 45;
    let fwdScore = fwd ? Math.floor(80 + Math.random() * 18) : 40;
    let synergyScore = Math.floor(72 + Math.random() * 24);

    if (gk?.trophies?.length) gkScore = Math.min(98, gkScore + 5);
    if (def?.trophies?.length) defScore = Math.min(98, defScore + 5);
    if (mid?.trophies?.length) midScore = Math.min(98, midScore + 6);
    if (fwd?.trophies?.length) fwdScore = Math.min(99, fwdScore + 6);

    const overallPercentage = Math.round(
      gkScore * 0.15 + defScore * 0.2 + midScore * 0.25 + fwdScore * 0.25 + synergyScore * 0.15
    );

    const titles = [
      'تكتيك هجومي ساحق مع شوارع بالدفاع',
      'توليفة ذهبية تشبه بارسا جوارديولا',
      'فريق استراحة منظم بروح إيطالية كلاسيكية',
      'وسط جبار يحرث الملعب وعقم في اللمسة الأخيرة',
      'حراسة كالجدار ودفاع حديدي بصلابة الكالتشيو',
      'مواهب استعراضية بدون عمق تكتيكي',
      'توازن تكتيكي مرعب يطمح لدوري الأبطال'
    ];
    const critiqueTitle = titles[Math.floor(Math.random() * titles.length)];

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (fwd) strengths.push(`قوة حسم عالية بالهجوم بفضل ${fwd.name}`);
    if (mid) strengths.push(`بناء لعب سلس وضغط عكسي بقيادة ${mid.name}`);
    if (gk) strengths.push(`ردات فعل استثنائية وثقة بالحراسة بفضل ${gk.name}`);
    if (def) strengths.push(`صلابة دفاعية وخروج نظيف بالكرة مع ${def.name}`);
    if (wild) strengths.push(`ورقة رابحة نوعية قلبت التوازن (${wild.name})`);

    if (!gk) weaknesses.push('غياب الحارس الأساسي يكلف الفريق أهدافاً مجانية');
    if (!def) weaknesses.push('عمق دفاعي هش وكسر مصيدة التسلل وارد بأي لحظة');
    if (fwdScore < 85) weaknesses.push('تذبذب في إنهاء الفرص أمام المرمى');
    if (synergyScore < 80) weaknesses.push('تباين واضح في رتم اللعب بين الأجيال والأندية');
    if (weaknesses.length === 0) weaknesses.push('اندفاع هجومي متهور قد يفتح ثغرات في المرتدات السريعة');

    const summaryTemplates = [
      `تشكيلة ${c.name} بنيت بعين خبير، الخطوط متقاربة والتدرج بالكرة مضمون، لكن مواجهة الفرق السريعة قد تكشف البطء في الارتداد.`,
      `فريق يمتلك نجوماً من أعلى طراز عالمي، والانسجام التكتيكي يرجح كفته، وإن كانت الخطة تحتاج تركيزاً أعلى في الكرات الثابتة.`,
      `فريق مرعب في الثلث الأخير! لو لعب هذا التشكيل على أرض الواقع لما احتاج سوى تمريرة واحدة لكسر أعتى خطوط الدفاع.`,
      `اختيارات جريئة تعتمد على المهارة الفردية العالية، الضغط العالي سيكون سلاحهم الفتاك ضد أي خصم.`
    ];
    const tacticalSummary = summaryTemplates[Math.floor(Math.random() * summaryTemplates.length)];

    return {
      playerId: c.id,
      playerName: c.name,
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
