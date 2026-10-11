export type BingoCategory =
  | 'club'       // شعار نادي (مثّل النادي في مسيرته)
  | 'country'    // علم دولة (جنسيته أو مثّل منتخبها)
  | 'manager'    // صورة مدرب (تدرّب تحت قيادته)
  | 'trophy'     // بطولة (حققها في تاريخه)
  | 'position'   // مركز (GK, DEF, MID, FWD)
  | 'number'     // رقم تيشيرت (ارتداه في مسيرته)
  | 'trait';     // صفة جسدية (أشول، أيمن، أسمر)

export interface BingoTileDefinition {
  id: string;
  category: BingoCategory;
  targetValue: string | number;
  label: string; // Compact label / tooltip
  iconUrl: string; // Identifier or SVG representation
  colorAccent?: string;
}

export interface PlayerBingoTile {
  index: number; // 0 to 15
  definition: BingoTileDefinition;
  isClaimed: boolean;
  claimedPlayer?: {
    id: string;
    name: string;
    photo: string;
  };
}

export interface ActiveFootballer {
  id: string;
  name: string;
  photo: string;
  currentClubBadge: string;
  clubs: string[];
  nationalities: string[];
  managers: string[];
  trophies: string[];
  positions: string[];
  shirtNumbers: number[];
  foot: 'left' | 'right';
  skinTone: 'dark' | 'light';
}

