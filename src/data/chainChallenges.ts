import { ChainChallenge, ChainPlayer } from '../pages/football/football-chain/types';
import { FOOTBALL_PLAYERS_MASTER } from './footballMasterData';
import { toChainPlayer } from '../utils/footballChainEngine';

const getPlayerByName = (name: string): ChainPlayer => {
  const p = FOOTBALL_PLAYERS_MASTER.find(
    (player) =>
      player.name === name ||
      player.name.includes(name) ||
      (player.aliases && player.aliases.includes(name))
  );
  if (!p) {
    throw new Error(`Player not found in master data: ${name}`);
  }
  return toChainPlayer(p);
};

export const CHAIN_CHALLENGES_BANK: ChainChallenge[] = [
  {
    id: 'ch_salah_messi',
    startPlayer: getPlayerByName('محمد صلاح'),
    targetPlayer: getPlayerByName('ليونيل ميسي'),
    minHops: 3,
    hint: 'عبر ليفربول (أليسون) أو روما أو باريس سان جيرمان',
  },
  {
    id: 'ch_benzema_haaland',
    startPlayer: getPlayerByName('كريم بنزيما'),
    targetPlayer: getPlayerByName('إيرلينغ هالاند'),
    minHops: 3,
    hint: 'عبر ريال مدريد ومانشستر سيتي أو بوروسيا دورتموند',
  },
  {
    id: 'ch_ronaldo_mbappe',
    startPlayer: getPlayerByName('كريستيانو رونالدو'),
    targetPlayer: getPlayerByName('كيليان مبابي'),
    minHops: 2,
    hint: 'عبر ريال مدريد أو باريس سان جيرمان أو يوفنتوس',
  },
  {
    id: 'ch_salem_neymar',
    startPlayer: getPlayerByName('سالم الدوسري'),
    targetPlayer: getPlayerByName('نيمار'),
    minHops: 1,
    hint: 'عبر نادي الهلال السعودي',
  },
  {
    id: 'ch_modric_debruyne',
    startPlayer: getPlayerByName('لوكا مودريتش'),
    targetPlayer: getPlayerByName('كيفين دي بروين'),
    minHops: 3,
    hint: 'عبر توتنهام أو تشيلسي أو مانشستر سيتي',
  },
  {
    id: 'ch_kante_lewandowski',
    startPlayer: getPlayerByName('نغولو كانتي'),
    targetPlayer: getPlayerByName('روبرت ليفاندوفسكي'),
    minHops: 3,
    hint: 'عبر تشيلسي وبرشلونة أو بايرن ميونخ',
  },
  {
    id: 'ch_bounou_courtois',
    startPlayer: getPlayerByName('ياسين بونو'),
    targetPlayer: getPlayerByName('تيبو كورتوا'),
    minHops: 2,
    hint: 'عبر أتلتيكو مدريد أو إشبيلية أو ريال مدريد',
  },
  {
    id: 'ch_mahrez_kane',
    startPlayer: getPlayerByName('رياض محرز'),
    targetPlayer: getPlayerByName('هاري كين'),
    minHops: 2,
    hint: 'عبر مانشستر سيتي أو ليستر سيتي أو توتنهام أو بايرن ميونخ',
  },
  {
    id: 'ch_alisson_neymar',
    startPlayer: getPlayerByName('أليسون بيكر'),
    targetPlayer: getPlayerByName('نيمار'),
    minHops: 1,
    hint: 'عبر منتخب البرازيل',
  },
  {
    id: 'ch_vinicius_bellingham',
    startPlayer: getPlayerByName('فينيسيوس جونيور'),
    targetPlayer: getPlayerByName('جود بيلينغهام'),
    minHops: 1,
    hint: 'عبر ريال مدريد',
  },
  {
    id: 'ch_hakimi_mbappe',
    startPlayer: getPlayerByName('أشرف حكيمي'),
    targetPlayer: getPlayerByName('كيليان مبابي'),
    minHops: 1,
    hint: 'عبر باريس سان جيرمان أو ريال مدريد',
  },
  {
    id: 'ch_mane_vandijk',
    startPlayer: getPlayerByName('ساديو ماني'),
    targetPlayer: getPlayerByName('فيرجيل فان دايك'),
    minHops: 1,
    hint: 'عبر ليفربول أو ساوثهامبتون',
  },
  {
    id: 'ch_griezmann_suarez',
    startPlayer: getPlayerByName('أنطوان غريزمان'),
    targetPlayer: getPlayerByName('لويس سواريز'),
    minHops: 1,
    hint: 'عبر برشلونة أو أتلتيكو مدريد',
  },
  {
    id: 'ch_kroos_casemiro',
    startPlayer: getPlayerByName('توني كروس'),
    targetPlayer: getPlayerByName('كاسيميرو'),
    minHops: 1,
    hint: 'عبر ريال مدريد',
  },
  {
    id: 'ch_son_kane',
    startPlayer: getPlayerByName('سون هيونغ مين'),
    targetPlayer: getPlayerByName('هاري كين'),
    minHops: 1,
    hint: 'عبر توتنهام هوتسبير',
  },
  {
    id: 'ch_ramos_messi',
    startPlayer: getPlayerByName('سيرجيو راموس'),
    targetPlayer: getPlayerByName('ليونيل ميسي'),
    minHops: 1,
    hint: 'عبر باريس سان جيرمان',
  },
  {
    id: 'ch_pedri_yamal',
    startPlayer: getPlayerByName('بيدري'),
    targetPlayer: getPlayerByName('لامين يامال'),
    minHops: 1,
    hint: 'عبر برشلونة ومنتخب إسبانيا',
  },
  {
    id: 'ch_salah_haaland',
    startPlayer: getPlayerByName('محمد صلاح'),
    targetPlayer: getPlayerByName('إيرلينغ هالاند'),
    minHops: 3,
    hint: 'عبر الدوري الإنجليزي (مانشستر سيتي وليفربول)',
  },
  {
    id: 'ch_benzema_ronaldo',
    startPlayer: getPlayerByName('كريم بنزيما'),
    targetPlayer: getPlayerByName('كريستيانو رونالدو'),
    minHops: 1,
    hint: 'عبر ريال مدريد',
  },
  {
    id: 'ch_mitrovic_neymar',
    startPlayer: getPlayerByName('ألكسندر ميتروفيتش'),
    targetPlayer: getPlayerByName('نيمار'),
    minHops: 1,
    hint: 'عبر الهلال السعودي',
  },
  {
    id: 'ch_otavio_ronaldo',
    startPlayer: getPlayerByName('أوتافيو'),
    targetPlayer: getPlayerByName('كريستيانو رونالدو'),
    minHops: 1,
    hint: 'عبر النصر ومنتخب البرتغال',
  },
  {
    id: 'ch_mahrez_firmino',
    startPlayer: getPlayerByName('رياض محرز'),
    targetPlayer: getPlayerByName('روبرتو فيرمينو'),
    minHops: 1,
    hint: 'عبر الأهلي السعودي',
  },
  {
    id: 'ch_kante_benzema',
    startPlayer: getPlayerByName('نغولو كانتي'),
    targetPlayer: getPlayerByName('كريم بنزيما'),
    minHops: 1,
    hint: 'عبر الاتحاد السعودي ومنتخب فرنسا',
  },
  {
    id: 'ch_bounou_neymar',
    startPlayer: getPlayerByName('ياسين بونو'),
    targetPlayer: getPlayerByName('نيمار'),
    minHops: 1,
    hint: 'عبر الهلال السعودي',
  },
  {
    id: 'ch_alaba_davies',
    startPlayer: getPlayerByName('دافيد ألابا'),
    targetPlayer: getPlayerByName('ألفونسو ديفيز'),
    minHops: 1,
    hint: 'عبر بايرن ميونخ',
  },
  {
    id: 'ch_rudiger_havertz',
    startPlayer: getPlayerByName('أنطونيو روديغر'),
    targetPlayer: getPlayerByName('كاي هافيرتز'),
    minHops: 1,
    hint: 'عبر تشيلسي ومنتخب ألمانيا',
  },
  {
    id: 'ch_gundogan_haaland',
    startPlayer: getPlayerByName('إلكاي غوندوغان'),
    targetPlayer: getPlayerByName('إيرلينغ هالاند'),
    minHops: 1,
    hint: 'عبر مانشستر سيتي',
  },
  {
    id: 'ch_lewandowski_muller',
    startPlayer: getPlayerByName('روبرت ليفاندوفسكي'),
    targetPlayer: getPlayerByName('توماس مولر'),
    minHops: 1,
    hint: 'عبر بايرن ميونخ',
  },
  {
    id: 'ch_neuer_terstegen',
    startPlayer: getPlayerByName('مانويل نوير'),
    targetPlayer: getPlayerByName('مارك أندريه تير شتيغن'),
    minHops: 1,
    hint: 'عبر منتخب ألمانيا',
  },
  {
    id: 'ch_ronaldo_cancelo',
    startPlayer: getPlayerByName('كريستيانو رونالدو'),
    targetPlayer: getPlayerByName('جواو كانسيلو'),
    minHops: 1,
    hint: 'عبر يوفنتوس ومنتخب البرتغال',
  },
];

/**
 * Returns a randomized sequence of challenges for a 5-round match
 */
export const getRandomChainChallenges = (count: number = 5): ChainChallenge[] => {
  const shuffled = [...CHAIN_CHALLENGES_BANK].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};
