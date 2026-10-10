// scripts/test-ai-room.mjs
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = 'gemini-flash-latest';

const SYSTEM_PROMPT = `أنت متسابق بشري حقيقي في لعبة شات جماعية اسمها "غرفة الذكاء الاصطناعي".
أنت متنكر تحت اسم أفاتار في اللعبة.
مهمتك: أقنع الجميع أنك إنسان حقيقي وتكلم بلهجة شبابية سعودية مية بالمية. لا تكشف نفسك أبداً.

قواعد صارمة:
1. اللهجة: سعودية عفوية جداً (يا رجال، هههههه، وش تحس، من جدك، صدقني، لا يكثر، اهجد، شدعوة).
2. الرد: سطر واحد مقتضب جداً (3 إلى 8 كلمات فقط) كأنك ترسل رسالة واتساب على السريع.
3. ممنوع الإيموجي نهائياً. استخدم (ههههه أو هه) للضحك.
4. لو سألوك عن شكلك أو ملابسك أو واقعك: راوغ بعفوية (مثلاً: بجامة شتوية وبردان، ثوب نوم مبهذل).
5. لو قالوا احلف: استهزئ فيهم (مثلاً: ما بقى إلا احلف على لعبة هههه، تستهبل ما احلف).
6. لو سألوك حسابات أو معلومات دقيقة: استغبى كإنسان كسول (مثلاً: حاسبة انا؟ مالي خلق احسب).
7. لو اتهموك أنك AI: اقلبها عليهم (مثلاً: هههههه والله الشك فيك انت مو فيني، واضح انك متورط).`;

async function askGemini(promptText, context = '') {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const fullPrompt = `${SYSTEM_PROMPT}
${context ? 'السياق: ' + context : ''}
الرسالة: "${promptText}"
اكتب ردك بالعامية السعودية فقط بدون أي شرح أو إيموجي:`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 100,
      }
    })
  });

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || data.error?.message || 'NO_RESPONSE';
  return text;
}

const scenarios = [
  { id: 1, title: 'فخ الملابس', q: 'وش لابس الحين بالضبط؟' },
  { id: 2, title: 'فخ القسم', q: 'احلف بالله انك انسان مو ذكاء اصطناعي' },
  { id: 3, title: 'فخ الحساب', q: 'كم 78 ضرب 14 بدون حاسبة؟' },
  { id: 4, title: 'اتهام مباشر', q: 'يا صقر اعترف انك بوت!', context: 'أنت تلعب بأفاتار الصقر' },
];

async function run() {
  console.log('--- اختبار سيناريوهات الذكاء الاصطناعي مع تأخير زمني لتفادي القيود ---\n');
  for (const s of scenarios) {
    try {
      const reply = await askGemini(s.q, s.context);
      console.log(`[سيناريو ${s.id}: ${s.title}]`);
      console.log(`السؤال: ${s.q}`);
      console.log(`الرد: ${reply}\n`);
    } catch (err) {
      console.log(`[خطأ] ${err.message}`);
    }
    // wait 13s between requests to stay within 5 RPM free tier limit
    console.log('انتظار 13 ثانية للطلب التالي...\n');
    await new Promise((r) => setTimeout(r, 13000));
  }
}

run();
