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
  iconUrl: string; // Image URL / SVG URL / Emoji
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
  clubs: string[];
  nationalities: string[];
  managers: string[];
  trophies: string[];
  positions: string[];
  shirtNumbers: number[];
  foot: 'left' | 'right';
  skinTone: 'dark' | 'light';
}

// -------------------------------------------------------------
// Authentic Visual Tiles Bank (Real Wikimedia / Flag CDN Assets)
// -------------------------------------------------------------
export const BINGO_TILES_BANK: BingoTileDefinition[] = [
  // --- الأندية (Real Club Logos) ---
  {
    id: 'club_real_madrid',
    category: 'club',
    targetValue: 'real_madrid',
    label: 'ريال مدريد',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
  },
  {
    id: 'club_barcelona',
    category: 'club',
    targetValue: 'barcelona',
    label: 'برشلونة',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
  },
  {
    id: 'club_al_hilal',
    category: 'club',
    targetValue: 'al_hilal',
    label: 'الهلال',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/en/b/b5/Al_Hilal_SFC_logo.svg',
  },
  {
    id: 'club_al_nassr',
    category: 'club',
    targetValue: 'al_nassr',
    label: 'النصر',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a4/Al-Nassr_FC_logo.svg',
  },
  {
    id: 'club_al_ittihad',
    category: 'club',
    targetValue: 'al_ittihad',
    label: 'الاتحاد',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/en/6/6c/Al-Ittihad_Club_logo.svg',
  },
  {
    id: 'club_al_ahli',
    category: 'club',
    targetValue: 'al_ahli',
    label: 'الأهلي السعودي',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a2/Al-Ahli_Saudi_FC_logo.svg',
  },
  {
    id: 'club_man_city',
    category: 'club',
    targetValue: 'man_city',
    label: 'مانشستر سيتي',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
  },
  {
    id: 'club_man_united',
    category: 'club',
    targetValue: 'man_united',
    label: 'مانشستر يونايتد',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg',
  },
  {
    id: 'club_bayern',
    category: 'club',
    targetValue: 'bayern',
    label: 'بايرن ميونخ',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg',
  },
  {
    id: 'club_psg',
    category: 'club',
    targetValue: 'psg',
    label: 'باريس سان جيرمان',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',
  },
  {
    id: 'club_liverpool',
    category: 'club',
    targetValue: 'liverpool',
    label: 'ليفربول',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
  },
  {
    id: 'club_arsenal',
    category: 'club',
    targetValue: 'arsenal',
    label: 'أرسنال',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
  },
  {
    id: 'club_chelsea',
    category: 'club',
    targetValue: 'chelsea',
    label: 'تشيلسي',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg',
  },
  {
    id: 'club_juventus',
    category: 'club',
    targetValue: 'juventus',
    label: 'يوفنتوس',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Juventus_FC_2017_icon_%28black%29.svg',
  },
  {
    id: 'club_milan',
    category: 'club',
    targetValue: 'milan',
    label: 'ميلان',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg',
  },
  {
    id: 'club_inter',
    category: 'club',
    targetValue: 'inter',
    label: 'إنتر ميلان',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg',
  },

  // --- المنتخبات والأعلام (Real National Flags) ---
  {
    id: 'flag_sa',
    category: 'country',
    targetValue: 'saudi',
    label: 'السعودية',
    iconUrl: 'https://flagcdn.com/w160/sa.png',
  },
  {
    id: 'flag_br',
    category: 'country',
    targetValue: 'brazil',
    label: 'البرازيل',
    iconUrl: 'https://flagcdn.com/w160/br.png',
  },
  {
    id: 'flag_ar',
    category: 'country',
    targetValue: 'argentina',
    label: 'الأرجنتين',
    iconUrl: 'https://flagcdn.com/w160/ar.png',
  },
  {
    id: 'flag_fr',
    category: 'country',
    targetValue: 'france',
    label: 'فرنسا',
    iconUrl: 'https://flagcdn.com/w160/fr.png',
  },
  {
    id: 'flag_pt',
    category: 'country',
    targetValue: 'portugal',
    label: 'البرتغال',
    iconUrl: 'https://flagcdn.com/w160/pt.png',
  },
  {
    id: 'flag_es',
    category: 'country',
    targetValue: 'spain',
    label: 'إسبانيا',
    iconUrl: 'https://flagcdn.com/w160/es.png',
  },
  {
    id: 'flag_de',
    category: 'country',
    targetValue: 'germany',
    label: 'ألمانيا',
    iconUrl: 'https://flagcdn.com/w160/de.png',
  },
  {
    id: 'flag_eg',
    category: 'country',
    targetValue: 'egypt',
    label: 'مصر',
    iconUrl: 'https://flagcdn.com/w160/eg.png',
  },
  {
    id: 'flag_ma',
    category: 'country',
    targetValue: 'morocco',
    label: 'المغرب',
    iconUrl: 'https://flagcdn.com/w160/ma.png',
  },
  {
    id: 'flag_hr',
    category: 'country',
    targetValue: 'croatia',
    label: 'كرواتيا',
    iconUrl: 'https://flagcdn.com/w160/hr.png',
  },

  // --- الكؤوس والبطولات (Trophies) ---
  {
    id: 'trophy_world_cup',
    category: 'trophy',
    targetValue: 'world_cup',
    label: 'كأس العالم',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/FIFA_World_Cup_Trophy.svg/440px-FIFA_World_Cup_Trophy.svg.png',
  },
  {
    id: 'trophy_ucl',
    category: 'trophy',
    targetValue: 'ucl',
    label: 'دوري أبطال أوروبا',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/UEFA_Champions_League_logo_2.svg/440px-UEFA_Champions_League_logo_2.svg.png',
  },
  {
    id: 'trophy_ballon_dor',
    category: 'trophy',
    targetValue: 'ballon_dor',
    label: 'الكرة الذهبية',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Ballon_d%27Or_vector_logo.svg/440px-Ballon_d%27Or_vector_logo.svg.png',
  },
  {
    id: 'trophy_copa_america',
    category: 'trophy',
    targetValue: 'copa_america',
    label: 'كوبا أمريكا',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/07/2024_Copa_Am%C3%A9rica_logo.svg/440px-2024_Copa_Am%C3%A9rica_logo.svg.png',
  },

  // --- المدربون (Real Manager Headshots) ---
  {
    id: 'mgr_guardiola',
    category: 'manager',
    targetValue: 'guardiola',
    label: 'بيب غوارديولا',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Pep_Guardiola_2017.jpg/360px-Pep_Guardiola_2017.jpg',
  },
  {
    id: 'mgr_ancelotti',
    category: 'manager',
    targetValue: 'ancelotti',
    label: 'كارلو أنشيلوتي',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Carlo_Ancelotti_2022.jpg/360px-Carlo_Ancelotti_2022.jpg',
  },
  {
    id: 'mgr_mourinho',
    category: 'manager',
    targetValue: 'mourinho',
    label: 'جوزيه مورينيو',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Jos%C3%A9_Mourinho_2019.jpg/360px-Jos%C3%A9_Mourinho_2019.jpg',
  },
  {
    id: 'mgr_jesus',
    category: 'manager',
    targetValue: 'jesus',
    label: 'جورجي جيسوس',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Jorge_Jesus_2019.jpg/360px-Jorge_Jesus_2019.jpg',
  },
  {
    id: 'mgr_zidane',
    category: 'manager',
    targetValue: 'zidane',
    label: 'زين الدين زيدان',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Zinedine_Zidane_by_Tasnim_03.jpg/360px-Zinedine_Zidane_by_Tasnim_03.jpg',
  },

  // --- المراكز والأرقام والصفات ---
  { id: 'pos_gk', category: 'position', targetValue: 'GK', label: 'حارس مرمى', iconUrl: '🧤' },
  { id: 'pos_fwd', category: 'position', targetValue: 'FWD', label: 'مهاجم', iconUrl: '⚡' },
  { id: 'pos_def', category: 'position', targetValue: 'DEF', label: 'مدافع', iconUrl: '🛡️' },
  { id: 'num_7', category: 'number', targetValue: 7, label: 'رقم 7', iconUrl: '7️⃣' },
  { id: 'num_10', category: 'number', targetValue: 10, label: 'رقم 10', iconUrl: '🔟' },
  { id: 'trait_left', category: 'trait', targetValue: 'left_foot', label: 'أشول (قدم يسرى)', iconUrl: '🦶' },
  { id: 'trait_dark', category: 'trait', targetValue: 'dark_skin', label: 'لاعب أسمر', iconUrl: '🏿' },
];

