import { DraftCondition } from '../../../data/draftConditions';
import { FootballPlayer } from '../../../data/footballMasterData';

export type DraftPosition = 'GK' | 'DEF_1' | 'DEF_2' | 'MID' | 'FWD';

export const DRAFT_POSITION_NAMES: Record<DraftPosition, string> = {
  GK: 'حارس مرمى (GK)',
  DEF_1: 'مدافع أول (DEF 1)',
  DEF_2: 'مدافع ثانٍ (DEF 2)',
  MID: 'خط وسط (MID)',
  FWD: 'مهاجم (FWD)',
};

export const DRAFT_POSITION_SHORT_NAMES: Record<DraftPosition, string> = {
  GK: 'حارس',
  DEF_1: 'مدافع 1',
  DEF_2: 'مدافع 2',
  MID: 'وسط',
  FWD: 'مهاجم',
};

export const DRAFT_SLOTS_ORDER: DraftPosition[] = [
  'GK',
  'DEF_1',
  'DEF_2',
  'MID',
  'FWD'
];

export type DraftPhase = 'LOBBY' | 'DRAFTING' | 'AI_REVEAL' | 'MATCH_OVER';

export interface DraftContestantPick {
  position: DraftPosition;
  player: FootballPlayer;
  roundConditionId?: string;
  roundConditionTitle?: string;
  roundConditionPrompt?: string;
  pickedAtRound: number;
}

export interface DraftContestant {
  id: string;
  name: string;
  isReady?: boolean;
  picks: Record<DraftPosition, FootballPlayer | null>;
  // Store condition applied to each slot pick
  pickConditions?: Record<DraftPosition, DraftCondition | null>;
  score?: number;
}

export interface PlayerConditionVerification {
  position: DraftPosition;
  playerName: string;
  conditionTitle: string;
  isValid: boolean;
  reason: string;
}

export interface SquadAIEvaluation {
  playerId: string;
  playerName: string;
  validConditionsCount: number; // 0 to 5
  conditionVerifications: PlayerConditionVerification[];
  ratings: {
    gk: number;        // out of 100
    defense: number;   // out of 100 (DEF_1 + DEF_2)
    midfield: number;  // out of 100
    attack: number;    // out of 100
    synergy: number;   // out of 100
  };
  overallPercentage: number; // e.g. 88%
  critiqueTitle: string;     // e.g. 'هجوم فتاك ودفاع يغرق في شبر مية'
  detailedBreakdown: {
    strengths: string[];     // نقاط القوة
    weaknesses: string[];    // نقاط الضعف
    tacticalSummary: string; // تحليل تكتيكي ساخر ودقيق
  };
}

export interface DraftVerdictResult {
  evaluations: SquadAIEvaluation[];
  winnerId: string;
  winnerName: string;
  isTie: boolean;
  tiedContestantIds: string[];
  maxConditionsMet: number;
  verdictBanner: string; // e.g. "فريق مازن حقق 5/5 شروط وفاز بالبطولة!" or "تعادل في الشروط! جاري تفعيل المقارنة التكتيكية..."
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
  activeCondition?: DraftCondition;
  turnOrder?: string[];     // Array of playerIds in order for current round
  currentPickerId?: string; // PlayerId who has the turn
  currentPickerName?: string;
  pickedPosition?: DraftPosition;
  pickedPlayer?: FootballPlayer;
  appliedCondition?: DraftCondition;
  draftedPlayerIds?: string[]; // Global anti-steal list
  evaluations?: SquadAIEvaluation[];
  verdictResult?: DraftVerdictResult;
  contestants?: DraftContestant[];
  targetPlayerId?: string;
  playerId?: string;
  playerName?: string;
  isReady?: boolean;
}
