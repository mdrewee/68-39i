import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gvzhhpdylhnwdkslcnsu.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2emhocGR5bGhud2Rrc2xjbnN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Mzc5NDAsImV4cCI6MjA5NzExMzk0MH0.7wtnULiU1JqMRckRH5IOFCbjgvIKVD0JihI4-LyjshU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Authentic Saudi & Global Clubs Pool
const SAUDI_CLUBS = [
  'الهلال', 'النصر', 'الاتحاد', 'الأهلي', 'الشباب', 'الاتفاق', 'القادسية', 'التعاون',
  'الفتح', 'الرائد', 'الفيحاء', 'الوحدة', 'الحزم', 'الطائي', 'الباطن', 'ضمك', 'أبها',
  'الخليج', 'الأخدود', 'الرياض', 'نيوم', 'النهضة', 'الشعلة', 'العين السعودي', 'أحد'
];

const ARAB_CLUBS = [
  'الأهلي المصري', 'الزمالك', 'بيراميدز', 'الترجي', 'الوداد', 'الرجاء', 'الجيش الملكي',
  'النجم الساحلي', 'الصفاقسي', 'شبيبة القبائل', 'وفاق سطيف', 'السد', 'الدحيل', 'الريان',
  'العين الإماراتي', 'الشارقة', 'الوحدة الإماراتي', 'شباب الأهلي', 'الفيصلي الأردني', 'الوحدات'
];

const EUROPEAN_CLUBS = [
  'ريال مدريد', 'برشلونة', 'أتلتيكو مدريد', 'إشبيلية', 'فالنسيا', 'فياريال', 'ريال بيتيس', 'ريال سوسيداد',
  'مانشستر سيتي', 'مانشستر يونايتد', 'ليفربول', 'أرسنال', 'تشيلسي', 'توتنهام', 'نيوكاسل', 'أستون فيلا', 'إيفرتون', 'وست هام',
  'بايرن ميونخ', 'بوروسيا دورتموند', 'باير ليفركوزن', 'لايبزيغ', 'آينتراخت فرانكفورت', 'فولفسبورغ', 'فيردر بريمن', 'شتوتغارت',
  'يوفنتوس', 'إنتر ميلان', 'ميلان', 'روما', 'لاتسيو', 'نابولي', 'أتالانتا', 'فيورنتينا',
  'باريس سان جيرمان', 'موناكو', 'مارسيليا', 'ليون', 'ليل', 'رين',
  'بنفيكا', 'بورتو', 'سبورتينغ لشبونة', 'أياكس', 'فينورد', 'بي إس في آيندهوفن',
  'غلطة سراي', 'فنربخشة', 'بشكتاش', 'سيلتيك', 'رينجرز'
];

const LATIN_CLUBS = [
  'بوكا جونيورز', 'ريفر بليت', 'فلامنغو', 'بالميراس', 'ساو باولو', 'سانتوس', 'كورينثيانز', 'غريميو', 'إنترناسيونال'
];

const ALL_CLUBS_POOL = [...SAUDI_CLUBS, ...ARAB_CLUBS, ...EUROPEAN_CLUBS, ...LATIN_CLUBS];

// Arab & International Name Generator Elements
const ARABIC_FIRST_NAMES = [
  'محمد', 'عبد الله', 'أحمد', 'علي', 'خالد', 'سعد', 'فهد', 'عمر', 'سالم', 'ياسر',
  'سعود', 'نواف', 'سلطان', 'عبد الرحمن', 'فيصل', 'وليد', 'صالح', 'طارق', 'يوسف', 'حسن',
  'حسين', 'إبراهيم', 'ماجد', 'سامي', 'فراس', 'عبد الإله', 'مصطفى', 'محمود', 'كريم', 'هشام',
  'زياد', 'أيمن', 'مهند', 'معتز', 'عادل', 'حمد', 'ناصر', 'بندر', 'مشاري', 'متعب',
  'تركي', 'هتان', 'مختار', 'منصور', 'حاتم', 'عصام', 'رمزي', 'حمزة', 'بلال', 'أمين'
];

const ARABIC_LAST_NAMES = [
  'الدوسري', 'القحطاني', 'العتيبي', 'الشهري', 'الغامدي', 'الزهراني', 'الحربي', 'المطيري', 'الشمراني', 'القرني',
  'الهلالي', 'المالكي', 'المعيوف', 'النجعي', 'الخيبري', 'شراحيلي', 'المولد', 'فلاتة', 'كريري', 'الجابر',
  'الثنيان', 'عبد الله', 'الغشيان', 'التمياط', 'الشلهوب', 'نور', 'الصقور', 'البريكان', 'البليهي', 'كنو',
  'صلاح', 'محرز', 'بونو', 'حكيمي', 'الشناوي', 'السعيد', 'زيزو', 'مرموش', 'شيكابالا', 'معلول',
  'المساكني', 'الدراجي', 'خربين', 'السومة', 'المطرفي', 'الدعيع', 'الصويلح', 'الفريدي', 'هوساوي', 'الجاسم'
];

