import { DraftCondition } from '../../../data/draftConditions';
import { FootballPlayer } from '../../../data/footballMasterData';

export type DraftPosition = 'GK' | 'DEF' | 'MID' | 'FWD' | 'WILDCARD';

export const DRAFT_POSITION_NAMES: Record<DraftPosition, string> = {
  GK: 'حارس مرمى (GK)',
  DEF: 'مدافع (DEF)',
  MID: 'لاعب وسط (MID)',
  FWD: 'مهاجم (FWD)',
  WILDCARD: 'جوكر / ورقة رابحة (أي مركز)',
};

export const DRAFT_ROUND_POSITIONS: DraftPosition[] = [
  'GK',
  'DEF',
  'MID',
  'FWD',
  'WILDCARD'
];

export type DraftPhase = 'LOBBY' | 'DRAFTING' | 'AI_REVEAL' | 'MATCH_OVER';

export interface DraftPlayerPick {
  position: DraftPosition;
  player: FootballPlayer;
  pickedAtRound: number;
}

export interface DraftContestant {
  id: string;
  name: string;
  isReady?: boolean;
  picks: Record<DraftPosition, FootballPlayer | null>;
  score?: number;
}

export interface SquadAIEvaluation {
  playerId: string;
  playerName: string;
  ratings: {
    gk: number;        // out of 100
    defense: number;   // out of 100
    midfield: number;  // out of 100
    attack: number;    // out of 100
    synergy: number;   // out of 100
  };
  overallPercentage: number; // e.g. 88%
  critiqueTitle: string;     // e.g. 'هجوم فتاك ودفاع يغرق في شبر مية'
  detailedBreakdown: {
    strengths: string[];     // نقاط القوة
    weaknesses: string[];    // نقاط الضعف
    tacticalSummary: string; // تحليل تكتيكي ساخر ودقيق بأسلوب محلل استراحة
  };
}

export type DraftAction =
  | 'PLAYER_READY'
  | 'KICK_PLAYER'
  | 'GAME_START'
  | 'PICK_LOCKED'
  | 'ROUND_ADVANCE'
  | 'AI_EVALUATION_START'
  | 'AI_EVALUATION_DONE'
  | 'RESET_LOBBY'
  | 'ROOM_TERMINATED';

export interface DraftEventPayload {
  action: DraftAction;
  phase?: DraftPhase;
  round?: number;           // 1 to 5
  activePosition?: DraftPosition;
  activeCondition?: DraftCondition;
  turnOrder?: string[];     // Array of playerIds in order for current round
  currentPickerId?: string; // PlayerId who has the turn
  currentPickerName?: string;
  pickedPosition?: DraftPosition;
  pickedPlayer?: FootballPlayer;
  draftedPlayerIds?: string[]; // Global anti-steal list
  evaluations?: SquadAIEvaluation[];
  contestants?: DraftContestant[];
  targetPlayerId?: string;
  playerId?: string;
  playerName?: string;
  isReady?: boolean;
}