// 45+ Rich Visual Criteria Bank
export const BINGO_TILES_BANK: BingoTileDefinition[] = [
  // --- CLUBS ---
  { id: 'club_nassr', category: 'club', targetValue: 'النصر', label: 'النصر', iconUrl: 'c_nassr', colorAccent: '#F5B041' },
  { id: 'club_hilal', category: 'club', targetValue: 'الهلال', label: 'الهلال', iconUrl: 'c_hilal', colorAccent: '#2E86C1' },
  { id: 'club_ittihad', category: 'club', targetValue: 'الاتحاد', label: 'الاتحاد', iconUrl: 'c_ittihad', colorAccent: '#F4D03F' },
  { id: 'club_ahli', category: 'club', targetValue: 'الأهلي', label: 'الأهلي', iconUrl: 'c_ahli', colorAccent: '#27AE60' },
  { id: 'club_real_madrid', category: 'club', targetValue: 'ريال مدريد', label: 'ريال مدريد', iconUrl: 'c_real_madrid', colorAccent: '#5D6D7E' },
  { id: 'club_barcelona', category: 'club', targetValue: 'برشلونة', label: 'برشلونة', iconUrl: 'c_barcelona', colorAccent: '#A93226' },
  { id: 'club_man_city', category: 'club', targetValue: 'مانشستر سيتي', label: 'مانشستر سيتي', iconUrl: 'c_man_city', colorAccent: '#5DADE2' },
  { id: 'club_man_united', category: 'club', targetValue: 'مانشستر يونايتد', label: 'مانشستر يونايتد', iconUrl: 'c_man_united', colorAccent: '#C0392B' },
  { id: 'club_liverpool', category: 'club', targetValue: 'ليفربول', label: 'ليفربول', iconUrl: 'c_liverpool', colorAccent: '#C0392B' },
  { id: 'club_bayern', category: 'club', targetValue: 'بايرن ميونخ', label: 'بايرن ميونخ', iconUrl: 'c_bayern', colorAccent: '#E74C3C' },
  { id: 'club_psg', category: 'club', targetValue: 'باريس سان جيرمان', label: 'باريس سان جيرمان', iconUrl: 'c_psg', colorAccent: '#1F618D' },
  { id: 'club_juventus', category: 'club', targetValue: 'يوفنتوس', label: 'يوفنتوس', iconUrl: 'c_juventus', colorAccent: '#2C3E50' },
  { id: 'club_chelsea', category: 'club', targetValue: 'تشيلسي', label: 'تشيلسي', iconUrl: 'c_chelsea', colorAccent: '#2980B9' },
  { id: 'club_arsenal', category: 'club', targetValue: 'أرسنال', label: 'أرسنال', iconUrl: 'c_arsenal', colorAccent: '#E74C3C' },

  // --- COUNTRIES (FLAGS) ---
  { id: 'country_sa', category: 'country', targetValue: 'السعودية', label: 'السعودية', iconUrl: 'SA', colorAccent: '#1E8449' },
  { id: 'country_br', category: 'country', targetValue: 'البرازيل', label: 'البرازيل', iconUrl: 'BR', colorAccent: '#F1C40F' },
  { id: 'country_ar', category: 'country', targetValue: 'الأرجنتين', label: 'الأرجنتين', iconUrl: 'AR', colorAccent: '#5DADE2' },
  { id: 'country_fr', category: 'country', targetValue: 'فرنسا', label: 'فرنسا', iconUrl: 'FR', colorAccent: '#2E86C1' },
  { id: 'country_pt', category: 'country', targetValue: 'البرتغال', label: 'البرتغال', iconUrl: 'PT', colorAccent: '#C0392B' },
  { id: 'country_es', category: 'country', targetValue: 'إسبانيا', label: 'إسبانيا', iconUrl: 'ES', colorAccent: '#E67E22' },
  { id: 'country_gb', category: 'country', targetValue: 'إنجلترا', label: 'إنجلترا', iconUrl: 'GB-ENG', colorAccent: '#E74C3C' },
  { id: 'country_de', category: 'country', targetValue: 'ألمانيا', label: 'ألمانيا', iconUrl: 'DE', colorAccent: '#2C3E50' },
  { id: 'country_nl', category: 'country', targetValue: 'هولندا', label: 'هولندا', iconUrl: 'NL', colorAccent: '#E67E22' },
  { id: 'country_hr', category: 'country', targetValue: 'كرواتيا', label: 'كرواتيا', iconUrl: 'HR', colorAccent: '#C0392B' },
  { id: 'country_ma', category: 'country', targetValue: 'المغرب', label: 'المغرب', iconUrl: 'MA', colorAccent: '#C0392B' },
  { id: 'country_eg', category: 'country', targetValue: 'مصر', label: 'مصر', iconUrl: 'EG', colorAccent: '#2C3E50' },

  // --- MANAGERS ---
  { id: 'mgr_pep', category: 'manager', targetValue: 'غوارديولا', label: 'غوارديولا', iconUrl: 'mgr_pep', colorAccent: '#34495E' },
  { id: 'mgr_ancelotti', category: 'manager', targetValue: 'أنشيلوتي', label: 'أنشيلوتي', iconUrl: 'mgr_ancelotti', colorAccent: '#2C3E50' },
  { id: 'mgr_klopp', category: 'manager', targetValue: 'كلوب', label: 'كلوب', iconUrl: 'mgr_klopp', colorAccent: '#C0392B' },
  { id: 'mgr_mourinho', category: 'manager', targetValue: 'مورينيو', label: 'مورينيو', iconUrl: 'mgr_mourinho', colorAccent: '#2C3E50' },
  { id: 'mgr_zidane', category: 'manager', targetValue: 'زيدان', label: 'زيدان', iconUrl: 'mgr_zidane', colorAccent: '#5D6D7E' },
  { id: 'mgr_jesus', category: 'manager', targetValue: 'جورجي جيسوس', label: 'جورجي جيسوس', iconUrl: 'mgr_jesus', colorAccent: '#2E86C1' },

  // --- TROPHIES ---
  { id: 'trophy_world_cup', category: 'trophy', targetValue: 'كأس العالم', label: 'كأس العالم', iconUrl: 'trophy_wc', colorAccent: '#F39C12' },
  { id: 'trophy_ucl', category: 'trophy', targetValue: 'دوري أبطال أوروبا', label: 'دوري أبطال أوروبا', iconUrl: 'trophy_ucl', colorAccent: '#2980B9' },
  { id: 'trophy_spl', category: 'trophy', targetValue: 'الدوري السعودي', label: 'الدوري السعودي', iconUrl: 'trophy_spl', colorAccent: '#27AE60' },
  { id: 'trophy_ballon_dor', category: 'trophy', targetValue: 'الكرة الذهبية', label: 'الكرة الذهبية', iconUrl: 'trophy_ballon', colorAccent: '#F1C40F' },
  { id: 'trophy_copa_america', category: 'trophy', targetValue: 'كوبا أمريكا', label: 'كوبا أمريكا', iconUrl: 'trophy_copa', colorAccent: '#8E44AD' },

  // --- SHIRT NUMBERS ---
  { id: 'num_7', category: 'number', targetValue: 7, label: 'رقم 7', iconUrl: 'num_7', colorAccent: '#C68B59' },
  { id: 'num_9', category: 'number', targetValue: 9, label: 'رقم 9', iconUrl: 'num_9', colorAccent: '#C68B59' },
  { id: 'num_10', category: 'number', targetValue: 10, label: 'رقم 10', iconUrl: 'num_10', colorAccent: '#C68B59' },
  { id: 'num_8', category: 'number', targetValue: 8, label: 'رقم 8', iconUrl: 'num_8', colorAccent: '#C68B59' },
  { id: 'num_11', category: 'number', targetValue: 11, label: 'رقم 11', iconUrl: 'num_11', colorAccent: '#C68B59' },

  // --- POSITIONS ---
  { id: 'pos_gk', category: 'position', targetValue: 'GK', label: 'حارس مرمى', iconUrl: 'pos_gk', colorAccent: '#F39C12' },
  { id: 'pos_def', category: 'position', targetValue: 'DEF', label: 'مدافع', iconUrl: 'pos_def', colorAccent: '#2980B9' },
  { id: 'pos_mid', category: 'position', targetValue: 'MID', label: 'لاعب وسط', iconUrl: 'pos_mid', colorAccent: '#27AE60' },
  { id: 'pos_fwd', category: 'position', targetValue: 'FWD', label: 'مهاجم', iconUrl: 'pos_fwd', colorAccent: '#C0392B' },

  // --- TRAITS ---
  { id: 'trait_left_foot', category: 'trait', targetValue: 'left_foot', label: 'أشول (قدم يسرى)', iconUrl: 'trait_left_foot', colorAccent: '#8A9A5B' },
  { id: 'trait_right_foot', category: 'trait', targetValue: 'right_foot', label: 'أيمن (قدم يمنى)', iconUrl: 'trait_right_foot', colorAccent: '#8A9A5B' },
  { id: 'trait_dark_skin', category: 'trait', targetValue: 'dark_skin', label: 'لاعب أسمر', iconUrl: 'trait_dark_skin', colorAccent: '#5C4033' },
];

