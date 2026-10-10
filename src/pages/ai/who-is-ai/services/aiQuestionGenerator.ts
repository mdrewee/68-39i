// src/pages/ai/who-is-ai/services/aiQuestionGenerator.ts
import { supabase } from '../../../../lib/supabase';

export const generateContextualAiQuestion = async (
  humanQuestions: string[],
  aiAvatar: string
): Promise<string> => {
  if (!humanQuestions || humanQuestions.length === 0) {
    return 'وش أكثر موقف محرج صار لك وتتمنى تموت من الفشلة؟';
  }

  try {
    // Try who-is-ai-question first, fallback to who-is-ai
    let response = await supabase.functions.invoke('who-is-ai-question', {
      body: { humanQuestions, aiAvatar }
    });

    if (response.error || !response.data?.question) {
      response = await supabase.functions.invoke('who-is-ai', {
        body: {
          action: 'generate_question',
          aiAvatarName: aiAvatar,
          existingQuestions: humanQuestions
        }
      });
    }

    if (response.error || !response.data?.question) {
      throw response.error || new Error('No question returned');
    }

    return response.data.question.trim().replace(/[.،؛!؟"'`*]/g, '');
  } catch (err) {
    console.warn('[AI Question Generator] Fallback applied:', err);
    const fallbacks = [
      'وش أسوأ كذبة مشيتها على أهلك وعاشت سنين؟',
      'لو تقدر تكنسل شي واحد من المجتمع للأبد وش تختار؟',
      'وش أكثر شي ودك تقوله لأخوياك الحين بس مستحي؟',
      'وش أكثر تصرف ينرفزك بالجمعات وتكتم غيظك؟',
      'لو جاك اتصال بنص الليل وقالوا قطيتك 500 ريال وش ترد؟'
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
};