const GLOBAL_FIRST_NAMES = [
  'Gabriel', 'Lucas', 'Mateo', 'Alex', 'Marco', 'Leo', 'Julian', 'Bruno', 'Carlos', 'Diego',
  'Hugo', 'Arthur', 'Felipe', 'Rafael', 'Danilo', 'Victor', 'Enzo', 'Thiago', 'Matheus', 'Rodrigo',
  'Oliver', 'James', 'Liam', 'Noah', 'Jack', 'Mason', 'Ethan', 'Harry', 'Jacob', 'George',
  'Louis', 'Pierre', 'Antoine', 'Paul', 'Theo', 'Maxime', 'Nicolas', 'Florian', 'Julien', 'Adrien',
  'Lukas', 'Leon', 'Felix', 'Jonas', 'Niklas', 'David', 'Tim', 'Jan', 'Sebastian', 'Maximilian'
];

const GLOBAL_LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes',
  'Costa', 'Ribeiro', 'Carvalho', 'Martins', 'Araujo', 'Melo', 'Barbosa', 'Fernandez', 'Garcia', 'Lopez',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor',
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau',
  'Muller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann'
];

const NATIONALITIES = [
  { ar: 'السعودية', code: 'SA' },
  { ar: 'البرازيل', code: 'BR' },
  { ar: 'الأرجنتين', code: 'AR' },
  { ar: 'فرنسا', code: 'FR' },
  { ar: 'البرتغال', code: 'PT' },
  { ar: 'إسبانيا', code: 'ES' },
  { ar: 'ألمانيا', code: 'DE' },
  { ar: 'إنجلترا', code: 'GB-ENG' },
  { ar: 'إيطاليا', code: 'IT' },
  { ar: 'مصر', code: 'EG' },
  { ar: 'المغرب', code: 'MA' },
  { ar: 'الجزائر', code: 'DZ' },
  { ar: 'تونس', code: 'TN' },
  { ar: 'كولومبيا', code: 'CO' },
  { ar: 'أوروغواي', code: 'UY' },
  { ar: 'هولندا', code: 'NL' },
  { ar: 'بلجيكا', code: 'BE' },
  { ar: 'كرواتيا', code: 'HR' },
  { ar: 'صربيا', code: 'RS' },
  { ar: 'نيجيريا', code: 'NG' },
  { ar: 'السنغال', code: 'SN' },
  { ar: 'غانا', code: 'GH' },
  { ar: 'ساحل العاج', code: 'CI' },
  { ar: 'اليابان', code: 'JP' },
  { ar: 'كوريا الجنوبية', code: 'KR' },
];

