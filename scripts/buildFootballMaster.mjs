import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const OUTPUT_JSON_PATH = path.resolve('src/data/footballHistoricalMaster.json');
const CLUBS_DIR = path.resolve('public/assets/football/clubs');
const PLAYERS_DIR = path.resolve('public/assets/football/players');

[CLUBS_DIR, PLAYERS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Optional Asset Downloader Utility
 */
export const downloadAsset = (url, destPath) => {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 500) {
      return resolve(destPath);
    }

    const client = url.startsWith('https') ? https : http;
    const request = client.get(url, { headers: { 'User-Agent': USER_AGENT } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadAsset(response.headers.location, destPath).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Status ${response.statusCode}`));
      }
      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
    });

    request.on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
};

// 1. Mandatory Clubs Scope:
// - الدوري السعودي (10 أندية)
// - الدوري الإنجليزي (الـ 20 نادياً كاملة)
// - الدوري الهولندي (أشهر الأندية: أياكس، آيندهوفن، فاينورد)
// - عمالقة أوروبا (19 نادياً)
export const CLUBS_SCOPE = [
  // --- الدوري السعودي (10 أندية) ---
  {
    id: 'c_hilal',
    name: 'الهلال',
    aliases: ['الزعيم', 'الموج الازرق', 'Al Hilal', 'Al-Hilal', 'الهلال السعودي'],
    badgeUrl: '/assets/football/clubs/al_hilal.png',
    primaryColor: '#0047AB'
  },
  {
    id: 'c_nassr',
    name: 'النصر',
    aliases: ['العالمي', 'فارس نجد', 'Al Nassr', 'Al-Nassr', 'النصر السعودي'],
    badgeUrl: '/assets/football/clubs/al_nassr.png',
    primaryColor: '#FCD116'
  },
  {
    id: 'c_ittihad',
    name: 'الاتحاد',
    aliases: ['العميد', 'النمور', 'Al Ittihad', 'Al-Ittihad', 'اتحاد جده'],
    badgeUrl: '/assets/football/clubs/al_ittihad.png',
    primaryColor: '#FED100'
  },
  {
    id: 'c_ahli',
    name: 'الأهلي',
    aliases: ['الراقي', 'قلعة الكؤوس', 'Al Ahli', 'Al-Ahli', 'الاهلي السعودي', 'الاهلي'],
    badgeUrl: '/assets/football/clubs/al_ahli.png',
    primaryColor: '#006400'
  },
  {
    id: 'c_shabab',
    name: 'الشباب',
    aliases: ['الليث', 'Al Shabab', 'Al-Shabab', 'شيخ الانديه'],
    badgeUrl: '/assets/football/clubs/al_shabab.png',
    primaryColor: '#2C2A29'
  },
  {
    id: 'c_ettifaq',
    name: 'الاتفاق',
    aliases: ['فارس الدهناء', 'Al Ettifaq', 'Al-Ettifaq', 'كوماندوز الشرقيه'],
    badgeUrl: '/assets/football/clubs/al_ettifaq.png',
    primaryColor: '#008000'
  },
  {
    id: 'c_taawoun',
    name: 'التعاون',
    aliases: ['سكري القصيم', 'Al Taawoun', 'Al-Taawoun', 'ذئاب بريده'],
    badgeUrl: '/assets/football/clubs/al_taawoun.png',
    primaryColor: '#FFFF00'
  },
  {
    id: 'c_fateh',
    name: 'الفتح',
    aliases: ['النموذجي', 'Al Fateh', 'Al-Fateh', 'ابناء النخيل'],
    badgeUrl: '/assets/football/clubs/al_fateh.png',
    primaryColor: '#0000FF'
  },
  {
    id: 'c_wehda',
    name: 'الوحدة',
    aliases: ['فرسان مكة', 'فرسان مكه', 'Al Wehda', 'Al-Wehda', 'الوحده'],
    badgeUrl: '/assets/football/clubs/al_wehda.png',
    primaryColor: '#FF0000'
  },
  {
    id: 'c_qadsiah',
    name: 'القادسية',
    aliases: ['بنو قادس', 'Al Qadsiah', 'Al-Qadsiah', 'القادسيه', 'فخر الشرقيه'],
    badgeUrl: '/assets/football/clubs/al_qadsiah.png',
    primaryColor: '#C68B59'
  },

  // --- الدوري الإنجليزي (الـ 20 نادياً كاملة) ---
  {
    id: 'c_man_city',
    name: 'مانشستر سيتي',
    aliases: ['السيتي', 'Man City', 'Manchester City', 'مان سيتي'],
    badgeUrl: '/assets/football/clubs/man_city.png',
    primaryColor: '#6CABDD'
  },
  {
    id: 'c_arsenal',
    name: 'أرسنال',
    aliases: ['المدفعجية', 'المدفعجيه', 'الارسنال', 'Arsenal', 'آرسنال', 'الغانرز'],
    badgeUrl: '/assets/football/clubs/arsenal.png',
    primaryColor: '#EF0107'
  },
  {
    id: 'c_liverpool',
    name: 'ليفربول',
    aliases: ['الريدز', 'Liverpool', 'الليفربول'],
    badgeUrl: '/assets/football/clubs/liverpool.png',
    primaryColor: '#C8102E'
  },
  {
    id: 'c_aston_villa',
    name: 'أستون فيلا',
    aliases: ['الفيلانز', 'Aston Villa', 'استون فيلا'],
    badgeUrl: '/assets/football/clubs/aston_villa.png',
    primaryColor: '#95BFE5'
  },
  {
    id: 'c_tottenham',
    name: 'توتنهام',
    aliases: ['السبيرز', 'Tottenham', 'توتنهام هوتسبير', 'spurs'],
    badgeUrl: '/assets/football/clubs/tottenham.png',
    primaryColor: '#132257'
  },
  {
    id: 'c_chelsea',
    name: 'تشيلسي',
    aliases: ['البلوز', 'Chelsea', 'فخر لندن'],
    badgeUrl: '/assets/football/clubs/chelsea.png',
    primaryColor: '#034694'
  },
  {
    id: 'c_newcastle',
    name: 'نيوكاسل يونايتد',
    aliases: ['نيوكاسل', 'Newcastle', 'Newcastle United', 'الماكبايس'],
    badgeUrl: '/assets/football/clubs/newcastle.png',
    primaryColor: '#241F20'
  },
  {
    id: 'c_man_united',
    name: 'مانشستر يونايتد',
    aliases: ['اليونايتد', 'Man United', 'Manchester United', 'الشياطين الحمر'],
    badgeUrl: '/assets/football/clubs/man_united.png',
    primaryColor: '#DA291C'
  },
  {
    id: 'c_west_ham',
    name: 'وست هام',
    aliases: ['الهامرز', 'West Ham', 'وست هام يونايتد'],
    badgeUrl: '/assets/football/clubs/west_ham.png',
    primaryColor: '#7A263A'
  },
  {
    id: 'c_crystal_palace',
    name: 'كريستال بالاس',
    aliases: ['Crystal Palace', 'بالاس', 'النسور'],
    badgeUrl: '/assets/football/clubs/crystal_palace.png',
    primaryColor: '#1B458F'
  },
  {
    id: 'c_brighton',
    name: 'برايتون',
    aliases: ['Brighton', 'برايتون أند هوف ألبيون', 'طيور النورس'],
    badgeUrl: '/assets/football/clubs/brighton.png',
    primaryColor: '#0057B8'
  },
  {
    id: 'c_bournemouth',
    name: 'بورنموث',
    aliases: ['Bournemouth', 'الكرز'],
    badgeUrl: '/assets/football/clubs/bournemouth.png',
    primaryColor: '#DA291C'
  },
  {
    id: 'c_fulham',
    name: 'فولهام',
    aliases: ['Fulham', 'الكوتاجرز'],
    badgeUrl: '/assets/football/clubs/fulham.png',
    primaryColor: '#000000'
  },
  {
    id: 'c_wolves',
    name: 'وولفرهامبتون',
    aliases: ['الوولفز', 'Wolves', 'Wolverhampton', 'الذئاب'],
    badgeUrl: '/assets/football/clubs/wolves.png',
    primaryColor: '#FDB913'
  },
  {
    id: 'c_everton',
    name: 'إيفرتون',
    aliases: ['التوفيز', 'Everton', 'ايفرتون'],
    badgeUrl: '/assets/football/clubs/everton.png',
    primaryColor: '#003399'
  },
  {
    id: 'c_brentford',
    name: 'برينتفورد',
    aliases: ['Brentford', 'النحل'],
    badgeUrl: '/assets/football/clubs/brentford.png',
    primaryColor: '#D20000'
  },
  {
    id: 'c_nottingham',
    name: 'نوتينغهام فورست',
    aliases: ['نوتنغهام', 'Nottingham Forest', 'نوتنجهام فورست', 'نوتينجهام'],
    badgeUrl: '/assets/football/clubs/nottingham.png',
    primaryColor: '#DD0000'
  },
  {
    id: 'c_leicester',
    name: 'ليستر سيتي',
    aliases: ['الثعالب', 'Leicester City', 'ليستر'],
    badgeUrl: '/assets/football/clubs/leicester.png',
    primaryColor: '#003090'
  },
  {
    id: 'c_southampton',
    name: 'ساوثهامبتون',
    aliases: ['القديسون', 'Southampton', 'ساوثامبتون'],
    badgeUrl: '/assets/football/clubs/southampton.png',
    primaryColor: '#D71920'
  },
  {
    id: 'c_ipswich',
    name: 'إيبسويتش تاون',
    aliases: ['Ipswich Town', 'ايبسويتش', 'إبسويتش'],
    badgeUrl: '/assets/football/clubs/ipswich.png',
    primaryColor: '#0000FF'
  },

  // --- الدوري الهولندي (أشهر الأندية) ---
  {
    id: 'c_ajax',
    name: 'أياكس أمستردام',
    aliases: ['أياكس', 'اياكس', 'Ajax', 'Ajax Amsterdam'],
    badgeUrl: '/assets/football/clubs/ajax.png',
    primaryColor: '#D2122E'
  },
  {
    id: 'c_psv',
    name: 'بي إس في آيندهوفن',
    aliases: ['آيندهوفن', 'ايندهوفن', 'PSV', 'PSV Eindhoven'],
    badgeUrl: '/assets/football/clubs/psv.png',
    primaryColor: '#FF0000'
  },
  {
    id: 'c_feyenoord',
    name: 'فاينورد روتردام',
    aliases: ['فاينورد', 'فينورد', 'Feyenoord'],
    badgeUrl: '/assets/football/clubs/feyenoord.png',
    primaryColor: '#FF0000'
  },

  // --- عمالقة أوروبا (19 نادياً) ---
  {
    id: 'c_real_madrid',
    name: 'ريال مدريد',
    aliases: ['الريال', 'الملكي', 'Real Madrid', 'الميرنغي', 'الميرينغي'],
    badgeUrl: '/assets/football/clubs/real_madrid.png',
    primaryColor: '#FEBE10'
  },
  {
    id: 'c_barcelona',
    name: 'برشلونة',
    aliases: ['البارسا', 'البرشا', 'Barcelona', 'FC Barcelona', 'برشلونه'],
    badgeUrl: '/assets/football/clubs/barcelona.png',
    primaryColor: '#004D98'
  },
  {
    id: 'c_atletico_madrid',
    name: 'أتلتيكو مدريد',
    aliases: ['الأتليتي', 'الروخي بلانكوس', 'Atletico Madrid', 'أتلتيكو', 'اتلتيكو'],
    badgeUrl: '/assets/football/clubs/atletico.png',
    primaryColor: '#CB3524'
  },
  {
    id: 'c_sevilla',
    name: 'إشبيلية',
    aliases: ['Sevilla', 'اشبيلية', 'اشبيليه', 'إشبيليه'],
    badgeUrl: '/assets/football/clubs/sevilla.png',
    primaryColor: '#D4001F'
  },
  {
    id: 'c_villarreal',
    name: 'فياريال',
    aliases: ['الغواصات الصفراء', 'Villarreal'],
    badgeUrl: '/assets/football/clubs/villarreal.png',
    primaryColor: '#FFE600'
  },
  {
    id: 'c_bayern',
    name: 'بايرن ميونخ',
    aliases: ['البافاري', 'Bayern Munich', 'بايرن', 'البايرن'],
    badgeUrl: '/assets/football/clubs/bayern.png',
    primaryColor: '#DC052D'
  },
  {
    id: 'c_dortmund',
    name: 'بوروسيا دورتموند',
    aliases: ['دورتموند', 'Dortmund', 'Borussia Dortmund', 'الجراد الاصفر'],
    badgeUrl: '/assets/football/clubs/dortmund.png',
    primaryColor: '#FDE100'
  },
  {
    id: 'c_leverkusen',
    name: 'باير ليفركوزن',
    aliases: ['ليفركوزن', 'Leverkusen', 'Bayer Leverkusen'],
    badgeUrl: '/assets/football/clubs/leverkusen.png',
    primaryColor: '#E32221'
  },
  {
    id: 'c_psg',
    name: 'باريس سان جيرمان',
    aliases: ['باريس', 'PSG', 'Paris Saint-Germain', 'بي اس جي'],
    badgeUrl: '/assets/football/clubs/psg.png',
    primaryColor: '#004170'
  },
  {
    id: 'c_marseille',
    name: 'مارسيليا',
    aliases: ['Marseille', 'Olympique Marseille', 'اولمبيك مارسيليا'],
    badgeUrl: '/assets/football/clubs/marseille.png',
    primaryColor: '#00A3E0'
  },
  {
    id: 'c_lyon',
    name: 'ليون',
    aliases: ['Lyon', 'Olympique Lyonnais', 'اولمبيك ليون'],
    badgeUrl: '/assets/football/clubs/lyon.png',
    primaryColor: '#1D428A'
  },
  {
    id: 'c_juventus',
    name: 'يوفنتوس',
    aliases: ['اليوفي', 'السيدة العجوز', 'Juventus', 'البيانكونيري'],
    badgeUrl: '/assets/football/clubs/juventus.png',
    primaryColor: '#000000'
  },
  {
    id: 'c_milan',
    name: 'ميلان',
    aliases: ['الروسونيري', 'Milan', 'AC Milan', 'اي سي ميلان'],
    badgeUrl: '/assets/football/clubs/ac_milan.png',
    primaryColor: '#FB090B'
  },
  {
    id: 'c_inter',
    name: 'إنتر ميلان',
    aliases: ['الإنتر', 'الانتر', 'Inter', 'Inter Milan', 'النيراتزوري'],
    badgeUrl: '/assets/football/clubs/inter.png',
    primaryColor: '#001489'
  },
  {
    id: 'c_roma',
    name: 'روما',
    aliases: ['الذئاب', 'Roma', 'AS Roma', 'الجيلاروسي'],
    badgeUrl: '/assets/football/clubs/roma.png',
    primaryColor: '#8E1F2F'
  },
  {
    id: 'c_napoli',
    name: 'نابولي',
    aliases: ['Napoli', 'البارتينوبي'],
    badgeUrl: '/assets/football/clubs/napoli.png',
    primaryColor: '#003B94'
  },
  {
    id: 'c_sporting',
    name: 'سبورتينغ لشبونة',
    aliases: ['سبورتينغ', 'Sporting CP', 'سبورتنج لشبونة', 'الاسود'],
    badgeUrl: '/assets/football/clubs/sporting.png',
    primaryColor: '#008057'
  },
  {
    id: 'c_benfica',
    name: 'بنفيكا',
    aliases: ['النسور', 'Benfica', 'بنفيكا لشبونة'],
    badgeUrl: '/assets/football/clubs/benfica.png',
    primaryColor: '#E81B23'
  },
  {
    id: 'c_porto',
    name: 'بورتو',
    aliases: ['التنانين', 'Porto', 'FC Porto'],
    badgeUrl: '/assets/football/clubs/porto.png',
    primaryColor: '#003399'
  }
];

// Helper to normalize arabic
export const normalizeArabic = (text) => {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/^ال/g, '')
    .replace(/[\u064B-\u065F\u0670]/g, '');
};

/**
 * Build and save offline master database
 */
async function buildMaster() {
  console.log('⚡ Building footballHistoricalMaster.json...');

  // 1. Read existing curated players from footballMasterData.ts
  let curatedPlayers = [];
  try {
    const masterPath = path.resolve('src/data/footballMasterData.ts');
    const content = fs.readFileSync(masterPath, 'utf8');
    const startTag = 'export const FOOTBALL_PLAYERS_MASTER';
    const eqIdx = content.indexOf('=', content.indexOf(startTag));
    const bracketIdx = content.indexOf('[', eqIdx);
    const endIdx = content.lastIndexOf('];', content.indexOf('export const LOCAL_CLUB_LOGOS'));
    const jsonStr = content.substring(bracketIdx, endIdx + 1);
    curatedPlayers = JSON.parse(jsonStr);
    console.log(`✓ Read ${curatedPlayers.length} existing curated players from footballMasterData.ts`);
  } catch (err) {
    console.warn('Could not parse footballMasterData.ts directly:', err.message);
  }

  // 2. Comprehensive additional authentic legends and transfers to ensure EVERY pair across the 52 clubs is represented
  const ADDITIONAL_HISTORICAL_PLAYERS = [
    // --- الهلال & الاتحاد & النصر & الأهلي & الشباب ---
    {
      id: 'p_saud_abdulhamid',
      name: 'سعود عبدالحميد',
      aliases: ['سعود عبد الحميد', 'سعود', 'عبدالحميد', 'عبد الحميد', 'saud'],
      photo: '/assets/football/players/saud_abdulhamid.jpg',
      clubs: ['الاتحاد', 'الهلال', 'روما']
    },
    {
      id: 'p_ahmed_sharahili',
      name: 'أحمد شراحيلي',
      aliases: ['شراحيلي', 'احمد شراحيلي', 'أحمد شراحيلي', 'sharahili'],
      photo: 'https://cdn.sofifa.net/players/226/102/25_120.png',
      clubs: ['الهلال', 'الفتح', 'الشباب', 'الاتحاد']
    },
    {
      id: 'p_mokhtar_fallatah',
      name: 'مختار فلاتة',
      aliases: ['مختار فلاته', 'مختار', 'فلاته', 'فلاتة', 'المخ'],
      photo: 'https://cdn.sofifa.net/players/211/264/25_120.png',
      clubs: ['الوحدة', 'الشباب', 'الاتحاد', 'الهلال']
    },
    {
      id: 'p_abdullah_almayouf',
      name: 'عبدالله المعيوف',
      aliases: ['المعيوف', 'عبد الله المعيوف', 'عبدالله المعيوف', 'راعي المعروف'],
      photo: 'https://cdn.sofifa.net/players/202/641/25_120.png',
      clubs: ['الهلال', 'الأهلي', 'الاتحاد', 'الشباب']
    },
    {
      id: 'p_bader_alnakhli',
      name: 'بدر النخلي',
      aliases: ['النخلي', 'بدر', 'بدر النخلي'],
      photo: 'https://cdn.sofifa.net/players/211/270/25_120.png',
      clubs: ['الفتح', 'الاتحاد', 'الباطن']
    },
    {
      id: 'p_essa_almehyani',
      name: 'عيسى المحياني',
      aliases: ['المحياني', 'عيسى', 'عيسى المحياني'],
      photo: 'https://cdn.sofifa.net/players/202/645/25_120.png',
      clubs: ['الوحدة', 'الهلال', 'الأهلي', 'الشباب', 'الاتحاد']
    },
    {
      id: 'p_ahmed_aldokhi',
      name: 'أحمد الدوخي',
      aliases: ['الدوخي', 'احمد الدوخي', 'أحمد الدوخي'],
      photo: 'https://cdn.sofifa.net/players/142/982/25_120.png',
      clubs: ['الهلال', 'الاتحاد', 'النصر']
    },
    {
      id: 'p_khamis_alowairan',
      name: 'خميس العويران',
      aliases: ['العويران', 'خميس', 'خميس العويران'],
      photo: 'https://cdn.sofifa.net/players/142/981/25_120.png',
      clubs: ['الهلال', 'الاتحاد']
    },
    {
      id: 'p_abdulmalek_alkhaibri',
      name: 'عبدالملك الخيبري',
      aliases: ['الخيبري', 'عبد الملك الخيبري', 'عبدالملك الخيبري'],
      photo: 'https://cdn.sofifa.net/players/211/277/25_120.png',
      clubs: ['القادسية', 'الشباب', 'الهلال']
    },
    {
      id: 'p_luis_enrique',
      name: 'لويس إنريكي',
      aliases: ['إنريكي', 'انريكي', 'luis enrique'],
      photo: 'https://cdn.sofifa.net/players/000/124/25_120.png',
      clubs: ['سبورتينغ خيخون', 'ريال مدريد', 'برشلونة']
    },
    {
      id: 'p_michael_laudrup',
      name: 'مايكل لاودروب',
      aliases: ['لاودروب', 'laudrup'],
      photo: 'https://cdn.sofifa.net/players/000/320/25_120.png',
      clubs: ['يوفنتوس', 'لاتسيو', 'برشلونة', 'ريال مدريد', 'أياكس أمستردام']
    },
    {
      id: 'p_javier_saviola',
      name: 'خافيير سافيولا',
      aliases: ['سافيولا', 'الأرنب', 'saviola'],
      photo: 'https://cdn.sofifa.net/players/045/661/25_120.png',
      clubs: ['ريفر بليت', 'برشلونة', 'موناكو', 'إشبيلية', 'ريال مدريد', 'بنفيكا', 'مالاغا', 'أولمبياكوس', 'فيرونا']
    },
    {
      id: 'p_bernd_schuster',
      name: 'بيرند شوستر',
      aliases: ['شوستر', 'schuster'],
      photo: 'https://cdn.sofifa.net/players/000/115/25_120.png',
      clubs: ['كولن', 'برشلونة', 'ريال مدريد', 'أتلتيكو مدريد', 'باير ليفركوزن']
    },
    {
      id: 'p_gheorghe_hagi',
      name: 'جورجي هاجي',
      aliases: ['هاجي', 'مارادونا البلقان', 'hagi'],
      photo: 'https://cdn.sofifa.net/players/000/017/25_120.png',
      clubs: ['فارول كونستانتسا', 'ستيوا بوخارست', 'ريال مدريد', 'بريشيا', 'برشلونة', 'غلطة سراي']
    },
    {
      id: 'p_saad_alharthi',
      name: 'سعد الحارثي',
      aliases: ['سعد الذباح', 'الحارثي'],
      photo: 'https://cdn.sofifa.net/players/165/143/25_120.png',
      clubs: ['النصر', 'الاتحاد', 'الهلال']
    },
    {
      id: 'p_ahmed_alfraidi',
      name: 'أحمد الفريدي',
      aliases: ['الفريدي', 'احمد الفريدي'],
      photo: 'https://cdn.sofifa.net/players/193/784/25_120.png',
      clubs: ['الهلال', 'الاتحاد', 'النصر', 'القادسية']
    },
    {
      id: 'p_fahad_alghashayan',
      name: 'فهد الغشيان',
      aliases: ['الغشيان', 'فهد'],
      photo: 'https://cdn.sofifa.net/players/142/984/25_120.png',
      clubs: ['الهلال', 'إي زد ألكمار', 'النصر']
    },
    {
      id: 'p_ali_albulayhi',
      name: 'علي البليهي',
      aliases: ['البليهي', 'ابو هادي', 'bulayhi'],
      photo: '/assets/football/players/albulayhi.jpg',
      clubs: ['النهضة', 'الفتح', 'الهلال']
    },
    {
      id: 'p_ali_lajami',
      name: 'علي لاجامي',
      aliases: ['لاجامي', 'علي لاجامي'],
      photo: 'https://cdn.sofifa.net/players/246/300/25_120.png',
      clubs: ['الخليج', 'الفتح', 'النصر']
    },
    {
      id: 'p_abdulelah_alamri',
      name: 'عبدالإله العمري',
      aliases: ['العمري', 'عبد الاله العمري'],
      photo: 'https://cdn.sofifa.net/players/246/301/25_120.png',
      clubs: ['النصر', 'الوحدة', 'الاتحاد']
    },
    {
      id: 'p_abdullah_otayf',
      name: 'عبدالله عطيف',
      aliases: ['عطيف', 'عبد الله عطيف'],
      photo: 'https://cdn.sofifa.net/players/216/394/25_120.png',
      clubs: ['الشباب', 'لوليانو', 'الهلال', 'الأهلي']
    },
    {
      id: 'p_nasser_alshamrani',
      name: 'ناصر الشمراني',
      aliases: ['الشمراني', 'الزلزال'],
      photo: 'https://cdn.sofifa.net/players/193/781/25_120.png',
      clubs: ['الوحدة', 'الشباب', 'الهلال', 'العين الإماراتي', 'الاتحاد']
    },
    {
      id: 'p_hattan_bahebri',
      name: 'هتان باهبري',
      aliases: ['باهبري', 'هتان'],
      photo: 'https://cdn.sofifa.net/players/211/276/25_120.png',
      clubs: ['الاتحاد', 'الخليج', 'الشباب', 'الهلال', 'التعاون']
    },
    {
      id: 'p_moteb_alharbi',
      name: 'متعب الحربي',
      aliases: ['الحربي', 'متعب'],
      photo: 'https://cdn.sofifa.net/players/263/952/25_120.png',
      clubs: ['الشباب', 'الهلال']
    },
    {
      id: 'p_musab_aljuwayr',
      name: 'مصعب الجوير',
      aliases: ['الجوير', 'مصعب'],
      photo: 'https://cdn.sofifa.net/players/265/294/25_120.png',
      clubs: ['الهلال', 'الشباب']
    },
    {
      id: 'p_abdufattah_asiri',
      name: 'عبدالفتاح عسيري',
      aliases: ['عسيري', 'عبد الفتاح عسيري'],
      photo: 'https://cdn.sofifa.net/players/216/397/25_120.png',
      clubs: ['الاتحاد', 'الأهلي', 'النصر', 'الطائي']
    },
    {
      id: 'p_haroune_camara',
      name: 'هارون كمارا',
      aliases: ['كمارا', 'هارون'],
      photo: 'https://cdn.sofifa.net/players/243/245/25_120.png',
      clubs: ['القادسية', 'الاتحاد', 'الاتفاق', 'الشباب']
    },
    {
      id: 'p_firas_alburaikan',
      name: 'فراس البريكان',
      aliases: ['البريكان', 'فراس', 'العازف'],
      photo: '/assets/football/players/alburaikan.jpg',
      clubs: ['النصر', 'الفتح', 'الأهلي']
    },
    {
      id: 'p_mohamed_kanno',
      name: 'محمد كنو',
      aliases: ['كنو', 'محمد كنو'],
      photo: 'https://cdn.sofifa.net/players/237/681/25_120.png',
      clubs: ['الاتفاق', 'الهلال']
    },
    {
      id: 'p_salem_aldawsari',
      name: 'سالم الدوسري',
      aliases: ['سالم', 'التورنيدو', 'الدوسري'],
      photo: '/assets/football/players/salem_aldawsari.jpg',
      clubs: ['الهلال', 'فياريال']
    },

    // --- الدوري الإنجليزي & عمالقة أوروبا & هولندا ---
    {
      id: 'p_cristiano_ronaldo',
      name: 'كريستيانو رونالدو',
      aliases: ['رونالدو', 'الدون', 'صاروخ ماديرا', 'CR7', 'cristiano'],
      photo: '/assets/football/players/ronaldo.jpg',
      clubs: ['سبورتينغ لشبونة', 'مانشستر يونايتد', 'ريال مدريد', 'يوفنتوس', 'النصر']
    },
    {
      id: 'p_lionel_messi',
      name: 'ليونيل ميسي',
      aliases: ['ميسي', 'البرغوث', 'ليو', 'messi'],
      photo: '/assets/football/players/messi.jpg',
      clubs: ['برشلونة', 'باريس سان جيرمان']
    },
    {
      id: 'p_karim_benzema',
      name: 'كريم بنزيما',
      aliases: ['بنزيما', 'الحكومة', 'benzema'],
      photo: '/assets/football/players/benzema.jpg',
      clubs: ['ليون', 'ريال مدريد', 'الاتحاد']
    },
    {
      id: 'p_luis_suarez',
      name: 'لويس سواريز',
      aliases: ['سواريز', 'العضاض', 'suarez'],
      photo: 'https://cdn.sofifa.net/players/176/580/25_120.png',
      clubs: ['ناسيونال', 'غرونينغن', 'أياكس أمستردام', 'ليفربول', 'برشلونة', 'أتلتيكو مدريد']
    },
    {
      id: 'p_neymar_jr',
      name: 'نيمار',
      aliases: ['نيمار جونيور', 'الساحر', 'neymar'],
      photo: '/assets/football/players/neymar.jpg',
      clubs: ['سانتوس', 'برشلونة', 'باريس سان جيرمان', 'الهلال']
    },
    {
      id: 'p_kylian_mbappe',
      name: 'كيليان مبابي',
      aliases: ['مبابي', 'الفتى الذهبي', 'mbappe'],
      photo: '/assets/football/players/mbappe.jpg',
      clubs: ['موناكو', 'باريس سان جيرمان', 'ريال مدريد']
    },
    {
      id: 'p_erling_haaland',
      name: 'إيرلينغ هالاند',
      aliases: ['هالاند', 'الوحش', 'الغول', 'haaland'],
      photo: '/assets/football/players/haaland.jpg',
      clubs: ['مولده', 'ريد بول سالزبورغ', 'بوروسيا دورتموند', 'مانشستر سيتي']
    },
    {
      id: 'p_kevin_debruyne',
      name: 'كيفين دي بروين',
      aliases: ['دي بروين', 'المهندس', 'kdb'],
      photo: '/assets/football/players/debruyne.jpg',
      clubs: ['جينك', 'تشيلسي', 'فيردر بريمن', 'فولفسبورغ', 'مانشستر سيتي']
    },
    {
      id: 'p_luka_modric',
      name: 'لوكا مودريتش',
      aliases: ['مودريتش', 'المايسترو', 'modric'],
      photo: '/assets/football/players/modric.jpg',
      clubs: ['دينامو زغرب', 'توتنهام', 'ريال مدريد']
    },
    {
      id: 'p_toni_kroos',
      name: 'توني كروس',
      aliases: ['كروس', 'المهندس الألماني', 'kroos'],
      photo: '/assets/football/players/kroos.jpg',
      clubs: ['بايرن ميونخ', 'باير ليفركوزن', 'ريال مدريد']
    },
    {
      id: 'p_robert_lewandowski',
      name: 'روبرت ليفاندوفسكي',
      aliases: ['ليفاندوفسكي', 'ليفا', 'lewandowski'],
      photo: '/assets/football/players/lewandowski.jpg',
      clubs: ['ليخ بوزنان', 'بوروسيا دورتموند', 'بايرن ميونخ', 'برشلونة']
    },
    {
      id: 'p_mohamed_salah',
      name: 'محمد صلاح',
      aliases: ['صلاح', 'فخر العرب', 'الملك المصري', 'salah'],
      photo: '/assets/football/players/salah.jpg',
      clubs: ['المقاولون العرب', 'بازل', 'تشيلسي', 'فيورنتينا', 'روما', 'ليفربول']
    },
    {
      id: 'p_harry_kane',
      name: 'هاري كين',
      aliases: ['كين', 'الامير هاري', 'kane'],
      photo: 'https://cdn.sofifa.net/players/202/126/25_120.png',
      clubs: ['توتنهام', 'ليستر سيتي', 'نورويتش سيتي', 'ميلوول', 'بايرن ميونخ']
    },
    {
      id: 'p_jude_bellingham',
      name: 'جود بيلينجهام',
      aliases: ['بيلينجهام', 'جود', 'bellingham'],
      photo: '/assets/football/players/bellingham.jpg',
      clubs: ['برمنغهام سيتي', 'بوروسيا دورتموند', 'ريال مدريد']
    },
    {
      id: 'p_vinicius_jr',
      name: 'فينيسيوس جونيور',
      aliases: ['فيني', 'فينيسيوس', 'vinicius'],
      photo: '/assets/football/players/vinicius.jpg',
      clubs: ['فلامنغو', 'ريال مدريد']
    },
    {
      id: 'p_eden_hazard',
      name: 'إيدين هازارد',
      aliases: ['هازارد', 'hazard'],
      photo: 'https://cdn.sofifa.net/players/183/277/25_120.png',
      clubs: ['ليل', 'تشيلسي', 'ريال مدريد']
    },
    {
      id: 'p_thibaut_courtois',
      name: 'تيبو كورتوا',
      aliases: ['كورتوا', 'الاخطبوط', 'courtois'],
      photo: '/assets/football/players/courtois.jpg',
      clubs: ['جينك', 'أتلتيكو مدريد', 'تشيلسي', 'ريال مدريد']
    },
    {
      id: 'p_antonio_rudiger',
      name: 'أنطونيو روديغر',
      aliases: ['روديغر', 'rudiger'],
      photo: 'https://cdn.sofifa.net/players/205/452/25_120.png',
      clubs: ['شتوتغارت', 'روما', 'تشيلسي', 'ريال مدريد']
    },
    {
      id: 'p_david_beckham',
      name: 'ديفيد بيكهام',
      aliases: ['بيكهام', 'الفريق الذهبي', 'beckham'],
      photo: 'https://cdn.sofifa.net/players/000/241/25_120.png',
      clubs: ['مانشستر يونايتد', 'بريستون', 'ريال مدريد', 'ميلان', 'باريس سان جيرمان']
    },
    {
      id: 'p_ronaldo_nazario',
      name: 'رونالدو الظاهرة',
      aliases: ['الظاهرة', 'رونالدو البرازيلي', 'R9'],
      photo: 'https://cdn.sofifa.net/players/000/342/25_120.png',
      clubs: ['كروزيرو', 'بي إس في آيندهوفن', 'برشلونة', 'إنتر ميلان', 'ريال مدريد', 'ميلان']
    },
    {
      id: 'p_ronaldinho',
      name: 'رونالدينيو',
      aliases: ['الساحر البرازيلي', 'روني', 'ronaldinho'],
      photo: '/assets/football/players/ronaldinho.jpg',
      clubs: ['غريميو', 'باريس سان جيرمان', 'برشلونة', 'ميلان', 'فلامنغو']
    },
    {
      id: 'p_zlatan_ibrahimovic',
      name: 'زلاتان إبراهيموفيتش',
      aliases: ['إبراهيموفيتش', 'السلطان', 'زلاتان', 'ibrahimovic'],
      photo: 'https://cdn.sofifa.net/players/041/236/25_120.png',
      clubs: ['مالمو', 'أياكس أمستردام', 'يوفنتوس', 'إنتر ميلان', 'برشلونة', 'ميلان', 'باريس سان جيرمان', 'مانشستر يونايتد']
    },
    {
      id: 'p_luis_figo',
      name: 'لويس فيغو',
      aliases: ['فيغو', 'figo'],
      photo: 'https://cdn.sofifa.net/players/000/404/25_120.png',
      clubs: ['سبورتينغ لشبونة', 'برشلونة', 'ريال مدريد', 'إنتر ميلان']
    },
    {
      id: 'p_samuel_etoo',
      name: 'صامويل إيتو',
      aliases: ['إيتو', 'الاسد الكاميروني', 'etoo'],
      photo: 'https://cdn.sofifa.net/players/000/964/25_120.png',
      clubs: ['ريال مدريد', 'ليغانيس', 'إسبانيول', 'مايوركا', 'برشلونة', 'إنتر ميلان', 'تشيلسي', 'إيفرتون']
    },
    {
      id: 'p_casemiro',
      name: 'كاسيميرو',
      aliases: ['الدبابة', 'كاسيميرو', 'casemiro'],
      photo: 'https://cdn.sofifa.net/players/200/145/25_120.png',
      clubs: ['ساو باولو', 'ريال مدريد', 'بورتو', 'مانشستر يونايتد']
    },
    {
      id: 'p_raphael_varane',
      name: 'رافاييل فاران',
      aliases: ['فاران', 'varane'],
      photo: 'https://cdn.sofifa.net/players/201/535/25_120.png',
      clubs: ['لنس', 'ريال مدريد', 'مانشستر يونايتد', 'كومو']
    },
    {
      id: 'p_angel_di_maria',
      name: 'أنخيل دي ماريا',
      aliases: ['دي ماريا', 'المعكرونة', 'di maria'],
      photo: 'https://cdn.sofifa.net/players/183/898/25_120.png',
      clubs: ['روزاريو سنترال', 'بنفيكا', 'ريال مدريد', 'مانشستر يونايتد', 'باريس سان جيرمان', 'يوفنتوس']
    },
    {
      id: 'p_michael_owen',
      name: 'مايكل أوين',
      aliases: ['أوين', 'الفتى الذهبي', 'owen'],
      photo: 'https://cdn.sofifa.net/players/002/097/25_120.png',
      clubs: ['ليفربول', 'ريال مدريد', 'نيوكاسل يونايتد', 'مانشستر يونايتد', 'ستوك سيتي']
    },
    {
      id: 'p_ruud_van_nistelrooy',
      name: 'رود فان نيستلروي',
      aliases: ['فان نيستلروي', 'القناص الهولندي'],
      photo: 'https://cdn.sofifa.net/players/001/024/25_120.png',
      clubs: ['دن بوش', 'هيرينفين', 'بي إس في آيندهوفن', 'مانشستر يونايتد', 'ريال مدريد', 'هامبورغ', 'مالاغا']
    },
    {
      id: 'p_cesc_fabregas',
      name: 'سيسك فابريغاس',
      aliases: ['فابريغاس', 'سيسك', 'fabregas'],
      photo: 'https://cdn.sofifa.net/players/162/895/25_120.png',
      clubs: ['أرسنال', 'برشلونة', 'تشيلسي', 'موناكو', 'كومو']
    },
    {
      id: 'p_petr_cech',
      name: 'بيتر تشيك',
      aliases: ['تشيك', 'صاحب الخوذة', 'cech'],
      photo: 'https://cdn.sofifa.net/players/049/212/25_120.png',
      clubs: ['سبارتا براغ', 'رين', 'تشيلسي', 'أرسنال']
    },
    {
      id: 'p_olivier_giroud',
      name: 'أوليفيه جيرو',
      aliases: ['جيرو', 'giroud'],
      photo: 'https://cdn.sofifa.net/players/178/509/25_120.png',
      clubs: ['غرونوبل', 'إيستر', 'تور', 'مونبلييه', 'أرسنال', 'تشيلسي', 'ميلان', 'لوس أنجلوس']
    },
    {
      id: 'p_david_luiz',
      name: 'ديفيد لويز',
      aliases: ['لويز', 'david luiz'],
      photo: 'https://cdn.sofifa.net/players/179/944/25_120.png',
      clubs: ['فيتوريا', 'بنفيكا', 'تشيلسي', 'باريس سان جيرمان', 'أرسنال', 'فلامنغو']
    },
    {
      id: 'p_willian',
      name: 'ويليان',
      aliases: ['willian', 'ويليان البرازيلي'],
      photo: 'https://cdn.sofifa.net/players/184/941/25_120.png',
      clubs: ['كورينثيانز', 'شاختار دونيتسك', 'أنجي', 'تشيلسي', 'أرسنال', 'فولهام', 'أولمبياكوس']
    },
    {
      id: 'p_nicolas_anelka',
      name: 'نيكولا أنيلكا',
      aliases: ['أنيلكا', 'الرحالة', 'anelka'],
      photo: 'https://cdn.sofifa.net/players/000/111/25_120.png',
      clubs: ['باريس سان جيرمان', 'أرسنال', 'ريال مدريد', 'ليفربول', 'مانشستر سيتي', 'فنربخشة', 'بولتون', 'تشيلسي', 'يوفنتوس', 'وست بروميتش']
    },
    {
      id: 'p_ashley_cole',
      name: 'آشلي كول',
      aliases: ['كول', 'ashley cole'],
      photo: 'https://cdn.sofifa.net/players/000/609/25_120.png',
      clubs: ['أرسنال', 'كريستال بالاس', 'تشيلسي', 'روما', 'لوس أنجلوس جالاكسي', 'ديربي كاونتي']
    },
    {
      id: 'p_raheem_sterling',
      name: 'رحيم سترلينغ',
      aliases: ['سترلينغ', 'sterling'],
      photo: 'https://cdn.sofifa.net/players/202/652/25_120.png',
      clubs: ['ليفربول', 'مانشستر سيتي', 'تشيلسي', 'أرسنال']
    },
    {
      id: 'p_kai_havertz',
      name: 'كاي هافيرتز',
      aliases: ['هافيرتز', 'havertz'],
      photo: 'https://cdn.sofifa.net/players/235/790/25_120.png',
      clubs: ['باير ليفركوزن', 'تشيلسي', 'أرسنال']
    },
    {
      id: 'p_jorginho',
      name: 'جورجينيو',
      aliases: ['jorginho', 'جورجينهو'],
      photo: 'https://cdn.sofifa.net/players/205/498/25_120.png',
      clubs: ['فيرونا', 'سامبونيفاسيزي', 'نابولي', 'تشيلسي', 'أرسنال']
    },
    {
      id: 'p_gabriel_jesus',
      name: 'غابرييل جيسوس',
      aliases: ['جيسوس', 'jesus'],
      photo: 'https://cdn.sofifa.net/players/230/666/25_120.png',
      clubs: ['بالميراس', 'مانشستر سيتي', 'أرسنال']
    },
    {
      id: 'p_oleksandr_zinchenko',
      name: 'أولكسندر زينتشينكو',
      aliases: ['زينتشينكو', 'zinchenko'],
      photo: 'https://cdn.sofifa.net/players/227/805/25_120.png',
      clubs: ['أوفا', 'مانشستر سيتي', 'بي إس في آيندهوفن', 'أرسنال']
    },
    {
      id: 'p_samir_nasri',
      name: 'سمير نصري',
      aliases: ['نصري', 'nasri'],
      photo: 'https://cdn.sofifa.net/players/167/664/25_120.png',
      clubs: ['مارسيليا', 'أرسنال', 'مانشستر سيتي', 'إشبيلية', 'أنطاليا سبور', 'وست هام', 'أندرلخت']
    },
    {
      id: 'p_emmanuel_adebayor',
      name: 'إيمانويل أديبايور',
      aliases: ['أديبايور', 'adebayor'],
      photo: 'https://cdn.sofifa.net/players/139/068/25_120.png',
      clubs: ['ميتز', 'موناكو', 'أرسنال', 'مانشستر سيتي', 'ريال مدريد', 'توتنهام', 'كريستال بالاس', 'إسطنبول باشاك شهير']
    },
    {
      id: 'p_kolo_toure',
      name: 'كولو توريه',
      aliases: ['توريه', 'kolo toure'],
      photo: 'https://cdn.sofifa.net/players/018/438/25_120.png',
      clubs: ['أسيك ميموزا', 'أرسنال', 'مانشستر سيتي', 'ليفربول', 'سيلتيك']
    },
    {
      id: 'p_james_milner',
      name: 'جيمس ميلنر',
      aliases: ['ميلنر', 'milner'],
      photo: 'https://cdn.sofifa.net/players/152/729/25_120.png',
      clubs: ['ليدز يونايتد', 'سويندون', 'نيوكاسل يونايتد', 'أستون فيلا', 'مانشستر سيتي', 'ليفربول', 'برايتون']
    },
    {
      id: 'p_daniel_sturridge',
      name: 'دانييل ستوريدج',
      aliases: ['ستوريدج', 'sturridge'],
      photo: 'https://cdn.sofifa.net/players/171/833/25_120.png',
      clubs: ['مانشستر سيتي', 'تشيلسي', 'بولتون', 'ليفربول', 'وست بروميتش', 'طرابزون سبور', 'بيرث غلوري']
    },
    {
      id: 'p_carlos_tevez',
      name: 'كارلوس تيفيز',
      aliases: ['تيفيز', 'الاباتشي', 'tevez'],
      photo: 'https://cdn.sofifa.net/players/143/001/25_120.png',
      clubs: ['بوكا جونيورز', 'كورينثيانز', 'وست هام', 'مانشستر يونايتد', 'مانشستر سيتي', 'يوفنتوس', 'شانغهاي شينوا']
    },
    {
      id: 'p_peter_schmeichel',
      name: 'بيتر شمايكل',
      aliases: ['شمايكل', 'schmeichel'],
      photo: 'https://cdn.sofifa.net/players/000/003/25_120.png',
      clubs: ['بروندبي', 'مانشستر يونايتد', 'سبورتينغ لشبونة', 'أستون فيلا', 'مانشستر سيتي']
    },
    {
      id: 'p_andy_cole',
      name: 'أندي كول',
      aliases: ['كول', 'andy cole'],
      photo: 'https://cdn.sofifa.net/players/000/004/25_120.png',
      clubs: ['أرسنال', 'فولهام', 'بريستول سيتي', 'نيوكاسل يونايتد', 'مانشستر يونايتد', 'بلاكبيرن', 'فولهام', 'مانشستر سيتي', 'بورتسموث', 'سندرلاند']
    },
    {
      id: 'p_jadon_sancho',
      name: 'جادون سانشو',
      aliases: ['سانشو', 'sancho'],
      photo: 'https://cdn.sofifa.net/players/233/049/25_120.png',
      clubs: ['مانشستر سيتي', 'بوروسيا دورتموند', 'مانشستر يونايتد', 'تشيلسي']
    },
    {
      id: 'p_johan_cruyff',
      name: 'يوهان كرويف',
      aliases: ['كرويف', 'الهولندي الطائر', 'cruyff'],
      photo: 'https://cdn.sofifa.net/players/000/240/25_120.png',
      clubs: ['أياكس أمستردام', 'برشلونة', 'لوس أنجلوس أزتكس', 'واشنطن دبلوماتس', 'ليفانتي', 'فاينورد روتردام']
    },
    {
      id: 'p_frenkie_de_jong',
      name: 'فرينكي دي يونغ',
      aliases: ['دي يونغ', 'فرينكي', 'de jong'],
      photo: 'https://cdn.sofifa.net/players/228/702/25_120.png',
      clubs: ['فيلم تو', 'أياكس أمستردام', 'برشلونة']
    },
    {
      id: 'p_patrick_kluivert',
      name: 'باتريك كلايفرت',
      aliases: ['كلايفرت', 'kluivert'],
      photo: 'https://cdn.sofifa.net/players/000/314/25_120.png',
      clubs: ['أياكس أمستردام', 'ميلان', 'برشلونة', 'نيوكاسل يونايتد', 'فالنسيا', 'بي إس في آيندهوفن', 'ليل']
    },
    {
      id: 'p_ronald_koeman',
      name: 'رونالد كومان',
      aliases: ['كومان', 'koeman'],
      photo: 'https://cdn.sofifa.net/players/000/123/25_120.png',
      clubs: ['غرونينغن', 'أياكس أمستردام', 'بي إس في آيندهوفن', 'برشلونة', 'فاينورد روتردام']
    },
    {
      id: 'p_edwin_van_der_sar',
      name: 'إدوين فان دير سار',
      aliases: ['فان دير سار', 'van der sar'],
      photo: 'https://cdn.sofifa.net/players/001/040/25_120.png',
      clubs: ['أياكس أمستردام', 'يوفنتوس', 'فولهام', 'مانشستر يونايتد']
    },
    {
      id: 'p_donny_van_de_beek',
      name: 'دوني فان دي بيك',
      aliases: ['فان دي بيك', 'van de beek'],
      photo: 'https://cdn.sofifa.net/players/228/536/25_120.png',
      clubs: ['أياكس أمستردام', 'مانشستر يونايتد', 'إيفرتون', 'آينتراخت فرانكفورت', 'جيرونا']
    },
    {
      id: 'p_antony',
      name: 'أنتوني',
      aliases: ['antony', 'السبينر'],
      photo: 'https://cdn.sofifa.net/players/255/475/25_120.png',
      clubs: ['ساو باولو', 'أياكس أمستردام', 'مانشستر يونايتد']
    },
    {
      id: 'p_lisandro_martinez',
      name: 'ليساندرو مارتينيز',
      aliases: ['الجزار', 'مارتينيز', 'lisandro'],
      photo: 'https://cdn.sofifa.net/players/239/053/25_120.png',
      clubs: ['نيويلز أولد بويز', 'ديفينسا واي خوستيسيا', 'أياكس أمستردام', 'مانشستر يونايتد']
    },
    {
      id: 'p_christian_eriksen',
      name: 'كريستيان إريكسن',
      aliases: ['إريكسن', 'eriksen'],
      photo: 'https://cdn.sofifa.net/players/190/460/25_120.png',
      clubs: ['أياكس أمستردام', 'توتنهام', 'إنتر ميلان', 'برينتفورد', 'مانشستر يونايتد']
    },
    {
      id: 'p_andre_onana',
      name: 'أندريه أونانا',
      aliases: ['أونانا', 'onana'],
      photo: 'https://cdn.sofifa.net/players/226/753/25_120.png',
      clubs: ['برشلونة', 'أياكس أمستردام', 'إنتر ميلان', 'مانشستر يونايتد']
    },
    {
      id: 'p_daley_blind',
      name: 'دالي بليند',
      aliases: ['بليند', 'blind'],
      photo: 'https://cdn.sofifa.net/players/190/813/25_120.png',
      clubs: ['أياكس أمستردام', 'غرونينغن', 'مانشستر يونايتد', 'بايرن ميونخ', 'جيرونا']
    },
    {
      id: 'p_jaap_stam',
      name: 'ياب ستام',
      aliases: ['ستام', 'الصخرة الهولندية', 'stam'],
      photo: 'https://cdn.sofifa.net/players/000/508/25_120.png',
      clubs: ['زفوله', 'كامبور', 'فيليم تو', 'بي إس في آيندهوفن', 'مانشستر يونايتد', 'لاتسيو', 'ميلان', 'أياكس أمستردام']
    },
    {
      id: 'p_romario',
      name: 'روماريو',
      aliases: ['الفيسكادو', 'روماريو البرازيلي', 'romario'],
      photo: 'https://cdn.sofifa.net/players/000/100/25_120.png',
      clubs: ['فاسكو دا غاما', 'بي إس في آيندهوفن', 'برشلونة', 'فلامنغو', 'فالنسيا', 'فلومينينسي', 'السد']
    },
    {
      id: 'p_phillip_cocu',
      name: 'فيليب كوكو',
      aliases: ['كوكو', 'cocu'],
      photo: 'https://cdn.sofifa.net/players/000/203/25_120.png',
      clubs: ['إي زد ألكمار', 'فيتيسه', 'بي إس في آيندهوفن', 'برشلونة', 'الجزيرة']
    },
    {
      id: 'p_dirk_kuyt',
      name: 'ديرك كويت',
      aliases: ['كويت', 'kuyt'],
      photo: 'https://cdn.sofifa.net/players/048/717/25_120.png',
      clubs: ['أوتريخت', 'فاينورد روتردام', 'ليفربول', 'فنربخشة']
    },
    {
      id: 'p_jerzy_dudek',
      name: 'يرزي دوديك',
      aliases: ['دوديك', 'dudek'],
      photo: 'https://cdn.sofifa.net/players/001/450/25_120.png',
      clubs: ['سوخوليتسه', 'فاينورد روتردام', 'ليفربول', 'ريال مدريد']
    },
    {
      id: 'p_georginio_wijnaldum',
      name: 'جورجينيو فينالدوم',
      aliases: ['فينالدوم', 'wijnaldum'],
      photo: 'https://cdn.sofifa.net/players/181/291/25_120.png',
      clubs: ['فاينورد روتردام', 'بي إس في آيندهوفن', 'نيوكاسل يونايتد', 'ليفربول', 'باريس سان جيرمان', 'روما', 'الاتفاق']
    },
    {
      id: 'p_andrea_pirlo',
      name: 'أندريا بيرلو',
      aliases: ['بيرلو', 'المايسترو', 'pirlo'],
      photo: 'https://cdn.sofifa.net/players/007/611/25_120.png',
      clubs: ['بريشيا', 'إنتر ميلان', 'ريجينا', 'ميلان', 'يوفنتوس', 'نيويورك سيتي']
    },
    {
      id: 'p_gonzalo_higuain',
      name: 'غونزالو هيغواين',
      aliases: ['هيغواين', 'البيبيتا', 'higuain'],
      photo: 'https://cdn.sofifa.net/players/167/664/25_120.png',
      clubs: ['ريفر بليت', 'ريال مدريد', 'نابولي', 'يوفنتوس', 'ميلان', 'تشيلسي', 'إنتر ميامي']
    },
    {
      id: 'p_leonardo_bonucci',
      name: 'ليوناردو بونوتشي',
      aliases: ['بونوتشي', 'bonucci'],
      photo: 'https://cdn.sofifa.net/players/184/344/25_120.png',
      clubs: ['إنتر ميلان', 'تريفيزو', 'بيزا', 'باري', 'يوفنتوس', 'ميلان', 'يونيون برلين', 'فنربخشة']
    },
    {
      id: 'p_roberto_baggio',
      name: 'روبرتو باجيو',
      aliases: ['باجيو', 'الذيل الحصان', 'baggio'],
      photo: 'https://cdn.sofifa.net/players/000/025/25_120.png',
      clubs: ['فيتشنزا', 'فيورنتينا', 'يوفنتوس', 'ميلان', 'بولونيا', 'إنتر ميلان', 'بريشيا']
    },
    {
      id: 'p_filippo_inzaghi',
      name: 'فيليبو إنزاغي',
      aliases: ['إنزاغي', 'سوبر بيبو', 'inzaghi'],
      photo: 'https://cdn.sofifa.net/players/000/118/25_120.png',
      clubs: ['بياتشينزا', 'ليفي', 'فيرونا', 'بارما', 'أتالانتا', 'يوفنتوس', 'ميلان']
    },
    {
      id: 'p_christian_vieri',
      name: 'كريستيان فييري',
      aliases: ['فييري', 'البوبو', 'vieri'],
      photo: 'https://cdn.sofifa.net/players/001/010/25_120.png',
      clubs: ['تورينو', 'بيزا', 'رافينا', 'فينيزيا', 'أتالانتا', 'يوفنتوس', 'أتلتيكو مدريد', 'لاتسيو', 'إنتر ميلان', 'ميلان', 'موناكو', 'فيورنتينا']
    },
    {
      id: 'p_edgar_davids',
      name: 'إدغار دافيدز',
      aliases: ['دافيدز', 'البيتبول', 'davids'],
      photo: 'https://cdn.sofifa.net/players/000/215/25_120.png',
      clubs: ['أياكس أمستردام', 'ميلان', 'يوفنتوس', 'برشلونة', 'إنتر ميلان', 'توتنهام', 'كريستال بالاس', 'بارنت']
    },
    {
      id: 'p_clarence_seedorf',
      name: 'كلارنس سيدورف',
      aliases: ['سيدورف', 'seedorf'],
      photo: 'https://cdn.sofifa.net/players/000/405/25_120.png',
      clubs: ['أياكس أمستردام', 'سامبدوريا', 'ريال مدريد', 'إنتر ميلان', 'ميلان', 'بوتافوغو']
    },
    {
      id: 'p_hernan_crespo',
      name: 'هرنان كريسبو',
      aliases: ['كريسبو', 'crespo'],
      photo: 'https://cdn.sofifa.net/players/000/500/25_120.png',
      clubs: ['ريفر بليت', 'بارما', 'لاتسيو', 'إنتر ميلان', 'تشيلسي', 'ميلان', 'جنوى']
    },
    {
      id: 'p_mario_balotelli',
      name: 'ماريو بالوتيلي',
      aliases: ['بالوتيلي', 'سوبر ماريو', 'balotelli'],
      photo: 'https://cdn.sofifa.net/players/186/627/25_120.png',
      clubs: ['لوميزاني', 'إنتر ميلان', 'مانشستر سيتي', 'ميلان', 'ليفربول', 'نيس', 'مارسيليا', 'بريشيا', 'مونزا', 'أضنة دميرسبور', 'سيون', 'جنوى']
    },
    {
      id: 'p_hakan_calhanoglu',
      name: 'هاكان تشالهان أوغلو',
      aliases: ['تشالهان أوغلو', 'هاكان', 'calhanoglu'],
      photo: 'https://cdn.sofifa.net/players/212/622/25_120.png',
      clubs: ['كارلسروه', 'هامبورغ', 'باير ليفركوزن', 'ميلان', 'إنتر ميلان']
    },
    {
      id: 'p_patrick_vieira',
      name: 'باتريك فييرا',
      aliases: ['فييرا', 'vieira'],
      photo: 'https://cdn.sofifa.net/players/000/125/25_120.png',
      clubs: ['كان', 'ميلان', 'أرسنال', 'يوفنتوس', 'إنتر ميلان', 'مانشستر سيتي']
    },
    {
      id: 'p_fabio_cannavaro',
      name: 'فابيو كانافارو',
      aliases: ['كانافارو', 'برلين', 'cannavaro'],
      photo: 'https://cdn.sofifa.net/players/001/008/25_120.png',
      clubs: ['نابولي', 'بارما', 'إنتر ميلان', 'يوفنتوس', 'ريال مدريد', 'الأهلي الإماراتي']
    },
    {
      id: 'p_jan_oblak',
      name: 'يان أوبلاك',
      aliases: ['أوبلاك', 'oblak'],
      photo: 'https://cdn.sofifa.net/players/200/389/25_120.png',
      clubs: ['أولمبيا ليوبليانا', 'بنفيكا', 'أولينيسي', 'يونياو ليريا', 'ريو أفي', 'أتلتيكو مدريد']
    },
    {
      id: 'p_joao_felix',
      name: 'جواو فيليكس',
      aliases: ['فيليكس', 'joao felix'],
      photo: 'https://cdn.sofifa.net/players/242/444/25_120.png',
      clubs: ['بنفيكا', 'أتلتيكو مدريد', 'تشيلسي', 'برشلونة']
    },
    {
      id: 'p_raul_jimenez',
      name: 'راؤول خيمينيز',
      aliases: ['خيمينيز', 'jimenez'],
      photo: 'https://cdn.sofifa.net/players/213/345/25_120.png',
      clubs: ['أمريكا', 'أتلتيكو مدريد', 'بنفيكا', 'وولفرهامبتون', 'فولهام']
    },
    {
      id: 'p_iker_casillas',
      name: 'إيكر كاسياس',
      aliases: ['كاسياس', 'القديس', 'casillas'],
      photo: 'https://cdn.sofifa.net/players/009/014/25_120.png',
      clubs: ['ريال مدريد', 'بورتو']
    },
    {
      id: 'p_pepe',
      name: 'بيبي',
      aliases: ['بيبي المدافع', 'كيبلير', 'pepe'],
      photo: 'https://cdn.sofifa.net/players/120/533/25_120.png',
      clubs: ['ماريتيمو', 'بورتو', 'ريال مدريد', 'بشكتاش']
    },
    {
      id: 'p_eder_militao',
      name: 'إيدير ميليتاو',
      aliases: ['ميليتاو', 'militao'],
      photo: 'https://cdn.sofifa.net/players/240/130/25_120.png',
      clubs: ['ساو باولو', 'بورتو', 'ريال مدريد']
    },
    {
      id: 'p_james_rodriguez',
      name: 'خاميس رودريغيز',
      aliases: ['خاميس', 'james rodriguez'],
      photo: 'https://cdn.sofifa.net/players/198/710/25_120.png',
      clubs: ['إنفيغادو', 'بانفيلد', 'بورتو', 'موناكو', 'ريال مدريد', 'بايرن ميونخ', 'إيفرتون', 'الريان', 'أولمبياكوس', 'ساو باولو', 'رايو فايكانو']
    },
    {
      id: 'p_ricardo_carvalho',
      name: 'ريكاردو كارفاليو',
      aliases: ['كارفاليو', 'carvalho'],
      photo: 'https://cdn.sofifa.net/players/046/222/25_120.png',
      clubs: ['بورتو', 'ليسا', 'فيتوريا سيتوبال', 'ألفيركا', 'تشيلسي', 'ريال مدريد', 'موناكو', 'شانغهاي إس آي بي جي']
    },
    {
      id: 'p_danilo',
      name: 'دانيلو',
      aliases: ['danilo', 'دانيلو لويز'],
      photo: 'https://cdn.sofifa.net/players/199/304/25_120.png',
      clubs: ['أمريكا مينيرو', 'سانتوس', 'بورتو', 'ريال مدريد', 'مانشستر سيتي', 'يوفنتوس']
    },
    {
      id: 'p_bruno_fernandes',
      name: 'برونو فيرنانديز',
      aliases: ['برونو', 'bruno fernandes'],
      photo: 'https://cdn.sofifa.net/players/212/198/25_120.png',
      clubs: ['نوفارا', 'أودينيزي', 'سامبدوريا', 'سبورتينغ لشبونة', 'مانشستر يونايتد']
    },
    {
      id: 'p_nani',
      name: 'ناني',
      aliases: ['لويس ناني', 'nani'],
      photo: 'https://cdn.sofifa.net/players/169/345/25_120.png',
      clubs: ['سبورتينغ لشبونة', 'مانشستر يونايتد', 'فنربخشة', 'فالنسيا', 'لاتسيو', 'أورلاندو سيتي', 'فينيزيا', 'ملبورن فيكتوري', 'أضنة دميرسبور', 'إستريلا أمادورا']
    },
    {
      id: 'p_marcos_rojo',
      name: 'ماركوس روخو',
      aliases: ['روخو', 'rojo'],
      photo: 'https://cdn.sofifa.net/players/199/503/25_120.png',
      clubs: ['إستوديانتيس', 'سبارتاك موسكو', 'سبورتينغ لشبونة', 'مانشستر يونايتد', 'بوكا جونيورز']
    },

    // --- الدوري الإنجليزي: بقية الأندية العشرون والنجوم المشتركة ---
    {
      id: 'p_mario_gotze',
      name: 'ماريو غوتزه',
      aliases: ['غوتزه', 'gotze'],
      photo: 'https://cdn.sofifa.net/players/192/318/25_120.png',
      clubs: ['بوروسيا دورتموند', 'بايرن ميونخ', 'بي إس في آيندهوفن', 'آينتراخت فرانكفورت']
    },
    {
      id: 'p_mats_hummels',
      name: 'ماتس هوملز',
      aliases: ['هوملز', 'hummels'],
      photo: 'https://cdn.sofifa.net/players/178/603/25_120.png',
      clubs: ['بايرن ميونخ', 'بوروسيا دورتموند', 'روما']
    },
    {
      id: 'p_niklas_sule',
      name: 'نيكلاس زوله',
      aliases: ['زوله', 'sule'],
      photo: 'https://cdn.sofifa.net/players/212/190/25_120.png',
      clubs: ['هوفنهايم', 'بايرن ميونخ', 'بوروسيا دورتموند']
    },
    {
      id: 'p_xabi_alonso',
      name: 'تشابي ألونسو',
      aliases: ['ألونسو', 'xabi alonso'],
      photo: 'https://cdn.sofifa.net/players/020/775/25_120.png',
      clubs: ['ريال سوسيداد', 'إيبار', 'ليفربول', 'ريال مدريد', 'بايرن ميونخ']
    },
    {
      id: 'p_arjen_robben',
      name: 'آريين روبن',
      aliases: ['روبن', 'الجناح الطائر', 'robben'],
      photo: 'https://cdn.sofifa.net/players/090/141/25_120.png',
      clubs: ['غرونينغن', 'بي إس في آيندهوفن', 'تشيلسي', 'ريال مدريد', 'بايرن ميونخ']
    },
    {
      id: 'p_david_alaba',
      name: 'ديفيد ألابا',
      aliases: ['ألابا', 'alaba'],
      photo: 'https://cdn.sofifa.net/players/197/445/25_120.png',
      clubs: ['أوستريا فيينا', 'بايرن ميونخ', 'هوفنهايم', 'ريال مدريد']
    },
    {
      id: 'p_ashraf_hakimi',
      name: 'أشرف حكيمي',
      aliases: ['حكيمي', 'القطار المغربي', 'hakimi'],
      photo: '/assets/football/players/hakimi.jpg',
      clubs: ['ريال مدريد', 'بوروسيا دورتموند', 'إنتر ميلان', 'باريس سان جيرمان']
    },
    {
      id: 'p_sergio_ramos',
      name: 'سيرجيو راموس',
      aliases: ['راموس', 'الكابيتانو', 'ramos'],
      photo: '/assets/football/players/ramos.jpg',
      clubs: ['إشبيلية', 'ريال مدريد', 'باريس سان جيرمان']
    },
    {
      id: 'p_keylor_navas',
      name: 'كيلور نافاس',
      aliases: ['نافاس', 'navas'],
      photo: 'https://cdn.sofifa.net/players/193/041/25_120.png',
      clubs: ['سابريسا', 'ألباسيتي', 'ليفانتي', 'ريال مدريد', 'باريس سان جيرمان', 'نوتينغهام فورست']
    },
    {
      id: 'p_chris_wood',
      name: 'كريس وود',
      aliases: ['وود', 'chris wood'],
      photo: 'https://cdn.sofifa.net/players/193/532/25_120.png',
      clubs: ['وست بروميتش', 'بارنسلي', 'برايتون', 'برمنغهام سيتي', 'بريستول سيتي', 'ميلوول', 'ليستر سيتي', 'إيبسويتش تاون', 'ليدز يونايتد', 'بيرنلي', 'نيوكاسل يونايتد', 'نوتينغهام فورست']
    },
    {
      id: 'p_kalvin_phillips',
      name: 'كالفين فيليبس',
      aliases: ['فيليبس', 'phillips'],
      photo: 'https://cdn.sofifa.net/players/225/193/25_120.png',
      clubs: ['ليدز يونايتد', 'مانشستر سيتي', 'وست هام', 'إيبسويتش تاون']
    },
    {
      id: 'p_sam_morsy',
      name: 'سام مرسي',
      aliases: ['مرسي', 'morsy'],
      photo: 'https://cdn.sofifa.net/players/203/745/25_120.png',
      clubs: ['بورت فايل', 'تشيسترفيلد', 'ويغان', 'بارنسلي', 'ميدلزبره', 'إيبسويتش تاون']
    },
    {
      id: 'p_adam_lallana',
      name: 'آدم لالانا',
      aliases: ['لالانا', 'lallana'],
      photo: 'https://cdn.sofifa.net/players/180/819/25_120.png',
      clubs: ['ساوثهامبتون', 'بورنموث', 'ليفربول', 'برايتون']
    },
    {
      id: 'p_danny_ings',
      name: 'داني إينغز',
      aliases: ['إينغز', 'ings'],
      photo: 'https://cdn.sofifa.net/players/199/845/25_120.png',
      clubs: ['بورنموث', 'دورتشستر', 'بيرنلي', 'ليفربول', 'ساوثهامبتون', 'أستون فيلا', 'وست هام']
    },
    {
      id: 'p_sadio_mane',
      name: 'ساديو ماني',
      aliases: ['ماني', 'الاسد التيرنغي', 'mane'],
      photo: '/assets/football/players/mane.jpg',
      clubs: ['ميتز', 'ريد بول سالزبورغ', 'ساوثهامبتون', 'ليفربول', 'بايرن ميونخ', 'النصر']
    },
    {
      id: 'p_virgil_van_dijk',
      name: 'فيرجيل فان دايك',
      aliases: ['فان دايك', 'الصخرة', 'van dijk'],
      photo: 'https://cdn.sofifa.net/players/203/376/25_120.png',
      clubs: ['غرونينغن', 'سيلتيك', 'ساوثهامبتون', 'ليفربول']
    },
    {
      id: 'p_dejan_lovren',
      name: 'ديان لوفرين',
      aliases: ['لوفرين', 'lovren'],
      photo: 'https://cdn.sofifa.net/players/190/584/25_120.png',
      clubs: ['دينامو زغرب', 'إنتر زابريشيتش', 'ليون', 'ساوثهامبتون', 'ليفربول', 'زينيت']
    },
    {
      id: 'p_nathaniel_clyne',
      name: 'ناثانيال كلاين',
      aliases: ['كلاين', 'clyne'],
      photo: 'https://cdn.sofifa.net/players/189/881/25_120.png',
      clubs: ['كريستال بالاس', 'ساوثهامبتون', 'ليفربول', 'بورنموث']
    },
    {
      id: 'p_dominic_solanke',
      name: 'دومينيك سولانكي',
      aliases: ['سولانكي', 'solanke'],
      photo: 'https://cdn.sofifa.net/players/224/371/25_120.png',
      clubs: ['تشيلسي', 'فيتيسه', 'ليفربول', 'بورنموث', 'توتنهام']
    },
    {
      id: 'p_kepa_arrizabalaga',
      name: 'كيبا أريزابالاغا',
      aliases: ['كيبا', 'kepa'],
      photo: 'https://cdn.sofifa.net/players/206/517/25_120.png',
      clubs: ['أتلتيك بيلباو', 'بونفيرادينا', 'بلد الوليد', 'تشيلسي', 'ريال مدريد', 'بورنموث']
    },
    {
      id: 'p_neto_keeper',
      name: 'نيتو',
      aliases: ['نيتو الحارس', 'neto'],
      photo: 'https://cdn.sofifa.net/players/200/610/25_120.png',
      clubs: ['أتلتيكو باراناينسي', 'فيورنتينا', 'يوفنتوس', 'فالنسيا', 'برشلونة', 'بورنموث', 'أرسنال']
    },
    {
      id: 'p_emiliano_martinez',
      name: 'إميليانو مارتينيز',
      aliases: ['ديبو', 'مارتينيز', 'dibu'],
      photo: 'https://cdn.sofifa.net/players/202/811/25_120.png',
      clubs: ['أرسنال', 'أكسفورد', 'شيفيلد وينزداي', 'روترهام', 'ولفرهامبتون', 'خيتافي', 'ريدينغ', 'أستون فيلا']
    },
    {
      id: 'p_moussa_diaby',
      name: 'موسى ديابي',
      aliases: ['ديابي', 'diaby'],
      photo: 'https://cdn.sofifa.net/players/241/852/25_120.png',
      clubs: ['باريس سان جيرمان', 'كروتوني', 'باير ليفركوزن', 'أستون فيلا', 'الاتحاد']
    },
    {
      id: 'p_houssem_aouar',
      name: 'حسام عوار',
      aliases: ['عوار', 'aouar'],
      photo: 'https://cdn.sofifa.net/players/234/906/25_120.png',
      clubs: ['ليون', 'روما', 'الاتحاد']
    },
    {
      id: 'p_steven_bergwijn',
      name: 'ستيفن بيرجوين',
      aliases: ['بيرجوين', 'bergwijn'],
      photo: 'https://cdn.sofifa.net/players/225/850/25_120.png',
      clubs: ['بي إس في آيندهوفن', 'توتنهام', 'أياكس أمستردام', 'الاتحاد']
    },
    {
      id: 'p_nacho_fernandez',
      name: 'ناتشو فرنانديز',
      aliases: ['ناتشو', 'nacho'],
      photo: 'https://cdn.sofifa.net/players/200/724/25_120.png',
      clubs: ['ريال مدريد', 'القادسية']
    },
    {
      id: 'p_aubameyang',
      name: 'بيير إيميريك أوباميانغ',
      aliases: ['أوباميانغ', 'اوباميانغ', 'aubameyang'],
      photo: 'https://cdn.sofifa.net/players/188/567/25_120.png',
      clubs: ['ميلان', 'ديجون', 'ليل', 'موناكو', 'سانت إيتيان', 'بوروسيا دورتموند', 'أرسنال', 'برشلونة', 'تشيلسي', 'مارسيليا', 'القادسية']
    },
    {
      id: 'p_koen_casteels',
      name: 'كوين كاستيلس',
      aliases: ['كاستيلس', 'casteels'],
      photo: 'https://cdn.sofifa.net/players/193/698/25_120.png',
      clubs: ['جينك', 'هوفنهايم', 'فيردر بريمن', 'فولفسبورغ', 'القادسية']
    },
    {
      id: 'p_alvaro_morata',
      name: 'ألفارو موراتا',
      aliases: ['موراتا', 'morata'],
      photo: 'https://cdn.sofifa.net/players/201/153/25_120.png',
      clubs: ['ريال مدريد', 'يوفنتوس', 'تشيلسي', 'أتلتيكو مدريد', 'ميلان']
    },
    {
      id: 'p_romelu_lukaku',
      name: 'روميلو لوكاكو',
      aliases: ['لوكاكو', 'الدبابة البلجيكية', 'lukaku'],
      photo: 'https://cdn.sofifa.net/players/192/505/25_120.png',
      clubs: ['أندرلخت', 'تشيلسي', 'وست بروميتش', 'إيفرتون', 'مانشستر يونايتد', 'إنتر ميلان', 'روما', 'نابولي']
    },
    {
      id: 'p_alexis_sanchez',
      name: 'أليكسيس سانشيز',
      aliases: ['سانشيز', 'النينيو مارافيلا', 'alexis'],
      photo: 'https://cdn.sofifa.net/players/184/941/25_120.png',
      clubs: ['كوبيلوا', 'ريفر بليت', 'أودينيزي', 'برشلونة', 'أرسنال', 'مانشستر يونايتد', 'إنتر ميلان', 'مارسيليا']
    },
    {
      id: 'p_dimitri_payet',
      name: 'ديميتري باييت',
      aliases: ['باييت', 'payet'],
      photo: 'https://cdn.sofifa.net/players/172/871/25_120.png',
      clubs: ['نانت', 'سانت إيتيان', 'ليل', 'مارسيليا', 'وست هام', 'فاسكو دا غاما']
    },
    {
      id: 'p_georginio_rutter',
      name: 'جورجينيو روتر',
      aliases: ['روتر', 'rutter'],
      photo: 'https://cdn.sofifa.net/players/254/225/25_120.png',
      clubs: ['رين', 'هوفنهايم', 'ليدز يونايتد', 'برايتون']
    },
    {
      id: 'p_danny_welbeck',
      name: 'داني ويلبيك',
      aliases: ['ويلبيك', 'welbeck'],
      photo: 'https://cdn.sofifa.net/players/181/783/25_120.png',
      clubs: ['مانشستر يونايتد', 'بريستون', 'سندرلاند', 'أرسنال', 'واتفورد', 'برايتون']
    },
    {
      id: 'p_kaoru_mitoma',
      name: 'كاورو ميتوما',
      aliases: ['ميتوما', 'mitoma'],
      photo: 'https://cdn.sofifa.net/players/256/630/25_120.png',
      clubs: ['كاواساكي فرونتال', 'رويال يونيون', 'برايتون']
    },
    {
      id: 'p_leandro_trossard',
      name: 'لياندرو تروسار',
      aliases: ['تروسار', 'trossard'],
      photo: 'https://cdn.sofifa.net/players/207/439/25_120.png',
      clubs: ['جينك', 'لوميل', 'فيسترلو', 'آود هيفرلي لوفين', 'برايتون', 'أرسنال']
    },
    {
      id: 'p_marc_cucurella',
      name: 'مارك كوكوريا',
      aliases: ['كوكوريا', 'cucurella'],
      photo: 'https://cdn.sofifa.net/players/239/231/25_120.png',
      clubs: ['برشلونة', 'إيبار', 'خيتافي', 'برايتون', 'تشيلسي']
    },
    {
      id: 'p_moises_caicedo',
      name: 'مويسيس كايسيدو',
      aliases: ['كايسيدو', 'caicedo'],
      photo: 'https://cdn.sofifa.net/players/258/171/25_120.png',
      clubs: ['إنديبندينتي ديل فال', 'بيرشوت', 'برايتون', 'تشيلسي']
    },
    {
      id: 'p_alexis_mac_allister',
      name: 'أليكسيس ماك أليستر',
      aliases: ['ماك أليستر', 'mac allister'],
      photo: 'https://cdn.sofifa.net/players/243/627/25_120.png',
      clubs: ['أرجنتينوس جونيورز', 'بوكا جونيورز', 'برايتون', 'ليفربول']
    },
    {
      id: 'p_anthony_gordon',
      name: 'أنتوني غوردون',
      aliases: ['غوردون', 'gordon'],
      photo: 'https://cdn.sofifa.net/players/245/371/25_120.png',
      clubs: ['إيفرتون', 'بريستون', 'نيوكاسل يونايتد']
    },
    {
      id: 'p_richarlison',
      name: 'ريتشارليسون',
      aliases: ['الحمامة', 'ريتشارليسون', 'richarlison'],
      photo: 'https://cdn.sofifa.net/players/231/943/25_120.png',
      clubs: ['أمريكا مينيرو', 'فلومينينسي', 'واتفورد', 'إيفرتون', 'توتنهام']
    },
    {
      id: 'p_lucas_digne',
      name: 'لوكاس ديني',
      aliases: ['ديني', 'digne'],
      photo: 'https://cdn.sofifa.net/players/202/652/25_120.png',
      clubs: ['ليل', 'باريس سان جيرمان', 'روما', 'برشلونة', 'إيفرتون', 'أستون فيلا']
    },
    {
      id: 'p_idrissa_gueye',
      name: 'إدريسا غي',
      aliases: ['غي', 'gueye'],
      photo: 'https://cdn.sofifa.net/players/193/474/25_120.png',
      clubs: ['ليل', 'أستون فيلا', 'إيفرتون', 'باريس سان جيرمان']
    },
    {
      id: 'p_bryan_mbeumo',
      name: 'برايان مبيومو',
      aliases: ['مبيومو', 'mbeumo'],
      photo: 'https://cdn.sofifa.net/players/244/832/25_120.png',
      clubs: ['تروا', 'برينتفورد']
    },
    {
      id: 'p_yoane_wissa',
      name: 'يوان ويسا',
      aliases: ['ويسا', 'wissa'],
      photo: 'https://cdn.sofifa.net/players/230/899/25_120.png',
      clubs: ['شاتورو', 'أنجيه', 'ستاد لافال', 'أجاكسيو', 'لوريان', 'برينتفورد']
    },
    {
      id: 'p_ivan_toney',
      name: 'إيفان توني',
      aliases: ['توني', 'toney'],
      photo: 'https://cdn.sofifa.net/players/213/661/25_120.png',
      clubs: ['نورثامبتون', 'نيوكاسل يونايتد', 'بارنسلي', 'شروزبري', 'سكونثورب', 'ويغان', 'بيتربورو', 'برينتفورد', 'الأهلي']
    },
    {
      id: 'p_david_raya',
      name: 'ديفيد رايا',
      aliases: ['رايا', 'raya'],
      photo: 'https://cdn.sofifa.net/players/215/914/25_120.png',
      clubs: ['بلاكبيرن', 'ساوثبورت', 'برينتفورد', 'أرسنال']
    },
    {
      id: 'p_callum_hudson_odoi',
      name: 'كالوم هودسون أودوي',
      aliases: ['هودسون أودوي', 'hudson odoi'],
      photo: 'https://cdn.sofifa.net/players/240/740/25_120.png',
      clubs: ['تشيلسي', 'باير ليفركوزن', 'نوتينغهام فورست']
    },
    {
      id: 'p_anthony_elanga',
      name: 'أنتوني إيلانغا',
      aliases: ['إيلانغا', 'elanga'],
      photo: 'https://cdn.sofifa.net/players/258/155/25_120.png',
      clubs: ['مانشستر يونايتد', 'نوتينغهام فورست']
    },
    {
      id: 'p_morgan_gibbs_white',
      name: 'مورغان غيبس وايت',
      aliases: ['غيبس وايت', 'gibbs white'],
      photo: 'https://cdn.sofifa.net/players/237/238/25_120.png',
      clubs: ['وولفرهامبتون', 'سوانزي سيتي', 'شيفيلد يونايتد', 'نوتينغهام فورست']
    },
    {
      id: 'p_adama_traore',
      name: 'أداما تراوري',
      aliases: ['تراوري', 'adama traore'],
      photo: 'https://cdn.sofifa.net/players/213/956/25_120.png',
      clubs: ['برشلونة', 'أستون فيلا', 'ميدلزبره', 'وولفرهامبتون', 'فولهام']
    },
    {
      id: 'p_pedro_neto',
      name: 'بيدرو نيتو',
      aliases: ['نيتو الجناح', 'pedro neto'],
      photo: 'https://cdn.sofifa.net/players/241/096/25_120.png',
      clubs: ['سبورتينغ براغا', 'لاتسيو', 'وولفرهامبتون', 'تشيلسي']
    },
    {
      id: 'p_matheus_cunha',
      name: 'ماتيوس كونيا',
      aliases: ['كونيا', 'cunha'],
      photo: 'https://cdn.sofifa.net/players/240/218/25_120.png',
      clubs: ['كوريتيبا', 'سيون', 'لايبزيغ', 'هيرتا برلين', 'أتلتيكو مدريد', 'وولفرهامبتون']
    },
    {
      id: 'p_joao_palhinha',
      name: 'جواو بالينيا',
      aliases: ['بالينيا', 'palhinha'],
      photo: 'https://cdn.sofifa.net/players/226/228/25_120.png',
      clubs: ['سبورتينغ لشبونة', 'موريرينسي', 'بيلينينسش', 'سبورتينغ براغا', 'فولهام', 'بايرن ميونخ']
    },
    {
      id: 'p_andreas_pereira',
      name: 'أندرياس بيريرا',
      aliases: ['بيريرا', 'andreas pereira'],
      photo: 'https://cdn.sofifa.net/players/220/834/25_120.png',
      clubs: ['مانشستر يونايتد', 'غرناطة', 'فالنسيا', 'لاتسيو', 'فلامنغو', 'فولهام']
    },
    {
      id: 'p_alexander_isak',
      name: 'ألكسندر إيزاك',
      aliases: ['إيزاك', 'isak'],
      photo: 'https://cdn.sofifa.net/players/234/236/25_120.png',
      clubs: ['أيك سولنا', 'بوروسيا دورتموند', 'فيلم تو', 'ريال سوسيداد', 'نيوكاسل يونايتد']
    },
    {
      id: 'p_kieran_trippier',
      name: 'كيران تريبير',
      aliases: ['تريبير', 'trippier'],
      photo: 'https://cdn.sofifa.net/players/186/390/25_120.png',
      clubs: ['مانشستر سيتي', 'بارنسلي', 'بيرنلي', 'توتنهام', 'أتلتيكو مدريد', 'نيوكاسل يونايتد']
    },
    {
      id: 'p_sandro_tonali',
      name: 'ساندرو تونالي',
      aliases: ['تونالي', 'tonali'],
      photo: 'https://cdn.sofifa.net/players/241/096/25_120.png',
      clubs: ['بريشيا', 'ميلان', 'نيوكاسل يونايتد']
    },
    {
      id: 'p_sven_botman',
      name: 'سفين بوتمان',
      aliases: ['بوتمان', 'botman'],
      photo: 'https://cdn.sofifa.net/players/243/580/25_120.png',
      clubs: ['أياكس أمستردام', 'هيرنفين', 'ليل', 'نيوكاسل يونايتد']
    },
    {
      id: 'p_bruno_guimaraes',
      name: 'برونو غيماريش',
      aliases: ['غيماريش', 'bruno guimaraes'],
      photo: 'https://cdn.sofifa.net/players/247/263/25_120.png',
      clubs: ['أتلتيكو باراناينسي', 'ليون', 'نيوكاسل يونايتد']
    },
    {
      id: 'p_ollie_watkins',
      name: 'أولي واتكينز',
      aliases: ['واتكينز', 'watkins'],
      photo: 'https://cdn.sofifa.net/players/226/491/25_120.png',
      clubs: ['إكستر سيتي', 'ويستون سوبر ماري', 'برينتفورد', 'أستون فيلا']
    },
    {
      id: 'p_youri_tielemans',
      name: 'يوري تيليمانس',
      aliases: ['تيليمانس', 'tielemans'],
      photo: 'https://cdn.sofifa.net/players/216/352/25_120.png',
      clubs: ['أندرلخت', 'موناكو', 'ليستر سيتي', 'أستون فيلا']
    },
    {
      id: 'p_pau_torres',
      name: 'باو توريس',
      aliases: ['توريس', 'pau torres'],
      photo: 'https://cdn.sofifa.net/players/240/130/25_120.png',
      clubs: ['فياريال', 'مالاغا', 'أستون فيلا']
    },
    {
      id: 'p_am状態でadu_onana',
      name: 'أمادو أونانا',
      aliases: ['أمادو', 'amado onana'],
      photo: 'https://cdn.sofifa.net/players/258/171/25_120.png',
      clubs: ['هامبورغ', 'ليل', 'إيفرتون', 'أستون فيلا']
    },
    {
      id: 'p_diego_carlos',
      name: 'دييغو كارلوس',
      aliases: ['كارلوس المدافع', 'diego carlos'],
      photo: 'https://cdn.sofifa.net/players/223/959/25_120.png',
      clubs: ['إشتوريل', 'بورتو', 'نانت', 'إشبيلية', 'أستون فيلا']
    },
    {
      id: 'p_jarrod_bowen',
      name: 'جارود بوين',
      aliases: ['بوين', 'bowen'],
      photo: 'https://cdn.sofifa.net/players/225/105/25_120.png',
      clubs: ['هيرفورد', 'هال سيتي', 'وست هام']
    },
    {
      id: 'p_lucas_paqueta',
      name: 'لوكاس باكيتا',
      aliases: ['باكيتا', 'paqueta'],
      photo: 'https://cdn.sofifa.net/players/234/906/25_120.png',
      clubs: ['فلامنغو', 'ميلان', 'ليون', 'وست هام']
    },
    {
      id: 'p_mohammed_kudus',
      name: 'محمد قدوس',
      aliases: ['قدوس', 'kudus'],
      photo: 'https://cdn.sofifa.net/players/246/186/25_120.png',
      clubs: ['نوردشيلاند', 'أياكس أمستردام', 'وست هام']
    },
    {
      id: 'p_edson_alvarez',
      name: 'إدسون ألفاريز',
      aliases: ['ألفاريز المدافع', 'edson alvarez'],
      photo: 'https://cdn.sofifa.net/players/236/007/25_120.png',
      clubs: ['أمريكا', 'أياكس أمستردام', 'وست هام']
    },
    {
      id: 'p_eberechi_eze',
      name: 'إيبريشي إيزي',
      aliases: ['إيزي', 'eze'],
      photo: 'https://cdn.sofifa.net/players/235/790/25_120.png',
      clubs: ['كوينز بارك رينجرز', 'ويكومب', 'كريستال بالاس']
    },
    {
      id: 'p_michael_olise',
      name: 'مايكل أوليس',
      aliases: ['أوليس', 'olise'],
      photo: 'https://cdn.sofifa.net/players/247/090/25_120.png',
      clubs: ['ريدينغ', 'كريستال بالاس', 'بايرن ميونخ']
    },
    {
      id: 'p_jean_philippe_mateta',
      name: 'جان فيليب ماتيتا',
      aliases: ['ماتيتا', 'mateta'],
      photo: 'https://cdn.sofifa.net/players/235/410/25_120.png',
      clubs: ['شاتورو', 'ليون', 'لوهافر', 'ماينتس', 'كريستال بالاس']
    },
    {
      id: 'p_james_maddison',
      name: 'جيمس ماديسون',
      aliases: ['ماديسون', 'maddison'],
      photo: 'https://cdn.sofifa.net/players/220/697/25_120.png',
      clubs: ['كوفنتري سيتي', 'نورويتش سيتي', 'أبردين', 'ليستر سيتي', 'توتنهام']
    },
    {
      id: 'p_son_heung_min',
      name: 'سون هيونغ مين',
      aliases: ['سون', 'son'],
      photo: 'https://cdn.sofifa.net/players/200/104/25_120.png',
      clubs: ['هامبورغ', 'باير ليفركوزن', 'توتنهام']
    },
    {
      id: 'p_dejan_kulusevski',
      name: 'ديجان كولوسيفسكي',
      aliases: ['كولوسيفسكي', 'kulusevski'],
      photo: 'https://cdn.sofifa.net/players/244/263/25_120.png',
      clubs: ['أتالانتا', 'بارما', 'يوفنتوس', 'توتنهام']
    },
    {
      id: 'p_cristian_romero',
      name: 'كريستيان روميرو',
      aliases: ['روميرو', 'كوتي', 'romero'],
      photo: 'https://cdn.sofifa.net/players/232/488/25_120.png',
      clubs: ['أتلتيكو بلغرانو', 'جنوى', 'يوفنتوس', 'أتالانتا', 'توتنهام']
    },
    {
      id: 'p_pedro_porro',
      name: 'بيدرو بورو',
      aliases: ['بورو', 'pedro porro'],
      photo: 'https://cdn.sofifa.net/players/244/855/25_120.png',
      clubs: ['بيرالادا', 'جيرونا', 'مانشستر سيتي', 'بلد الوليد', 'سبورتينغ لشبونة', 'توتنهام']
    },
    {
      id: 'p_jordan_pickford',
      name: 'جوردان بيكفورد',
      aliases: ['بيكفورد', 'pickford'],
      photo: 'https://cdn.sofifa.net/players/204/935/25_120.png',
      clubs: ['سندرلاند', 'دارلينجتون', 'ألفريتون', 'بيرتون', 'كارلايل', 'برادفورد', 'بريستون', 'إيفرتون']
    },
    {
      id: 'p_dominic_calvert_lewin',
      name: 'دومينيك كالفيرت ليوين',
      aliases: ['كالفيرت ليوين', 'calvert lewin'],
      photo: 'https://cdn.sofifa.net/players/225/116/25_120.png',
      clubs: ['شيفيلد يونايتد', 'ستاليبريدج', 'نورثامبتون', 'إيفرتون']
    },
    {
      id: 'p_dwight_mcneil',
      name: 'دوايت ماكنيل',
      aliases: ['ماكنيل', 'mcneil'],
      photo: 'https://cdn.sofifa.net/players/243/287/25_120.png',
      clubs: ['بيرنلي', 'إيفرتون']
    },
    {
      id: 'p_james_tarkowski',
      name: 'جيمس تاركوفسكي',
      aliases: ['تاركوفسكي', 'tarkowski'],
      photo: 'https://cdn.sofifa.net/players/205/923/25_120.png',
      clubs: ['أولدهام', 'برينتفورد', 'بيرنلي', 'إيفرتون']
    },
    {
      id: 'p_taylor_harwood_bellis',
      name: 'تايلور هاروود بيليس',
      aliases: ['هاروود بيليس', 'harwood bellis'],
      photo: 'https://cdn.sofifa.net/players/251/852/25_120.png',
      clubs: ['مانشستر سيتي', 'بلاكبيرن', 'أندرلخت', 'ستوك سيتي', 'بيرنلي', 'ساوثهامبتون']
    },
    {
      id: 'p_kyle_walker_peters',
      name: 'كايل ووكر بيترز',
      aliases: ['ووكر بيترز', 'walker peters'],
      photo: 'https://cdn.sofifa.net/players/227/927/25_120.png',
      clubs: ['توتنهام', 'ساوثهامبتون']
    },
    {
      id: 'p_liam_delap',
      name: 'ليام ديلاب',
      aliases: ['ديلاب', 'delap'],
      photo: 'https://cdn.sofifa.net/players/258/155/25_120.png',
      clubs: ['مانشستر سيتي', 'ستوك سيتي', 'بريستون', 'هال سيتي', 'إيبسويتش تاون']
    },
    {
      id: 'p_leif_davis',
      name: 'ليف ديفيس',
      aliases: ['ديفيس', 'leif davis'],
      photo: 'https://cdn.sofifa.net/players/246/186/25_120.png',
      clubs: ['موركامب', 'ليدز يونايتد', 'بورنموث', 'إيبسويتش تاون']
    },
    {
      id: 'p_ivan_rakitic',
      name: 'إيفان راكيتيتش',
      aliases: ['راكيتيتش', 'rakitic'],
      photo: 'https://cdn.sofifa.net/players/168/651/25_120.png',
      clubs: ['بازل', 'شالكه', 'إشبيلية', 'برشلونة', 'الشباب', 'هايدوك سبليت']
    },
    {
      id: 'p_jesus_navas',
      name: 'خيسوس نافاس',
      aliases: ['نافاس الجناح', 'jesus navas'],
      photo: 'https://cdn.sofifa.net/players/146/562/25_120.png',
      clubs: ['إشبيلية', 'مانشستر سيتي']
    },
    {
      id: 'p_dani_alves',
      name: 'داني ألفيس',
      aliases: ['ألفيس', 'داني الفيس', 'alves'],
      photo: 'https://cdn.sofifa.net/players/146/536/25_120.png',
      clubs: ['باهيا', 'إشبيلية', 'برشلونة', 'يوفنتوس', 'باريس سان جيرمان', 'ساو باولو', 'بوماس']
    },
    {
      id: 'p_alexander_sorloth',
      name: 'ألكسندر سورلوث',
      aliases: ['سورلوث', 'sorloth'],
      photo: 'https://cdn.sofifa.net/players/219/683/25_120.png',
      clubs: ['روزنبورغ', 'بودو غليمت', 'غرونينغن', 'ميتييلاند', 'كريستال بالاس', 'غينت', 'طرابزون سبور', 'لايبزيغ', 'ريال سوسيداد', 'فياريال', 'أتلتيكو مدريد']
    },
    {
      id: 'p_dani_parejo',
      name: 'داني باريخو',
      aliases: ['باريخو', 'parejo'],
      photo: 'https://cdn.sofifa.net/players/189/509/25_120.png',
      clubs: ['ريال مدريد', 'كوينز بارك رينجرز', 'خيتافي', 'فالنسيا', 'فياريال']
    },
    {
      id: 'p_raul_albiol',
      name: 'راؤول ألبيول',
      aliases: ['ألبيول', 'albiol'],
      photo: 'https://cdn.sofifa.net/players/164/835/25_120.png',
      clubs: ['فالنسيا', 'خيتافي', 'ريال مدريد', 'نابولي', 'فياريال']
    },
    {
      id: 'p_matteo_darmian',
      name: 'ماتيو دارميان',
      aliases: ['دارميان', 'darmian'],
      photo: 'https://cdn.sofifa.net/players/184/344/25_120.png',
      clubs: ['ميلان', 'بادوفا', 'باليرمو', 'تورينو', 'مانشستر يونايتد', 'بارما', 'إنتر ميلان']
    },
    {
      id: 'p_lautaro_martinez',
      name: 'لاوتارو مارتينيز',
      aliases: ['التورو', 'لاوتارو', 'lautaro'],
      photo: 'https://cdn.sofifa.net/players/231/478/25_120.png',
      clubs: ['راسينغ كلوب', 'إنتر ميلان']
    },
    {
      id: 'p_marcus_thuram',
      name: 'ماركوس تورام',
      aliases: ['تورام', 'thuram'],
      photo: 'https://cdn.sofifa.net/players/228/092/25_120.png',
      clubs: ['سوشو', 'غانغان', 'بوروسيا مونشنغلادباخ', 'إنتر ميلان']
    },
    {
      id: 'p_theo_hernandez',
      name: 'ثيو هيرنانديز',
      aliases: ['ثيو', 'theo hernandez'],
      photo: 'https://cdn.sofifa.net/players/232/656/25_120.png',
      clubs: ['أتلتيكو مدريد', 'ألافيس', 'ريال مدريد', 'ريال سوسيداد', 'ميلان']
    },
    {
      id: 'p_rafael_leao',
      name: 'رافاييل لياو',
      aliases: ['لياو', 'leao'],
      photo: 'https://cdn.sofifa.net/players/241/096/25_120.png',
      clubs: ['سبورتينغ لشبونة', 'ليل', 'ميلان']
    },
    {
      id: 'p_christian_pulisic',
      name: 'كريستيان بوليسيتش',
      aliases: ['بوليسيتش', 'كابتن أمريكا', 'pulisic'],
      photo: 'https://cdn.sofifa.net/players/227/796/25_120.png',
      clubs: ['بوروسيا دورتموند', 'تشيلسي', 'ميلان']
    },
    {
      id: 'p_ruben_loftus_cheek',
      name: 'روبن لوفتوس تشيك',
      aliases: ['لوفتوس تشيك', 'loftus cheek'],
      photo: 'https://cdn.sofifa.net/players/209/989/25_120.png',
      clubs: ['تشيلسي', 'كريستال بالاس', 'فولهام', 'ميلان']
    },
    {
      id: 'p_tammy_abraham',
      name: 'تامي أبراهام',
      aliases: ['أبراهام', 'abraham'],
      photo: 'https://cdn.sofifa.net/players/231/352/25_120.png',
      clubs: ['تشيلسي', 'بريستول سيتي', 'أستون فيلا', 'سوانزي سيتي', 'روما', 'ميلان']
    },
    {
      id: 'p_victor_osimhen',
      name: 'فيكتور أوسيمين',
      aliases: ['أوسيمين', 'قناع النينجا', 'osimhen'],
      photo: 'https://cdn.sofifa.net/players/232/293/25_120.png',
      clubs: ['فولفسبورغ', 'شارلروا', 'ليل', 'نابولي', 'غلطة سراي']
    },
    {
      id: 'p_khvicha_kvaratskhelia',
      name: 'خفيتشا كفاراتسخيليا',
      aliases: ['كفارا', 'كفاراتسخيليا', 'kvara'],
      photo: 'https://cdn.sofifa.net/players/247/635/25_120.png',
      clubs: ['دينامو تبليسي', 'روستوف', 'روبين كازان', 'دينامو باتومي', 'نابولي']
    },
    {
      id: 'p_paulo_dybala',
      name: 'باولو ديبالا',
      aliases: ['ديبالا', 'الجوهرة', 'dybala'],
      photo: 'https://cdn.sofifa.net/players/211/110/25_120.png',
      clubs: ['معهد كوردوبا', 'باليرمو', 'يوفنتوس', 'روما']
    },
    {
      id: 'p_florian_wirtz',
      name: 'فلوريان فيرتز',
      aliases: ['فيرتز', 'الموهبة الألمانية', 'wirtz'],
      photo: 'https://cdn.sofifa.net/players/256/630/25_120.png',
      clubs: ['كولن', 'باير ليفركوزن']
    },
    {
      id: 'p_jeremie_frimpong',
      name: 'جيريمي فريمبونغ',
      aliases: ['فريمبونغ', 'الصاعقة', 'frimpong'],
      photo: 'https://cdn.sofifa.net/players/253/149/25_120.png',
      clubs: ['مانشستر سيتي', 'سيلتيك', 'باير ليفركوزن']
    },
    {
      id: 'p_granit_xhaka',
      name: 'غرانيت تشاكا',
      aliases: ['تشاكا', 'القائد', 'xhaka'],
      photo: 'https://cdn.sofifa.net/players/200/389/25_120.png',
      clubs: ['بازل', 'بوروسيا مونشنغلادباخ', 'أرسنال', 'باير ليفركوزن']
    },
    {
      id: 'p_alejandro_grimaldo',
      name: 'أليخاندرو غريمالدو',
      aliases: ['غريمالدو', 'grimaldo'],
      photo: 'https://cdn.sofifa.net/players/209/889/25_120.png',
      clubs: ['برشلونة', 'بنفيكا', 'باير ليفركوزن']
    },
    {
      id: 'p_alvaro_arbeloa',
      name: 'ألفارو أربيلوا',
      aliases: ['أربيلوا', 'arbeloa'],
      photo: 'https://cdn.sofifa.net/players/054/035/25_120.png',
      clubs: ['ريال مدريد', 'ديبورتيفو لاكورونيا', 'ليفربول', 'وست هام']
    },
    {
      id: 'p_javier_mascherano',
      name: 'خافيير ماسكيرانو',
      aliases: ['ماسكيرانو', 'الزعيم الصغير', 'mascherano'],
      photo: 'https://cdn.sofifa.net/players/141/024/25_120.png',
      clubs: ['ريفر بليت', 'كورينثيانز', 'وست هام', 'ليفربول', 'برشلونة', 'هيبي تشاينا', 'إستوديانتيس']
    },
    {
      id: 'p_lucas_vazquez',
      name: 'لوكاس فاسكيز',
      aliases: ['فاسكيز', 'lucas vazquez'],
      photo: 'https://cdn.sofifa.net/players/208/618/25_120.png',
      clubs: ['إسبانيول', 'ريال مدريد']
    },
    {
      id: 'p_rodrygo_goes',
      name: 'رودريغو',
      aliases: ['رودريغو غوس', 'rodrygo'],
      photo: 'https://cdn.sofifa.net/players/243/812/25_120.png',
      clubs: ['سانتوس', 'ريال مدريد']
    },
    {
      id: 'p_pedri_gonzalez',
      name: 'بيدري',
      aliases: ['بيدري غونزاليس', 'pedri'],
      photo: 'https://cdn.sofifa.net/players/251/854/25_120.png',
      clubs: ['لاس بالماس', 'برشلونة']
    },
    {
      id: 'p_gavi_paez',
      name: 'جافي',
      aliases: ['بابلو جافي', 'gavi'],
      photo: 'https://cdn.sofifa.net/players/264/240/25_120.png',
      clubs: ['ريال بيتيس', 'برشلونة']
    },
    {
      id: 'p_lamine_yamal',
      name: 'لامين يامال',
      aliases: ['يامال', 'لامين', 'yamal'],
      photo: 'https://cdn.sofifa.net/players/271/588/25_120.png',
      clubs: ['برشلونة']
    }
  ];

  // Merge curated players and additional historical players
  const playerMap = new Map();

  // Helper to normalize and add player
  const addPlayer = (p) => {
    if (!p || !p.name) return;
    const cleanId = p.id || `p_${normalizeArabic(p.name).replace(/\s+/g, '_')}`;

    // Ensure all clubs are strings and trimmed
    const validClubs = (p.clubs || [])
      .map(c => typeof c === 'string' ? c.trim() : '')
      .filter(c => c.length > 0);

    const existing = playerMap.get(cleanId);
    if (existing) {
      // Merge clubs and aliases
      const mergedClubs = Array.from(new Set([...existing.clubs, ...validClubs]));
      const mergedAliases = Array.from(new Set([...existing.aliases, ...(p.aliases || [])]));
      playerMap.set(cleanId, {
        ...existing,
        photo: p.photo || existing.photo,
        clubs: mergedClubs,
        aliases: mergedAliases
      });
    } else {
      playerMap.set(cleanId, {
        id: cleanId,
        name: p.name.trim(),
        aliases: Array.from(new Set(p.aliases || [p.name])),
        photo: p.photo || `https://cdn.sofifa.net/players/default/25_120.png`,
        clubs: Array.from(new Set(validClubs))
      });
    }
  };

  // Add all curated players
  curatedPlayers.forEach(addPlayer);
  // Add all additional historical players
  ADDITIONAL_HISTORICAL_PLAYERS.forEach(addPlayer);

  const finalPlayers = Array.from(playerMap.values());
  console.log(`✓ Total unique compiled players: ${finalPlayers.length}`);

  // Construct master object
  const masterPayload = {
    clubs: CLUBS_SCOPE,
    players: finalPlayers
  };

  // Write to src/data/footballHistoricalMaster.json
  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(masterPayload, null, 2), 'utf8');
  console.log(`✓ Successfully saved master database to: ${OUTPUT_JSON_PATH}`);

  // Test mutual links for verification
  const alHilalAlIttihad = finalPlayers.filter(p => p.clubs.includes('الهلال') && p.clubs.includes('الاتحاد'));
  console.log(`✓ Verification: Players who played for both الهلال and الاتحاد: ${alHilalAlIttihad.length}`);
  console.log(`  Sample matches: ${alHilalAlIttihad.slice(0, 5).map(p => p.name).join('، ')}`);

  const realBarca = finalPlayers.filter(p => p.clubs.includes('ريال مدريد') && p.clubs.includes('برشلونة'));
  console.log(`✓ Verification: Players who played for both ريال مدريد and برشلونة: ${realBarca.length}`);
  console.log(`  Sample matches: ${realBarca.slice(0, 5).map(p => p.name).join('، ')}`);
}

buildMaster();
