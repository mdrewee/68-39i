// scripts/process-dictionary.js
import fs from 'fs';
import https from 'https';
import readline from 'readline';

// رابط القائمة الخام من مستودع CAMeL Lab (مع رابط بديل موثوق لترددات ويكيبيديا العربية في حال تعذر الأول)
const PRIMARY_URL = 'https://raw.githubusercontent.com/CAMeL-Lab/Camel_Arabic_Frequency_Lists/master/corpus_frequency/msa_wiki_freq.txt';
const FALLBACK_URL = 'https://raw.githubusercontent.com/a3f/arabic-wordlists/master/arwiki.freqlist';

const normalizeArabic = (word) => {
  return word
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة التشكيل
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
};

console.log('جاري تحميل القاموس ومعالجته...');

async function processStream(stream) {
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const wordleSet = new Set();
  const pentagonSet = new Set();

  for await (const line of rl) {
    const parts = line.trim().split(/\s+/);
    const rawWord = parts[0];
    if (!rawWord || !/^[\u0621-\u064A]+$/.test(rawWord)) continue;

    const clean = normalizeArabic(rawWord);

    // استبعاد الكلمات التي تبدأ بحروف عطف زائدة
    if (clean.startsWith('و') && clean.length > 3) continue;

    // تصنيف ووردل (5 حروف)
    if (clean.length === 5) {
      wordleSet.add(clean);
    }

    // تصنيف الخماسيات (من 3 إلى 6 حروف)
    if (clean.length >= 3 && clean.length <= 6) {
      pentagonSet.add(clean);
    }
  }

  if (!fs.existsSync('public/data')) {
    fs.mkdirSync('public/data', { recursive: true });
  }

  const wordleArr = Array.from(wordleSet);
  const pentagonArr = Array.from(pentagonSet);

  fs.writeFileSync('public/data/wordle_words.json', JSON.stringify(wordleArr));
  fs.writeFileSync('public/data/pentagon_words.json', JSON.stringify(pentagonArr));

  // دمج القاموس الموحد لجميع الألعاب
  const unifiedSet = new Set([...pentagonArr, ...wordleArr]);
  fs.writeFileSync('public/data/arabic_words.json', JSON.stringify(Array.from(unifiedSet)));

  console.log(`تم بنجاح! تم استخراج:`);
  console.log(`- كلمات ووردل: ${wordleSet.size} كلمة`);
  console.log(`- كلمات الخماسيات: ${pentagonSet.size} كلمة`);
}

function tryFetch(url, fallback) {
  https.get(url, (res) => {
    if (res.statusCode === 200) {
      processStream(res);
    } else if (fallback) {
      tryFetch(fallback, null);
    } else {
      console.error('خطأ: تعذر الوصول إلى رابط القاموس.');
    }
  }).on('error', (err) => {
    if (fallback) {
      tryFetch(fallback, null);
    } else {
      console.error('خطأ أثناء تحميل القاموس:', err.message);
    }
  });
}

tryFetch(PRIMARY_URL, FALLBACK_URL);
