// src/pages/ai/who-is-ai/services/answerProfiler.ts
import { RoomQuestion, RoomAnswer } from '../types';

export interface PlayerStyleProfile {
  medianWords: number;
  emojiRatio: number; // 0 to 100 percentage
  punctuationRatio: number; // 0 to 100 percentage
  charRepetitionRatio: number; // 0 to 100 percentage
  sampleAnswers: string[];
  stylePromptGuidance: string;
}

const emojiRegex = /\p{Extended_Pictographic}/u;

function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 5;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function profileGroupStyle(questions: RoomQuestion[], answers: RoomAnswer[]): PlayerStyleProfile {
  // Extract all human answers across all questions (excluding AI and skipped/empty)
  const validHumanAnswers = answers.filter(
    (a) => !a.isAi && a.text && a.text.trim().length > 0 && a.text.trim() !== '—' && a.text.trim() !== 'سلكت وسكتت'
  );

  if (validHumanAnswers.length === 0) {
    return {
      medianWords: 5,
      emojiRatio: 0,
      punctuationRatio: 0,
      charRepetitionRatio: 20,
      sampleAnswers: [],
      stylePromptGuidance: 'طول إجاباتك قريب من 5 كلمات، وتنوّع بين أقصر وأطول.'
    };
  }

  // Word counts
  const wordCounts = validHumanAnswers.map((a) => a.text.trim().split(/\s+/).filter(Boolean).length);
  const medianWords = Math.max(2, Math.min(12, calculateMedian(wordCounts)));

  // Emoji count
  const withEmoji = validHumanAnswers.filter((a) => emojiRegex.test(a.text)).length;
  const emojiRatio = Math.round((withEmoji / validHumanAnswers.length) * 100);

  // Ending punctuation (., ! ?)
  const withPunctuation = validHumanAnswers.filter((a) => /[.،؛!؟?~]$/.test(a.text.trim())).length;
  const punctuationRatio = Math.round((withPunctuation / validHumanAnswers.length) * 100);

  // Character repetition (e.g. ههههه, لاااا)
  const withCharRepetition = validHumanAnswers.filter((a) => /(.)\1{2,}/.test(a.text)).length;
  const charRepetitionRatio = Math.round((withCharRepetition / validHumanAnswers.length) * 100);

  // Pick 6 to 8 random sample answers across different questions
  const shuffled = [...validHumanAnswers].sort(() => 0.5 - Math.random());
  const selectedSamples: string[] = [];
  const seenQuestionIds = new Set<string>();

  // Prioritize distinct questions
  for (const item of shuffled) {
    if (!seenQuestionIds.has(item.questionId)) {
      seenQuestionIds.add(item.questionId);
      selectedSamples.push(item.text.trim());
      if (selectedSamples.length >= 8) break;
    }
  }

  // If fewer than 6, fill from remaining
  if (selectedSamples.length < 6) {
    for (const item of shuffled) {
      if (!selectedSamples.includes(item.text.trim())) {
        selectedSamples.push(item.text.trim());
        if (selectedSamples.length >= 8) break;
      }
    }
  }

  const promptGuidance = `طول إجاباتك قريب من ${medianWords} كلمات، وتنوّع بين أقصر وأطول.`;

  return {
    medianWords,
    emojiRatio,
    punctuationRatio,
    charRepetitionRatio,
    sampleAnswers: selectedSamples,
    stylePromptGuidance: promptGuidance
  };
}
