import { DraftCondition } from '../../../data/draftConditions';
import { FootballPlayer } from '../../../data/footballMasterData';
import { DraftClub } from '../../../data/draftClubs';

export type DraftPosition = 'FWD' | 'MID' | 'DEF_1' | 'DEF_2' | 'GK';

export const DRAFT_POSITION_NAMES: Record<DraftPosition, string> = {
  FWD: 'مهاجم (FWD)',
  MID: 'خط وسط (MID)',
  DEF_1: 'مدافع أول (DEF 1)',
  DEF_2: 'مدافع ثانٍ (DEF 2)',
  GK: 'حارس مرمى (GK)',
};

export const DRAFT_POSITION_SHORT_NAMES: Record<DraftPosition, string> = {
  FWD: 'مهاجم',
  MID: 'وسط',
  DEF_1: 'مدافع 1',
  DEF_2: 'مدافع 2',
  GK: 'حارس',
};

// Formation grid order from Top (Attack) to Bottom (Goalie)
export const DRAFT_SLOTS_ORDER: DraftPosition[] = [
  'FWD',
  'MID',
  'DEF_1',
  'DEF_2',
  'GK',
];

export type DraftPhase = 'LOBBY' | 'DRAFTING' | 'AI_REVEAL' | 'MATCH_OVER';

export interface PlayerSquadSlot {
  playerName: string;
  conditionId?: string;
  conditionTitle?: string;
}

export interface PlayerSquad {
  playerId: string;
  playerName: string;
  teamLogo?: string;
  selectedClub?: DraftClub | null;
  slots: Partial<Record<DraftPosition, PlayerSquadSlot>>;
}

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
  selectedClub?: DraftClub | null;
  picks: Record<DraftPosition, FootballPlayer | null>;
  // Store condition applied to each slot pick
  pickConditions?: Record<DraftPosition, DraftCondition | null>;
  // Round scores / victories across the 5 rounds
  totalWins?: number;
  readyForNextRound?: boolean;
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
  selectedClub?: DraftClub | null;
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
  winnerClub?: DraftClub | null;
  isTie: boolean;
  tiedContestantIds: string[];
  maxConditionsMet: number;
  verdictBanner: string;
  tieBreakAnalysis?: string;
}

export type DraftAction =
  | 'PLAYER_READY'
  | 'KICK_PLAYER'
  | 'GAME_START'
  | 'PICK_LOCKED'
  | 'PLAYER_PICKED'
  | 'DRAFT_COMPLETE'
  | 'ROUND_ADVANCE'
  | 'AI_EVALUATION_START'
  | 'AI_EVALUATION_DONE'
  | 'PLAYER_NEXT_ROUND_READY'
  | 'START_NEXT_ROUND'
  | 'RESET_LOBBY'
  | 'ROOM_TERMINATED';

export interface DraftEventPayload {
  action: DraftAction;
  phase?: DraftPhase;
  round?: number;           // 1 to 5
  totalRounds?: number;     // 5
  activeCondition?: DraftCondition;
  turnOrder?: string[];     // Array of playerIds in order for current round
  currentPickerId?: string; // PlayerId who has the turn
  currentPickerName?: string;
  pickedPosition?: DraftPosition;
  pickedPlayer?: FootballPlayer;
  appliedCondition?: DraftCondition;
  // Specific payload for PLAYER_PICKED and DRAFT_COMPLETE
  slotKey?: DraftPosition;
  pickedPlayerName?: string;
  conditionId?: string;
  conditionTitle?: string;
  teamLogo?: string;
  squad?: PlayerSquad;
  allSquads?: Record<string, PlayerSquad>;
  draftedPlayerIds?: string[]; // Global anti-steal list
  evaluations?: SquadAIEvaluation[];
  verdictResult?: DraftVerdictResult;
  contestants?: DraftContestant[];
  targetPlayerId?: string;
  playerId?: string;
  playerName?: string;
  selectedClub?: DraftClub | null;
  isReady?: boolean;
}
