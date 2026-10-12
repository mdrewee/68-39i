export interface DraftCondition {
  id: string;
  title: string;
  description: string;
  category: 'historical' | 'trophy' | 'league' | 'trait' | 'career';
}

export const DRAFT_CONDITIONS_BANK: DraftCondition[] = [
  // ألقاب وبطولات
  { id: 'c_wc', title: 'بطل العالم', description: 'حقق بطولة كأس العالم مع منتخبه', category: 'trophy' },
  { id: 'c_ucl', title: 'ملك الأبطال', description: 'حقق دوري أبطال أوروبا مرتين على الأقل', category: 'trophy' },
  { id: 'c_bodor', title: 'الكرة الذهبية', description: 'سبق له الفوز بجائزة الكرة الذهبية أو الترشح للثلاثي النهائي', category: 'trophy' },
  { id: 'c_copa_euro', title: 'بطل القارة', description: 'حقق كأس أمم أوروبا (اليورو) أو كوبا أمريكا', category: 'trophy' },
  { id: 'c_treble', title: 'صاحب الثلاثية', description: 'حقق الثلاثية التاريخية (الدوري والكأس والأبطال) في موسم واحد', category: 'trophy' },

  // دوريات ومحطات
  { id: 'c_roshn', title: 'نجم دوري روشن', description: 'لعب أو يلعب حالياً في الدوري السعودي للمحترفين', category: 'league' },
  { id: 'c_clasico', title: 'رائحة الكلاسيكو', description: 'مثّل ريال مدريد أو برشلونة في مسيرته', category: 'league' },
  { id: 'c_premier', title: 'صراع البريميرليغ', description: 'لعب في الدوري الإنجليزي الممتاز أكثر من 3 مواسم', category: 'league' },
  { id: 'c_calcio', title: 'الكالتشيو الإيطالي', description: 'لعب في الدوري الإيطالي (ميلان، إنتر، يوفي، روما...) ', category: 'league' },
  { id: 'c_bundesliga', title: 'البوندسليغا الألمانية', description: 'لعب في الدوري الألماني (بايرن ميونخ أو دورتموند أو ليفركوزن)', category: 'league' },
  { id: 'c_ligue1', title: 'الدوري الفرنسي', description: 'لعب في الدوري الفرنسي (باريس سان جيرمان، موناكو، ليون، مارسيليا)', category: 'league' },
  { id: 'c_derby_betrayal', title: 'خائن الديربي', description: 'لعب لغريمين تقليديين في نفس المدينة أو الدوري', category: 'career' },

  // مسيرات وأندية
  { id: 'c_globetrotter', title: 'الرحالة', description: 'مثّل أكثر من 5 أندية مختلفة في مسيرته الاحترافية', category: 'career' },
  { id: 'c_one_club', title: 'الوفاء النادر', description: 'لعب لنادي واحد فقط طوال مسيرته، أو أكثر من 10 مواسم بنادٍ واحد', category: 'career' },
  { id: 'c_pep_carlo', title: 'تلميذ الكبار', description: 'تدرّب تحت قيادة بيب غوارديولا أو كارلو أنشيلوتي أو مورينيو', category: 'career' },
  { id: 'c_top3_leagues', title: 'فاتح الدوريات الكبرى', description: 'لعب في 3 دوريات أوروبية كبرى على الأقل (إنجلترا، إسبانيا، إيطاليا، ألمانيا)', category: 'career' },

  // حقب وتاريخ
  { id: 'c_retired_pre2010', title: 'أسطورة كلاسيكية', description: 'لاعب معتزل رسمياً قبل عام 2012 (جيل التسعينات والثمانينات)', category: 'historical' },
  { id: 'c_active_u24', title: 'موهبة شابة', description: 'لاعب ناشط حالياً وعمره 24 سنة أو أقل', category: 'historical' },
  { id: 'c_veteran_35', title: 'عجوز ذهبي', description: 'لاعب تجاوز عمره 35 سنة وما زال يلعب أو اعتزل بعد الـ 36', category: 'historical' },
  { id: 'c_gen_2000s', title: 'جيل الألفينات الذهبي', description: 'بلغ ذروة تألقه وبريقه بين أعوام 2000 و2010', category: 'historical' },

  // صفات وأرقام ومراكز
  { id: 'c_left_foot', title: 'أعسر سحري', description: 'يلعب بالقدم اليسرى حصراً (أشول)', category: 'trait' },
  { id: 'c_tall_giant', title: 'برج مراقبة', description: 'طوله 190 سم أو أكثر', category: 'trait' },
  { id: 'c_shirt_10', title: 'صانع الألعاب 10', description: 'اشتهر بارتداء القميص رقم 10 في مسيرته', category: 'trait' },
  { id: 'c_shirt_7', title: 'الجناح النفاثة 7', description: 'اشتهر بارتداء القميص رقم 7 في مسيرته', category: 'trait' },
  { id: 'c_shirt_9', title: 'القناص رقم 9', description: 'مهاجم صريح اشتهر بارتداء القميص رقم 9 وإنهاء الفرص', category: 'trait' },
  { id: 'c_red_cards', title: 'جزار الملاعب', description: 'اشتهر بالتدخلات الخشنة أو تلقي بطاقات حمراء شهيرة', category: 'trait' },
  { id: 'c_non_euro_latam', title: 'سفير القارات', description: 'جنسيته أفريقية أو آسيوية (خارج أوروبا وأمريكا الجنوبية)', category: 'trait' },
  { id: 'c_super_sub', title: 'الورقة الرابحة', description: 'اشتهر بأهدافه الحاسمة كبديل أو أهداف اللحظات الأخيرة', category: 'trait' },
  { id: 'c_goal_defender', title: 'المدافع الهداف', description: 'مدافع سجل أكثر من 30 هدفاً في مسيرته الاحترافية', category: 'trait' },
  { id: 'c_penalty_gk', title: 'صائد ركلات الجزاء', description: 'حارس مرمى اشتهر بصد ركلات الترجيح والجزاء', category: 'trait' },
  { id: 'c_captain_leader', title: 'الكابيتانو', description: 'حمل شارة القيادة مع ناديه أو منتخبه لسنوات طويلة', category: 'trait' },
  { id: 'c_freekick_specialist', title: 'مهندس الضربات الثابتة', description: 'سجل أكثر من 20 هدفاً من كرات ثابتة مباشرة في مسيرته', category: 'trait' }
];

export function getRandomDraftCondition(excludedIds: Set<string> = new Set()): DraftCondition {
  const available = DRAFT_CONDITIONS_BANK.filter((c) => !excludedIds.has(c.id));
  const pool = available.length > 0 ? available : DRAFT_CONDITIONS_BANK;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}
