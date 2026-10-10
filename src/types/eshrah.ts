export type EshrahTeamId = 'team_1' | 'team_2';

export interface EshrahPlayer {
  id: string;
  name: string;
  teamId?: EshrahTeamId | null;
  isHost?: boolean;
}

export type EshrahCategory =
  | 'football'      // كرة قدم
  | 'tv_series'     // مسلسلات
  | 'movies'        // أفلام
  | 'proverbs'      // حكمة ومثل
  | 'theater'       // مسرحية
  | 'tools'         // أدوات وأشياء
  | 'food'          // أكلات
  | 'countries';    // دول

export interface EshrahPromptItem {
  id: string;
  category: EshrahCategory;
  text: string;                  // The main word / sentence / title
  forbiddenWords?: string[];     // 3-4 forbidden words for "كلمات محظورة"
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface EshrahTeamState {
  id: EshrahTeamId;
  name: string;
  color: string;                 // Hex or Tailwind class
  score: number;                 // Strictly in pt
  players: EshrahPlayer[];
}

export type EshrahGamePhase =
  | 'TEAMS'          // Team selection screen
  | 'CATEGORIES'     // Host multi-select categories
  | 'ROUND_READY'    // Ready screen before round starts
  | 'PLAYING'        // Active timer / gameplay
  | 'STEAL_WINDOW'   // Steal chance window for opponent team
  | 'ROUND_RESULT'   // Turn summary
  | 'PODIUM';        // Final match podium