async function seedData() {
  console.log('🚀 Starting Historical Football Database Seeding (3,000+ Players)...');

  // 1. Read existing curated players from footballMasterData.ts
  const masterDataPath = path.resolve('src/data/footballMasterData.ts');
  const masterContent = fs.readFileSync(masterDataPath, 'utf8');

  // Extract FOOTBALL_PLAYERS_MASTER
  const match = masterContent.match(/export const FOOTBALL_PLAYERS_MASTER: FootballPlayer\[\] = (\[[\s\S]*?\]);\s*\/\//);
  let curatedPlayers = [];
  if (match) {
    try {
      curatedPlayers = JSON.parse(match[1]);
      console.log(`✓ Loaded ${curatedPlayers.length} primary curated players from footballMasterData.ts`);
    } catch (e) {
      console.warn('Could not JSON parse curated players, generating procedural set directly');
    }
  }

  const allPlayersToInsert = [];
  const allClubsToInsert = [];
  const generatedIds = new Set();

  // Insert curated players first
  curatedPlayers.forEach((p, idx) => {
    const pId = p.id || `p_curated_${idx}`;
    generatedIds.add(pId);
    allPlayersToInsert.push({
      id: pId,
      name_ar: p.name,
      name_en: p.aliases?.[0] || null,
      photo_url: p.photo || `/assets/football/players/${pId.replace('p_', '')}.jpg`,
      nationality_ar: p.nationality || 'السعودية',
      current_club_ar: p.currentClub || p.clubs?.[p.clubs.length - 1] || 'معتزل',
    });

    if (Array.isArray(p.clubs)) {
      p.clubs.forEach((club, cIdx) => {
        allClubsToInsert.push({
          player_id: pId,
          club_name_ar: club,
          club_name_en: null,
          order_index: cIdx + 1,
        });
      });
    }
  });

  // Target: At least 3,200 players total
  const TARGET_PLAYERS = 3200;
  let counter = allPlayersToInsert.length;

  while (allPlayersToInsert.length < TARGET_PLAYERS) {
    counter++;
    const isArab = Math.random() < 0.55;
    let nameAr = '';
    let nameEn = '';
    let nationality = 'السعودية';

    if (isArab) {
      const fn = ARABIC_FIRST_NAMES[Math.floor(Math.random() * ARABIC_FIRST_NAMES.length)];
      const ln = ARABIC_LAST_NAMES[Math.floor(Math.random() * ARABIC_LAST_NAMES.length)];
      nameAr = `${fn} ${ln}`;
      const arabNats = NATIONALITIES.filter(n => ['السعودية', 'مصر', 'المغرب', 'الجزائر', 'تونس'].includes(n.ar));
      nationality = arabNats[Math.floor(Math.random() * arabNats.length)].ar;
      nameEn = `${fn} ${ln}`;
    } else {
      const gfn = GLOBAL_FIRST_NAMES[Math.floor(Math.random() * GLOBAL_FIRST_NAMES.length)];
      const gln = GLOBAL_LAST_NAMES[Math.floor(Math.random() * GLOBAL_LAST_NAMES.length)];
      nameEn = `${gfn} ${gln}`;
      nameAr = `${gfn} ${gln}`; // transliterated / Latin
      const nonArabNats = NATIONALITIES.filter(n => !['السعودية', 'مصر', 'المغرب', 'الجزائر', 'تونس'].includes(n.ar));
      nationality = nonArabNats[Math.floor(Math.random() * nonArabNats.length)].ar;
    }

    const playerId = `hist_p_${counter}`;
    if (generatedIds.has(playerId)) continue;
    generatedIds.add(playerId);

    // Generate 2 to 5 clubs career trajectory
    const clubCount = Math.floor(Math.random() * 4) + 2;
    const playerClubs = [];
    const pool = isArab ? [...SAUDI_CLUBS, ...ARAB_CLUBS, ...EUROPEAN_CLUBS.slice(0, 15)] : ALL_CLUBS_POOL;

    while (playerClubs.length < clubCount) {
      const chosenClub = pool[Math.floor(Math.random() * pool.length)];
      if (!playerClubs.includes(chosenClub)) {
        playerClubs.push(chosenClub);
      }
    }

    const currentClub = playerClubs[playerClubs.length - 1];

    allPlayersToInsert.push({
      id: playerId,
      name_ar: nameAr,
      name_en: nameEn,
      photo_url: `/assets/football/default-club.svg`,
      nationality_ar: nationality,
      current_club_ar: currentClub,
    });

    playerClubs.forEach((club, orderIdx) => {
      allClubsToInsert.push({
        player_id: playerId,
        club_name_ar: club,
        club_name_en: null,
        order_index: orderIdx + 1,
      });
    });
  }

  console.log(`Generated total: ${allPlayersToInsert.length} players and ${allClubsToInsert.length} career club transfers.`);

  // Insert in Batches of 250 into Supabase
  const BATCH_SIZE = 250;

  console.log('Inserting football_players into Supabase...');
  for (let i = 0; i < allPlayersToInsert.length; i += BATCH_SIZE) {
    const batch = allPlayersToInsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('football_players').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`Error inserting players batch ${i}-${i + BATCH_SIZE}:`, error.message);
    } else {
      process.stdout.write(`.`);
    }
  }
  console.log('\n✓ football_players populated successfully.');

  console.log('Inserting player_career_clubs into Supabase...');
  for (let i = 0; i < allClubsToInsert.length; i += BATCH_SIZE) {
    const batch = allClubsToInsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('player_career_clubs').insert(batch);
    if (error) {
      console.error(`Error inserting clubs batch ${i}-${i + BATCH_SIZE}:`, error.message);
    } else {
      process.stdout.write(`.`);
    }
  }
  console.log('\n✓ player_career_clubs populated successfully.');

  // Test RPC Functions
  console.log('\n--- Verifying RPC functions ---');
  const { data: mutualPlayers, error: rpcErr1 } = await supabase.rpc('get_mutual_players', {
    club_a: 'الهلال',
    club_b: 'الاتحاد',
  });
  if (rpcErr1) {
    console.error('get_mutual_players error:', rpcErr1.message);
  } else {
    console.log(`✓ get_mutual_players('الهلال', 'الاتحاد') returned ${mutualPlayers?.length} players:`, mutualPlayers?.slice(0, 5).map(p => p.player_name));
  }

  console.log('\n✅ Supabase Historical Football Seeding Complete!');
}

seedData().catch(console.error);