// -------------------------------------------------------------
// Massive Real Players Bank (FOOTBALLERS_BINGO_MASTER)
// -------------------------------------------------------------
export const FOOTBALLERS_BINGO_MASTER: ActiveFootballer[] = [
  {
    id: 'ronaldo',
    name: 'كريستيانو رونالدو',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Cristiano_Ronaldo_playing_for_Al_Nassr_FC_against_Persepolis%2C_September_2023_%28cropped%29.jpg/440px-Cristiano_Ronaldo_playing_for_Al_Nassr_FC_against_Persepolis%2C_September_2023_%28cropped%29.jpg',
    clubs: ['al_nassr', 'real_madrid', 'man_united', 'juventus', 'sporting'],
    nationalities: ['portugal'],
    managers: ['ferguson', 'mourinho', 'zidane', 'ancelotti'],
    trophies: ['ucl', 'ballon_dor'],
    positions: ['FWD'],
    shirtNumbers: [7, 9],
    foot: 'right',
    skinTone: 'light',
  },
  {
    id: 'messi',
    name: 'ليونيل ميسي',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg/440px-Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg',
    clubs: ['barcelona', 'psg', 'inter_miami'],
    nationalities: ['argentina'],
    managers: ['guardiola'],
    trophies: ['world_cup', 'ucl', 'copa_america', 'ballon_dor'],
    positions: ['FWD'],
    shirtNumbers: [10, 30],
    foot: 'left',
    skinTone: 'light',
  },
  {
    id: 'salem_aldawsari',
    name: 'سالم الدوسري',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Salem_Al-Dawsari_2018.jpg/440px-Salem_Al-Dawsari_2018.jpg',
    clubs: ['al_hilal', 'villarreal'],
    nationalities: ['saudi'],
    managers: ['jesus'],
    trophies: ['ucl'], // AFC Champions
    positions: ['FWD'],
    shirtNumbers: [29, 10, 7],
    foot: 'right',
    skinTone: 'dark',
  },
  {
    id: 'benzema',
    name: 'كريم بنزيما',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Karim_Benzema_wearing_Real_Madrid_home_kit_2021-2022.jpg/440px-Karim_Benzema_wearing_Real_Madrid_home_kit_2021-2022.jpg',
    clubs: ['al_ittihad', 'real_madrid', 'lyon'],
    nationalities: ['france'],
    managers: ['zidane', 'ancelotti', 'mourinho'],
    trophies: ['ucl', 'ballon_dor'],
    positions: ['FWD'],
    shirtNumbers: [9, 10],
    foot: 'right',
    skinTone: 'light',
  },
  {
    id: 'kante',
    name: 'نغولو كانتي',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/N%27Golo_Kant%C3%A9_2018.jpg/440px-N%27Golo_Kant%C3%A9_2018.jpg',
    clubs: ['al_ittihad', 'chelsea', 'leicester'],
    nationalities: ['france'],
    managers: ['mourinho', 'ancelotti'],
    trophies: ['world_cup', 'ucl'],
    positions: ['MID'],
    shirtNumbers: [7, 14],
    foot: 'right',
    skinTone: 'dark',
  },
  {
    id: 'neymar',
    name: 'نيمار جونيور',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Bra-Cos_%281%29_%28cropped%29.jpg/440px-Bra-Cos_%281%29_%28cropped%29.jpg',
    clubs: ['al_hilal', 'psg', 'barcelona', 'santos'],
    nationalities: ['brazil'],
    managers: ['jesus'],
    trophies: ['ucl', 'copa_america'],
    positions: ['FWD'],
    shirtNumbers: [10, 11],
    foot: 'right',
    skinTone: 'dark',
  },
  {
    id: 'mahrez',
    name: 'رياض محرز',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Riyad_Mahrez_2018.jpg/440px-Riyad_Mahrez_2018.jpg',
    clubs: ['al_ahli', 'man_city', 'leicester'],
    nationalities: ['algeria'],
    managers: ['guardiola'],
    trophies: ['ucl'],
    positions: ['FWD'],
    shirtNumbers: [7, 26],
    foot: 'left',
    skinTone: 'light',
  },
  {
    id: 'modric',
    name: 'لوكا مودريتش',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Luka_Modri%C4%87_Interview_2021_%28cropped%29.jpg/440px-Luka_Modri%C4%87_Interview_2021_%28cropped%29.jpg',
    clubs: ['real_madrid', 'tottenham', 'dinamo_zagreb'],
    nationalities: ['croatia'],
    managers: ['zidane', 'ancelotti', 'mourinho'],
    trophies: ['ucl', 'ballon_dor'],
    positions: ['MID'],
    shirtNumbers: [10, 14],
    foot: 'right',
    skinTone: 'light',
  },
  {
    id: 'vinicius',
    name: 'فينيسيوس جونيور',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Vinicius_Junior_2021.jpg/440px-Vinicius_Junior_2021.jpg',
    clubs: ['real_madrid', 'flamengo'],
    nationalities: ['brazil'],
    managers: ['ancelotti', 'zidane'],
    trophies: ['ucl'],
    positions: ['FWD'],
    shirtNumbers: [7, 20],
    foot: 'right',
    skinTone: 'dark',
  },
  {
    id: 'haaland',
    name: 'إيرلينغ هالاند',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Erling_Haaland_2023_%28cropped%29.jpg/440px-Erling_Haaland_2023_%28cropped%29.jpg',
    clubs: ['man_city', 'dortmund', 'salzburg'],
    nationalities: ['norway'],
    managers: ['guardiola'],
    trophies: ['ucl'],
    positions: ['FWD'],
    shirtNumbers: [9],
    foot: 'left',
    skinTone: 'light',
  },
  {
    id: 'albulayhi',
    name: 'علي البليهي',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Ali_Al-Bulaihi_2018.jpg/440px-Ali_Al-Bulaihi_2018.jpg',
    clubs: ['al_hilal', 'al_fateh'],
    nationalities: ['saudi'],
    managers: ['jesus'],
    trophies: ['ucl'],
    positions: ['DEF'],
    shirtNumbers: [5],
    foot: 'left',
    skinTone: 'dark',
  },
  {
    id: 'alharbi_firas',
    name: 'فراس البريكان',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Firas_Al-Buraikan_2022.jpg/440px-Firas_Al-Buraikan_2022.jpg',
    clubs: ['al_ahli', 'al_fateh', 'al_nassr'],
    nationalities: ['saudi'],
    managers: [],
    trophies: [],
    positions: ['FWD'],
    shirtNumbers: [9, 20],
    foot: 'left',
    skinTone: 'light',
  },
  {
    id: 'muller',
    name: 'توماس مولر',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Thomas_M%C3%BCller_2019.jpg/440px-Thomas_M%C3%BCller_2019.jpg',
    clubs: ['bayern'],
    nationalities: ['germany'],
    managers: ['guardiola', 'ancelotti'],
    trophies: ['world_cup', 'ucl'],
    positions: ['FWD', 'MID'],
    shirtNumbers: [25, 13],
    foot: 'right',
    skinTone: 'light',
  },
  {
    id: 'kroos',
    name: 'توني كروس',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Toni_Kroos_2019.jpg/440px-Toni_Kroos_2019.jpg',
    clubs: ['real_madrid', 'bayern', 'leverkusen'],
    nationalities: ['germany'],
    managers: ['zidane', 'ancelotti', 'guardiola'],
    trophies: ['world_cup', 'ucl'],
    positions: ['MID'],
    shirtNumbers: [8],
    foot: 'right',
    skinTone: 'light',
  },
  {
    id: 'mbappe',
    name: 'كيليان مبابي',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/2019-07-17_SG_Dynamo_Dresden_vs._Paris_Saint-Germain_by_Sandro_Halank%E2%80%93129_%28cropped%29.jpg/440px-2019-07-17_SG_Dynamo_Dresden_vs._Paris_Saint-Germain_by_Sandro_Halank%E2%80%93129_%28cropped%29.jpg',
    clubs: ['real_madrid', 'psg', 'monaco'],
    nationalities: ['france'],
    managers: ['ancelotti'],
    trophies: ['world_cup'],
    positions: ['FWD'],
    shirtNumbers: [7, 9, 10],
    foot: 'right',
    skinTone: 'dark',
  },
  {
    id: 'salah',
    name: 'محمد صلاح',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Mohamed_Salah_2018.jpg/440px-Mohamed_Salah_2018.jpg',
    clubs: ['liverpool', 'roma', 'chelsea', 'basel'],
    nationalities: ['egypt'],
    managers: ['mourinho'],
    trophies: ['ucl'],
    positions: ['FWD'],
    shirtNumbers: [11, 10],
    foot: 'left',
    skinTone: 'dark',
  },
  {
    id: 'courtois',
    name: 'تيبو كورتوا',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Thibaut_Courtois_2018.jpg/440px-Thibaut_Courtois_2018.jpg',
    clubs: ['real_madrid', 'chelsea', 'atletico_madrid'],
    nationalities: ['belgium'],
    managers: ['zidane', 'ancelotti', 'mourinho'],
    trophies: ['ucl'],
    positions: ['GK'],
    shirtNumbers: [1],
    foot: 'left',
    skinTone: 'light',
  },
  {
    id: 'bounou',
    name: 'ياسين بونو',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Yassine_Bounou_2022.jpg/440px-Yassine_Bounou_2022.jpg',
    clubs: ['al_hilal', 'sevilla', 'girona', 'atletico_madrid'],
    nationalities: ['morocco'],
    managers: ['jesus'],
    trophies: [],
    positions: ['GK'],
    shirtNumbers: [37, 13, 1],
    foot: 'right',
    skinTone: 'light',
  },
  {
    id: 'debruyne',
    name: 'كيفين دي بروين',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Kevin_De_Bruyne_201807091.jpg/440px-Kevin_De_Bruyne_201807091.jpg',
    clubs: ['man_city', 'chelsea', 'wolfsburg', 'genk'],
    nationalities: ['belgium'],
    managers: ['guardiola', 'mourinho'],
    trophies: ['ucl'],
    positions: ['MID'],
    shirtNumbers: [17, 7],
    foot: 'right',
    skinTone: 'light',
  },
  {
    id: 'sadio_mane',
    name: 'ساديو ماني',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Sadio_Man%C3%A9_2018.jpg/440px-Sadio_Man%C3%A9_2018.jpg',
    clubs: ['al_nassr', 'liverpool', 'bayern', 'southampton', 'salzburg'],
    nationalities: ['senegal'],
    managers: [],
    trophies: ['ucl'],
    positions: ['FWD'],
    shirtNumbers: [10, 17],
    foot: 'right',
    skinTone: 'dark',
  },
  {
    id: 'firmino',
    name: 'روبرتو فيرمينو',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Roberto_Firmino_2018.jpg/440px-Roberto_Firmino_2018.jpg',
    clubs: ['al_ahli', 'liverpool', 'hoffenheim'],
    nationalities: ['brazil'],
    managers: [],
    trophies: ['ucl', 'copa_america'],
    positions: ['FWD'],
    shirtNumbers: [9, 10],
    foot: 'right',
    skinTone: 'light',
  },
  {
    id: 'kessie',
    name: 'فرانك كيسيه',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Franck_Kessi%C3%A9_2019.jpg/440px-Franck_Kessi%C3%A9_2019.jpg',
    clubs: ['al_ahli', 'barcelona', 'milan', 'atalanta'],
    nationalities: ['ivory_coast'],
    managers: [],
    trophies: [],
    positions: ['MID'],
    shirtNumbers: [79, 19],
    foot: 'right',
    skinTone: 'dark',
  },
  {
    id: 'edouard_mendy',
    name: 'إدوارد ميندي',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/%C3%89douard_Mendy_2022.jpg/440px-%C3%89douard_Mendy_2022.jpg',
    clubs: ['al_ahli', 'chelsea', 'rennes'],
    nationalities: ['senegal'],
    managers: [],
    trophies: ['ucl'],
    positions: ['GK'],
    shirtNumbers: [16, 1],
    foot: 'right',
    skinTone: 'dark',
  },
  {
    id: 'ruben_neves',
    name: 'روبن نيفيز',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/R%C3%BAben_Neves_2018.jpg/440px-R%C3%BAben_Neves_2018.jpg',
    clubs: ['al_hilal', 'porto', 'wolves'],
    nationalities: ['portugal'],
    managers: ['jesus'],
    trophies: [],
    positions: ['MID'],
    shirtNumbers: [8],
    foot: 'right',
    skinTone: 'light',
  },
  {
    id: 'mitrovic',
    name: 'ألكسندر ميتروفيتش',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Aleksandar_Mitrovi%C4%87_2018.jpg/440px-Aleksandar_Mitrovi%C4%87_2018.jpg',
    clubs: ['al_hilal', 'fulham', 'newcastle', 'anderlecht'],
    nationalities: ['serbia'],
    managers: ['jesus'],
    trophies: [],
    positions: ['FWD'],
    shirtNumbers: [9, 45],
    foot: 'right',
    skinTone: 'light',
  },
  {
    id: 'koulibaly',
    name: 'كاليدو كوليبالي',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Kalidou_Koulibaly_2018.jpg/440px-Kalidou_Koulibaly_2018.jpg',
    clubs: ['al_hilal', 'chelsea', 'napoli'],
    nationalities: ['senegal'],
    managers: ['jesus', 'ancelotti'],
    trophies: [],
    positions: ['DEF'],
    shirtNumbers: [3, 26],
    foot: 'right',
    skinTone: 'dark',
  },
  {
    id: 'cancelo',
    name: 'جواو كانسيلو',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Jo%C3%A3o_Cancelo_2018.jpg/440px-Jo%C3%A3o_Cancelo_2018.jpg',
    clubs: ['al_hilal', 'barcelona', 'bayern', 'man_city', 'juventus', 'inter'],
    nationalities: ['portugal'],
    managers: ['guardiola', 'jesus'],
    trophies: [],
    positions: ['DEF'],
    shirtNumbers: [20, 7],
    foot: 'right',
    skinTone: 'light',
  },
  {
    id: 'saud_abdulhamid',
    name: 'سعود عبد الحميد',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Saud_Abdulhamid_2022.jpg/440px-Saud_Abdulhamid_2022.jpg',
    clubs: ['al_hilal', 'al_ittihad', 'roma'],
    nationalities: ['saudi'],
    managers: ['jesus'],
    trophies: ['ucl'],
    positions: ['DEF'],
    shirtNumbers: [66, 12],
    foot: 'right',
    skinTone: 'dark',
  },
  {
    id: 'bellingham',
    name: 'جود بيلينغهام',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Jude_Bellingham_2023.jpg/440px-Jude_Bellingham_2023.jpg',
    clubs: ['real_madrid', 'dortmund', 'birmingham'],
    nationalities: ['england'],
    managers: ['ancelotti'],
    trophies: ['ucl'],
    positions: ['MID'],
    shirtNumbers: [5, 22, 10],
    foot: 'right',
    skinTone: 'dark',
  },
  {
    id: 'lewandowski',
    name: 'روبرت ليفاندوفسكي',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Robert_Lewandowski_2019.jpg/440px-Robert_Lewandowski_2019.jpg',
    clubs: ['barcelona', 'bayern', 'dortmund'],
    nationalities: ['poland'],
    managers: ['guardiola', 'ancelotti'],
    trophies: ['ucl'],
    positions: ['FWD'],
    shirtNumbers: [9],
    foot: 'right',
    skinTone: 'light',
  },
  {
    id: 'palmer',
    name: 'كول بالمر',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Cole_Palmer_2023.jpg/440px-Cole_Palmer_2023.jpg',
    clubs: ['chelsea', 'man_city'],
    nationalities: ['england'],
    managers: ['guardiola'],
    trophies: ['ucl'],
    positions: ['MID', 'FWD'],
    shirtNumbers: [20, 80],
    foot: 'left',
    skinTone: 'light',
  },
  {
    id: 'saka',
    name: 'بوكايو ساكا',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Bukayo_Saka_2022.jpg/440px-Bukayo_Saka_2022.jpg',
    clubs: ['arsenal'],
    nationalities: ['england'],
    managers: [],
    trophies: [],
    positions: ['FWD'],
    shirtNumbers: [7],
    foot: 'left',
    skinTone: 'dark',
  },
  {
    id: 'neuer',
    name: 'مانويل نوير',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Manuel_Neuer_2019.jpg/440px-Manuel_Neuer_2019.jpg',
    clubs: ['bayern', 'schalke'],
    nationalities: ['germany'],
    managers: ['guardiola', 'ancelotti'],
    trophies: ['world_cup', 'ucl'],
    positions: ['GK'],
    shirtNumbers: [1],
    foot: 'right',
    skinTone: 'light',
  },
  {
    id: 'hakimi',
    name: 'أشرف حكيمي',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Achraf_Hakimi_2018.jpg/440px-Achraf_Hakimi_2018.jpg',
    clubs: ['psg', 'inter', 'dortmund', 'real_madrid'],
    nationalities: ['morocco'],
    managers: ['zidane'],
    trophies: ['ucl'],
    positions: ['DEF'],
    shirtNumbers: [2],
    foot: 'right',
    skinTone: 'dark',
  },
  {
    id: 'zidane_player',
    name: 'زين الدين زيدان',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Zinedine_Zidane_by_Tasnim_03.jpg/360px-Zinedine_Zidane_by_Tasnim_03.jpg',
    clubs: ['real_madrid', 'juventus', 'bordeaux'],
    nationalities: ['france'],
    managers: [],
    trophies: ['world_cup', 'ucl', 'ballon_dor'],
    positions: ['MID'],
    shirtNumbers: [5, 10],
    foot: 'right',
    skinTone: 'light',
  },
  {
    id: 'ronaldinho',
    name: 'رونالدينيو',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Ronaldinho_2019.jpg/440px-Ronaldinho_2019.jpg',
    clubs: ['barcelona', 'milan', 'psg', 'flamengo'],
    nationalities: ['brazil'],
    managers: ['ancelotti'],
    trophies: ['world_cup', 'ucl', 'copa_america', 'ballon_dor'],
    positions: ['FWD', 'MID'],
    shirtNumbers: [10, 80],
    foot: 'right',
    skinTone: 'dark',
  },
  {
    id: 'ramos',
    name: 'سيرخيو راموس',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Sergio_Ramos_2018.jpg/440px-Sergio_Ramos_2018.jpg',
    clubs: ['real_madrid', 'psg', 'sevilla'],
    nationalities: ['spain'],
    managers: ['zidane', 'ancelotti', 'mourinho'],
    trophies: ['world_cup', 'ucl'],
    positions: ['DEF'],
    shirtNumbers: [4, 15],
    foot: 'right',
    skinTone: 'light',
  },
  {
    id: 'alisson',
    name: 'أليسون بيكر',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Alisson_Becker_2018.jpg/440px-Alisson_Becker_2018.jpg',
    clubs: ['liverpool', 'roma', 'internacional'],
    nationalities: ['brazil'],
    managers: [],
    trophies: ['ucl', 'copa_america'],
    positions: ['GK'],
    shirtNumbers: [1],
    foot: 'right',
    skinTone: 'light',
  },
];

// Backwards compatibility alias
export const FOOTBALL_BINGO_PLAYERS = FOOTBALLERS_BINGO_MASTER;

// Generates a well-balanced 16-tile board with diverse categories
export const generatePlayerBingoBoard = (allTiles: BingoTileDefinition[] = BINGO_TILES_BANK): PlayerBingoTile[] => {
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

  // Quotas for balanced 16-slot grid
  pickFromCategory('club', 4);
  pickFromCategory('country', 3);
  pickFromCategory('trophy', 2);
  pickFromCategory('manager', 2);
  pickFromCategory('number', 2);
  pickFromCategory('position', 2);
  pickFromCategory('trait', 1);

  // Fallback to reach 16 tiles
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

  const shuffledBoard = [...selectedTiles].sort(() => 0.5 - Math.random()).slice(0, 16);

  return shuffledBoard.map((definition, index) => ({
    index,
    definition,
    isClaimed: false,
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
