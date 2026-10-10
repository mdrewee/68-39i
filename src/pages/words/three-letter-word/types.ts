export type ThreeLetterPhase =
  | 'LOBBY'
  | 'GAMEPLAY'
  | 'ROUND_WIN'
  | 'PODIUM';

export interface ThreeLetterCardItem {
  id: string;
  letter: string;     // Single Arabic letter (e.g. "ع", "ق", "ل")
  colorBg: string;    // Solid retro-brutalist hex color (e.g. "#C86D51")
}

export interface BoardSlotState {
  positionIndex: 0 | 1 | 2; // Right (0), Middle (1), Left (2)
  topCard: ThreeLetterCardItem;
  stackHistory: ThreeLetterCardItem[]; // History of cards stacked underneath
}

export interface ThreeLetterPlayer {
  id: string;
  name: string;
  cardsCount: number;
  hand?: ThreeLetterCardItem[];
  isReady?: boolean;
}

export interface MoveAttemptResult {
  isValid: boolean;
  resultingWord: string;
  errorMessage?: string;
}

export interface TurnEventNotification {
  playerId: string;
  playerName: string;
  prevLetter?: string;
  newLetter?: string;
  resultingWord?: string;
  type: 'VALID_MOVE' | 'INVALID_PENALTY' | 'DRAW_PASS' | 'TIMEOUT';
  timestamp: number;
}