// Rich Pool of Prominent Active and Historical Footballers
export const FOOTBALL_BINGO_PLAYERS: ActiveFootballer[] = [
  {
    id: 'p_cristiano_ronaldo',
    name: 'كريستيانو رونالدو',
    photo: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_nassr',
    clubs: ['سبورتينغ لشبونة', 'مانشستر يونايتد', 'ريال مدريد', 'يوفنتوس', 'النصر'],
    nationalities: ['البرتغال'],
    managers: ['مورينيو', 'زيدان', 'أنشيلوتي', 'جورجي جيسوس', 'فيرغسون'],
    trophies: ['دوري أبطال أوروبا', 'الكرة الذهبية', 'كأس أمم أوروبا', 'الدوري الإسباني', 'الدوري الإنجليزي', 'الدوري الإيطالي'],
    positions: ['FWD'],
    shirtNumbers: [7, 9, 28],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_lionel_messi',
    name: 'ليونيل ميسي',
    photo: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_inter_miami',
    clubs: ['برشلونة', 'باريس سان جيرمان', 'إنتر ميامي'],
    nationalities: ['الأرجنتين'],
    managers: ['غوارديولا', 'إنريكي', 'فالفيردي'],
    trophies: ['كأس العالم', 'دوري أبطال أوروبا', 'الكرة الذهبية', 'كوبا أمريكا', 'الدوري الإسباني', 'الدوري الفرنسي'],
    positions: ['FWD'],
    shirtNumbers: [10, 30, 19],
    foot: 'left',
    skinTone: 'light'
  },
  {
    id: 'p_karim_benzema',
    name: 'كريم بنزيما',
    photo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_ittihad',
    clubs: ['ليون', 'ريال مدريد', 'الاتحاد'],
    nationalities: ['فرنسا'],
    managers: ['مورينيو', 'أنشيلوتي', 'زيدان', 'بلان'],
    trophies: ['دوري أبطال أوروبا', 'الكرة الذهبية', 'الدوري الإسباني', 'الدوري الفرنسي'],
    positions: ['FWD'],
    shirtNumbers: [9, 10, 11],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_salem_aldawsari',
    name: 'سالم الدوسري',
    photo: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_hilal',
    clubs: ['الهلال', 'فياريال'],
    nationalities: ['السعودية'],
    managers: ['جورجي جيسوس', 'دياز', 'لوشيسكو', 'رينارد'],
    trophies: ['دوري أبطال آسيا', 'الدوري السعودي'],
    positions: ['FWD', 'MID'],
    shirtNumbers: [29, 10, 7],
    foot: 'right',
    skinTone: 'dark'
  },
  {
    id: 'p_neymar_jr',
    name: 'نيمار جونيور',
    photo: 'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_hilal',
    clubs: ['سانتوس', 'برشلونة', 'باريس سان جيرمان', 'الهلال'],
    nationalities: ['البرازيل'],
    managers: ['إنريكي', 'توخيل', 'جورجي جيسوس'],
    trophies: ['دوري أبطال أوروبا', 'الدوري الإسباني', 'الدوري الفرنسي', 'الدوري السعودي'],
    positions: ['FWD'],
    shirtNumbers: [10, 11],
    foot: 'right',
    skinTone: 'dark'
  },
  {
    id: 'p_kylian_mbappe',
    name: 'كيليان مبابي',
    photo: 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_real_madrid',
    clubs: ['موناكو', 'باريس سان جيرمان', 'ريال مدريد'],
    nationalities: ['فرنسا'],
    managers: ['أنشيلوتي', 'توخيل', 'ديشامب', 'إنريكي'],
    trophies: ['كأس العالم', 'الدوري الفرنسي', 'دوري الأمم الأوروبية'],
    positions: ['FWD'],
    shirtNumbers: [9, 7, 10],
    foot: 'right',
    skinTone: 'dark'
  },
  {
    id: 'p_erling_haaland',
    name: 'إيرلينغ هالاند',
    photo: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_man_city',
    clubs: ['برينه', 'مولده', 'سالزبورغ', 'بوروسيا دورتموند', 'مانشستر سيتي'],
    nationalities: ['النرويج'],
    managers: ['غوارديولا'],
    trophies: ['دوري أبطال أوروبا', 'الدوري الإنجليزي'],
    positions: ['FWD'],
    shirtNumbers: [9, 30],
    foot: 'left',
    skinTone: 'light'
  },
  {
    id: 'p_kevin_de_bruyne',
    name: 'كيفين دي بروين',
    photo: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_man_city',
    clubs: ['جينك', 'تشيلسي', 'فيردر بريمن', 'فولفسبورغ', 'مانشستر سيتي'],
    nationalities: ['بلجيكا'],
    managers: ['مورينيو', 'غوارديولا'],
    trophies: ['دوري أبطال أوروبا', 'الدوري الإنجليزي'],
    positions: ['MID'],
    shirtNumbers: [17, 7, 14],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_mohamed_salah',
    name: 'محمد صلاح',
    photo: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_liverpool',
    clubs: ['المقاولون العرب', 'بازل', 'تشيلسي', 'فيورنتينا', 'روما', 'ليفربول'],
    nationalities: ['مصر'],
    managers: ['مورينيو', 'كلوب', 'سباليتي'],
    trophies: ['دوري أبطال أوروبا', 'الدوري الإنجليزي'],
    positions: ['FWD'],
    shirtNumbers: [11, 10, 15],
    foot: 'left',
    skinTone: 'dark'
  },
  {
    id: 'p_vinicius_jr',
    name: 'فينيسيوس جونيور',
    photo: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_real_madrid',
    clubs: ['فلامنغو', 'ريال مدريد'],
    nationalities: ['البرازيل'],
    managers: ['زيدان', 'أنشيلوتي'],
    trophies: ['دوري أبطال أوروبا', 'الدوري الإسباني'],
    positions: ['FWD'],
    shirtNumbers: [7, 20],
    foot: 'right',
    skinTone: 'dark'
  },
  {
    id: 'p_luka_modric',
    name: 'لوكا مودريتش',
    photo: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_real_madrid',
    clubs: ['دينامو زغرب', 'توتنهام', 'ريال مدريد'],
    nationalities: ['كرواتيا'],
    managers: ['مورينيو', 'أنشيلوتي', 'زيدان'],
    trophies: ['دوري أبطال أوروبا', 'الكرة الذهبية', 'الدوري الإسباني'],
    positions: ['MID'],
    shirtNumbers: [10, 19, 14],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_ngolo_kante',
    name: 'نغولو كانتي',
    photo: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_ittihad',
    clubs: ['بولون', 'كاين', 'ليستر سيتي', 'تشيلسي', 'الاتحاد'],
    nationalities: ['فرنسا'],
    managers: ['كونتي', 'توخيل', 'ساري', 'رانييري', 'ديشامب'],
    trophies: ['كأس العالم', 'دوري أبطال أوروبا', 'الدوري الإنجليزي'],
    positions: ['MID'],
    shirtNumbers: [7, 13],
    foot: 'right',
    skinTone: 'dark'
  },
  {
    id: 'p_riyad_mahrez',
    name: 'رياض محرز',
    photo: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_ahli',
    clubs: ['لوهافر', 'ليستر سيتي', 'مانشستر سيتي', 'الأهلي'],
    nationalities: ['الجزائر'],
    managers: ['رانييري', 'غوارديولا'],
    trophies: ['دوري أبطال أوروبا', 'الدوري الإنجليزي'],
    positions: ['FWD'],
    shirtNumbers: [7, 26],
    foot: 'left',
    skinTone: 'dark'
  },
  {
    id: 'p_aleksandar_mitrovic',
    name: 'ألكسندر ميتروفيتش',
    photo: 'https://images.unsplash.com/photo-1569517282132-25d22f4573e6?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_hilal',
    clubs: ['بارتيزان', 'أندرلخت', 'نيوكاسل', 'فولهام', 'الهلال'],
    nationalities: ['صربيا'],
    managers: ['جورجي جيسوس', 'بينيتيز'],
    trophies: ['الدوري السعودي', 'الدوري البلجيكي'],
    positions: ['FWD'],
    shirtNumbers: [9, 45],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_yassine_bounou',
    name: 'ياسين بونو',
    photo: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_hilal',
    clubs: ['الوداد', 'أتلتيكو مدريد', 'سرقسطة', 'جيرونا', 'إشبيلية', 'الهلال'],
    nationalities: ['المغرب'],
    managers: ['جورجي جيسوس', 'لوبيتيغي', 'منديلبار'],
    trophies: ['الدوري الأوروبي', 'الدوري السعودي'],
    positions: ['GK'],
    shirtNumbers: [13, 1],
    foot: 'left',
    skinTone: 'light'
  },
  {
    id: 'p_sergio_ramos',
    name: 'سيرخيو راموس',
    photo: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_sevilla',
    clubs: ['إشبيلية', 'ريال مدريد', 'باريس سان جيرمان', 'إشبيلية'],
    nationalities: ['إسبانيا'],
    managers: ['مورينيو', 'أنشيلوتي', 'زيدان', 'دل بوسكي'],
    trophies: ['كأس العالم', 'دوري أبطال أوروبا', 'كأس أمم أوروبا', 'الدوري الإسباني', 'الدوري الفرنسي'],
    positions: ['DEF'],
    shirtNumbers: [4, 15],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_toni_kroos',
    name: 'توني كروس',
    photo: 'https://images.unsplash.com/photo-1516726817505-f5ed825624d8?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_real_madrid',
    clubs: ['بايرن ميونخ', 'باير ليفركوزن', 'ريال مدريد'],
    nationalities: ['ألمانيا'],
    managers: ['غوارديولا', 'أنشيلوتي', 'زيدان', 'هاينكس'],
    trophies: ['كأس العالم', 'دوري أبطال أوروبا', 'الدوري الإسباني', 'الدوري الألماني'],
    positions: ['MID'],
    shirtNumbers: [8, 39],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_thibaut_courtois',
    name: 'تيبو كورتوا',
    photo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_real_madrid',
    clubs: ['جينك', 'أتلتيكو مدريد', 'تشيلسي', 'ريال مدريد'],
    nationalities: ['بلجيكا'],
    managers: ['مورينيو', 'أنشيلوتي', 'زيدان', 'سيميوني', 'كونتي'],
    trophies: ['دوري أبطال أوروبا', 'الدوري الإسباني', 'الدوري الإنجليزي'],
    positions: ['GK'],
    shirtNumbers: [1, 13],
    foot: 'left',
    skinTone: 'light'
  },
  {
    id: 'p_virgil_van_dijk',
    name: 'فيرجيل فان دايك',
    photo: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_liverpool',
    clubs: ['غرونينغن', 'سيلتيك', 'ساوثهامبتون', 'ليفربول'],
    nationalities: ['هولندا'],
    managers: ['كلوب', 'كومان'],
    trophies: ['دوري أبطال أوروبا', 'الدوري الإنجليزي'],
    positions: ['DEF'],
    shirtNumbers: [4],
    foot: 'right',
    skinTone: 'dark'
  },
  {
    id: 'p_jude_bellingham',
    name: 'جود بيلينغهام',
    photo: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_real_madrid',
    clubs: ['برمنغهام', 'بوروسيا دورتموند', 'ريال مدريد'],
    nationalities: ['إنجلترا'],
    managers: ['أنشيلوتي', 'ساوثغيت'],
    trophies: ['دوري أبطال أوروبا', 'الدوري الإسباني'],
    positions: ['MID'],
    shirtNumbers: [5, 22, 10],
    foot: 'right',
    skinTone: 'dark'
  },
  {
    id: 'p_robert_lewandowski',
    name: 'روبرت ليفاندوفسكي',
    photo: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_barcelona',
    clubs: ['لخ بوزنان', 'بوروسيا دورتموند', 'بايرن ميونخ', 'برشلونة'],
    nationalities: ['بولندا'],
    managers: ['كلوب', 'غوارديولا', 'أنشيلوتي', 'فليك'],
    trophies: ['دوري أبطال أوروبا', 'الدوري الألماني', 'الدوري الإسباني'],
    positions: ['FWD'],
    shirtNumbers: [9],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_pedri',
    name: 'بيدري غونزاليس',
    photo: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_barcelona',
    clubs: ['لاس بالماس', 'برشلونة'],
    nationalities: ['إسبانيا'],
    managers: ['تشافي', 'كومان', 'فليك', 'دي لا فوينتي'],
    trophies: ['كأس أمم أوروبا', 'الدوري الإسباني'],
    positions: ['MID'],
    shirtNumbers: [8, 16],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_lamine_yamal',
    name: 'لامين يامال',
    photo: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_barcelona',
    clubs: ['برشلونة'],
    nationalities: ['إسبانيا'],
    managers: ['تشافي', 'فليك', 'دي لا فوينتي'],
    trophies: ['كأس أمم أوروبا', 'الدوري الإسباني'],
    positions: ['FWD'],
    shirtNumbers: [19, 27],
    foot: 'left',
    skinTone: 'dark'
  },
  {
    id: 'p_sadio_mane',
    name: 'ساديو ماني',
    photo: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_nassr',
    clubs: ['ميتز', 'سالزبورغ', 'ساوثهامبتون', 'ليفربول', 'بايرن ميونخ', 'النصر'],
    nationalities: ['السنغال'],
    managers: ['كلوب', 'ناغلسمان', 'كاسترو', 'بيولي'],
    trophies: ['دوري أبطال أوروبا', 'الدوري الإنجليزي', 'الدوري الألماني', 'كأس أمم إفريقيا'],
    positions: ['FWD'],
    shirtNumbers: [10, 17],
    foot: 'right',
    skinTone: 'dark'
  },
  {
    id: 'p_marcelo_brozovic',
    name: 'مارسيلو بروزوفيتش',
    photo: 'https://images.unsplash.com/photo-1569517282132-25d22f4573e6?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_nassr',
    clubs: ['دينامو زغرب', 'إنتر ميلان', 'النصر'],
    nationalities: ['كرواتيا'],
    managers: ['كونتي', 'إنزاغي', 'داليتش'],
    trophies: ['الدوري الإيطالي', 'كأس إيطاليا'],
    positions: ['MID'],
    shirtNumbers: [77, 11],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_roberto_firmino',
    name: 'روبرتو فيرمينو',
    photo: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_ahli',
    clubs: ['فيغورينسي', 'هوفنهايم', 'ليفربول', 'الأهلي'],
    nationalities: ['البرازيل'],
    managers: ['كلوب', 'تيتي'],
    trophies: ['دوري أبطال أوروبا', 'الدوري الإنجليزي', 'كوبا أمريكا'],
    positions: ['FWD'],
    shirtNumbers: [9, 10, 11],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_franck_kessie',
    name: 'فرانك كيسيه',
    photo: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_ahli',
    clubs: ['أتالانتا', 'تشيزينا', 'ميلان', 'برشلونة', 'الأهلي'],
    nationalities: ['ساحل العاج'],
    managers: ['بيولي', 'تشافي', 'جايسله'],
    trophies: ['الدوري الإيطالي', 'الدوري الإسباني', 'كأس أمم إفريقيا'],
    positions: ['MID'],
    shirtNumbers: [79, 19, 8],
    foot: 'right',
    skinTone: 'dark'
  },
  {
    id: 'p_edouard_mendy',
    name: 'إدوارد ميندي',
    photo: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_ahli',
    clubs: ['شيربورغ', 'مارسيليا', 'ريمس', 'رين', 'تشيلسي', 'الأهلي'],
    nationalities: ['السنغال'],
    managers: ['توخيل', 'لامبارد'],
    trophies: ['دوري أبطال أوروبا', 'كأس أمم إفريقيا'],
    positions: ['GK'],
    shirtNumbers: [16, 1],
    foot: 'right',
    skinTone: 'dark'
  },
  {
    id: 'p_ruben_neves',
    name: 'روبن نيفيز',
    photo: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_hilal',
    clubs: ['بورتو', 'وولفرهامبتون', 'الهلال'],
    nationalities: ['البرتغال'],
    managers: ['جورجي جيسوس', 'نونو سانتو', 'سانتوس'],
    trophies: ['الدوري السعودي', 'دوري الأمم الأوروبية'],
    positions: ['MID'],
    shirtNumbers: [8, 6],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_sergej_milinkovic_savic',
    name: 'سيرجي سافيتش',
    photo: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_hilal',
    clubs: ['فويفودينا', 'جينك', 'لاتسيو', 'الهلال'],
    nationalities: ['صربيا'],
    managers: ['جورجي جيسوس', 'إنزاغي', 'ساري'],
    trophies: ['الدوري السعودي', 'كأس إيطاليا'],
    positions: ['MID'],
    shirtNumbers: [22, 21],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_kalidou_koulibaly',
    name: 'كاليدو كوليبالي',
    photo: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_hilal',
    clubs: ['ميتز', 'جينك', 'نابولي', 'تشيلسي', 'الهلال'],
    nationalities: ['السنغال'],
    managers: ['جورجي جيسوس', 'ساري', 'أنشيلوتي', 'سباليتي'],
    trophies: ['الدوري السعودي', 'كأس أمم إفريقيا', 'كأس إيطاليا'],
    positions: ['DEF'],
    shirtNumbers: [3, 26],
    foot: 'right',
    skinTone: 'dark'
  },
  {
    id: 'p_joao_cancelo',
    name: 'جواو كانسيلو',
    photo: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_hilal',
    clubs: ['بنفيكا', 'فالنسيا', 'إنتر ميلان', 'يوفنتوس', 'مانشستر سيتي', 'بايرن ميونخ', 'برشلونة', 'الهلال'],
    nationalities: ['البرتغال'],
    managers: ['جورجي جيسوس', 'غوارديولا', 'ناغلسمان', 'تشافي', 'أليغري'],
    trophies: ['الدوري الإنجليزي', 'الدوري الألماني', 'الدوري الإيطالي', 'الدوري البرتغالي'],
    positions: ['DEF'],
    shirtNumbers: [20, 7, 27],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_saud_abdulhamid',
    name: 'سعود عبد الحميد',
    photo: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_roma',
    clubs: ['الاتحاد', 'الهلال', 'روما'],
    nationalities: ['السعودية'],
    managers: ['جورجي جيسوس', 'دياز', 'رينارد', 'دي روسي'],
    trophies: ['دوري أبطال آسيا', 'الدوري السعودي'],
    positions: ['DEF'],
    shirtNumbers: [66, 12],
    foot: 'right',
    skinTone: 'dark'
  },
  {
    id: 'p_cole_palmer',
    name: 'كول بالمر',
    photo: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_chelsea',
    clubs: ['مانشستر سيتي', 'تشيلسي'],
    nationalities: ['إنجلترا'],
    managers: ['غوارديولا', 'بوتشيتينو', 'ماريسكا'],
    trophies: ['دوري أبطال أوروبا', 'الدوري الإنجليزي'],
    positions: ['MID', 'FWD'],
    shirtNumbers: [20, 80],
    foot: 'left',
    skinTone: 'light'
  },
  {
    id: 'p_bukayo_saka',
    name: 'بوكايو ساكا',
    photo: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_arsenal',
    clubs: ['أرسنال'],
    nationalities: ['إنجلترا'],
    managers: ['أرتيتا', 'ساوثغيت'],
    trophies: ['كأس الاتحاد الإنجليزي'],
    positions: ['FWD'],
    shirtNumbers: [7],
    foot: 'left',
    skinTone: 'dark'
  },
  {
    id: 'p_alison_becker',
    name: 'أليسون بيكر',
    photo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_liverpool',
    clubs: ['إنترناسيونال', 'روما', 'ليفربول'],
    nationalities: ['البرازيل'],
    managers: ['كلوب', 'تيتي', 'سباليتي'],
    trophies: ['دوري أبطال أوروبا', 'الدوري الإنجليزي', 'كوبا أمريكا'],
    positions: ['GK'],
    shirtNumbers: [1],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_manuel_neuer',
    name: 'مانويل نوير',
    photo: 'https://images.unsplash.com/photo-1516726817505-f5ed825624d8?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_bayern',
    clubs: ['شالكه', 'بايرن ميونخ'],
    nationalities: ['ألمانيا'],
    managers: ['غوارديولا', 'أنشيلوتي', 'هاينكس', 'فليك', 'لوف'],
    trophies: ['كأس العالم', 'دوري أبطال أوروبا', 'الدوري الألماني'],
    positions: ['GK'],
    shirtNumbers: [1],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_thomas_muller',
    name: 'توماس مولر',
    photo: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_bayern',
    clubs: ['بايرن ميونخ'],
    nationalities: ['ألمانيا'],
    managers: ['غوارديولا', 'أنشيلوتي', 'فليك', 'هاينكس', 'لوف'],
    trophies: ['كأس العالم', 'دوري أبطال أوروبا', 'الدوري الألماني'],
    positions: ['FWD', 'MID'],
    shirtNumbers: [25, 13],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_bruno_fernandes',
    name: 'برونو فيرنانديز',
    photo: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_man_united',
    clubs: ['نوفارا', 'أودينيزي', 'سامبدوريا', 'سبورتينغ لشبونة', 'مانشستر يونايتد'],
    nationalities: ['البرتغال'],
    managers: ['تين هاغ', 'سولشاير', 'سانتوس'],
    trophies: ['كأس الاتحاد الإنجليزي', 'دوري الأمم الأوروبية'],
    positions: ['MID'],
    shirtNumbers: [8, 18],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_marcus_rashford',
    name: 'ماركوس راشفورد',
    photo: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_man_united',
    clubs: ['مانشستر يونايتد'],
    nationalities: ['إنجلترا'],
    managers: ['مورينيو', 'سولشاير', 'تين هاغ'],
    trophies: ['الدوري الأوروبي', 'كأس الاتحاد الإنجليزي'],
    positions: ['FWD'],
    shirtNumbers: [10, 19],
    foot: 'right',
    skinTone: 'dark'
  },
  {
    id: 'p_achraf_hakimi',
    name: 'أشرف حكيمي',
    photo: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_psg',
    clubs: ['ريال مدريد', 'بوروسيا دورتموند', 'إنتر ميلان', 'باريس سان جيرمان'],
    nationalities: ['المغرب'],
    managers: ['زيدان', 'كونتي', 'إنريكي', 'الركراكي'],
    trophies: ['دوري أبطال أوروبا', 'الدوري الإيطالي', 'الدوري الفرنسي'],
    positions: ['DEF'],
    shirtNumbers: [2],
    foot: 'right',
    skinTone: 'dark'
  },
  {
    id: 'p_zinedine_zidane',
    name: 'زين الدين زيدان',
    photo: 'https://images.unsplash.com/photo-1516726817505-f5ed825624d8?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_real_madrid',
    clubs: ['كان', 'بوردو', 'يوفنتوس', 'ريال مدريد'],
    nationalities: ['فرنسا'],
    managers: ['ليبي', 'ديل بوسكي', 'جاكيه'],
    trophies: ['كأس العالم', 'دوري أبطال أوروبا', 'الكرة الذهبية', 'كأس أمم أوروبا', 'الدوري الإسباني', 'الدوري الإيطالي'],
    positions: ['MID'],
    shirtNumbers: [5, 10, 21],
    foot: 'right',
    skinTone: 'light'
  },
  {
    id: 'p_ronaldinho',
    name: 'رونالدينيو',
    photo: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=500&auto=format&fit=crop&q=80',
    currentClubBadge: 'c_barcelona',
    clubs: ['غريميو', 'باريس سان جيرمان', 'برشلونة', 'ميلان', 'فلامنغو', 'أتلتيكو مينيرو', 'كيريتارو'],
    nationalities: ['البرازيل'],
    managers: ['ريكارد', 'سكولاري', 'أنشيلوتي'],
    trophies: ['كأس العالم', 'دوري أبطال أوروبا', 'الكرة الذهبية', 'كوبا أمريكا', 'الدوري الإسباني', 'الدوري الإيطالي'],
    positions: ['FWD', 'MID'],
    shirtNumbers: [10, 80, 49],
    foot: 'right',
    skinTone: 'dark'
  }
];

// Generates a well-balanced 16-tile board with diverse categories
export const generatePlayerBingoBoard = (allTiles: BingoTileDefinition[] = BINGO_TILES_BANK): PlayerBingoTile[] => {
  // Ensure diversity across categories:
  // e.g., 4-5 clubs, 3-4 countries, 2 managers, 2 trophies, 2 numbers, 2 positions/traits
  const categories: BingoCategory[] = ['club', 'country', 'manager', 'trophy', 'position', 'number', 'trait'];
  const poolByCategory: Record<string, BingoTileDefinition[]> = {};

  categories.forEach(cat => {
    poolByCategory[cat] = allTiles.filter(t => t.category === cat);
  });

  const selectedTiles: BingoTileDefinition[] = [];
  const selectedIds = new Set<string>();

  const pickFromCategory = (cat: BingoCategory, count: number) => {
    const list = [...(poolByCategory[cat] || [])].sort(() => 0.5 - Math.random());
    let added = 0;
    for (const item of list) {
      if (added >= count) break;
      if (!selectedIds.has(item.id)) {
        selectedIds.add(item.id);
        selectedTiles.push(item);
        added++;
      }
    }
  };

  // Balanced quota for 16 slots
  pickFromCategory('club', 4);
  pickFromCategory('country', 3);
  pickFromCategory('trophy', 2);
  pickFromCategory('manager', 2);
  pickFromCategory('number', 2);
  pickFromCategory('position', 2);
  pickFromCategory('trait', 1);

  // If still less than 16, fill with random unique tiles from allTiles
  if (selectedTiles.length < 16) {
    const remaining = [...allTiles].sort(() => 0.5 - Math.random());
    for (const item of remaining) {
      if (selectedTiles.length >= 16) break;
      if (!selectedIds.has(item.id)) {
        selectedIds.add(item.id);
        selectedTiles.push(item);
      }
    }
  }

  // Shuffle the final 16 tiles across the grid
  const shuffledBoard = [...selectedTiles].sort(() => 0.5 - Math.random()).slice(0, 16);

  return shuffledBoard.map((definition, index) => ({
    index,
    definition,
    isClaimed: false
  }));
};

// Immediate sub-millisecond evaluation
export const evaluateTileMatch = (
  player: ActiveFootballer,
  tile: BingoTileDefinition
): boolean => {
  if (!player || !tile) return false;

  switch (tile.category) {
    case 'club':
      return player.clubs.includes(tile.targetValue as string);
    case 'country':
      return player.nationalities.includes(tile.targetValue as string);
    case 'manager':
      return player.managers.includes(tile.targetValue as string);
    case 'trophy':
      return player.trophies.includes(tile.targetValue as string);
    case 'position':
      return player.positions.includes(tile.targetValue as string);
    case 'number':
      return player.shirtNumbers.includes(tile.targetValue as number);
    case 'trait':
      if (tile.targetValue === 'left_foot') return player.foot === 'left';
      if (tile.targetValue === 'right_foot') return player.foot === 'right';
      if (tile.targetValue === 'dark_skin') return player.skinTone === 'dark';
      return false;
    default:
      return false;
  }
};

// Pattern Verification: Rows, Columns, Diagonals, and 4 Corners
export const checkBingoWin = (board: PlayerBingoTile[]): boolean => {
  if (!board || board.length < 16) return false;
  const claimed = board.map((t) => t.isClaimed);

  // Rows (4)
  for (let r = 0; r < 4; r++) {
    const start = r * 4;
    if (claimed[start] && claimed[start + 1] && claimed[start + 2] && claimed[start + 3]) return true;
  }

  // Columns (4)
  for (let c = 0; c < 4; c++) {
    if (claimed[c] && claimed[c + 4] && claimed[c + 8] && claimed[c + 12]) return true;
  }

  // Diagonals (2)
  if (claimed[0] && claimed[5] && claimed[10] && claimed[15]) return true;
  if (claimed[3] && claimed[6] && claimed[9] && claimed[12]) return true;

  // 4 Corners (1)
  if (claimed[0] && claimed[3] && claimed[12] && claimed[15]) return true;

  return false;
};
