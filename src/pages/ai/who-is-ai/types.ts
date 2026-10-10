// src/pages/ai/who-is-ai/types.ts

export type GamePhase =
  | 'LOBBY'
  | 'QUESTIONS'
  | 'QUESTION_INPUT'
  | 'ANSWERING_SWIPE'
  | 'ANSWERS'
  | 'SHOWCASE_BOARD'
  | 'SHOWCASE'
  | 'VOTING'
  | 'ROULETTE_REVEAL'
  | 'REVEAL'
  | 'GAME_OVER';

export type WhoIsAiPhase = GamePhase;

export interface Suspect {
  avatarId: string;
  avatarName: string;
  iconName: string;
  bgTone: string;
  isAi: boolean;
  realPlayerId?: string;
  realPlayerName?: string;
}

export interface QuestionItem {
  id: string;
  questionText: string;
  text?: string;
  askerAvatar: string;
  askerAvatarId?: string;
  isAi?: boolean;
}

export interface AnswerItem {
  questionId: string;
  responderAvatar: string;
  responderAvatarId?: string;
  answerText: string;
  text?: string;
  isAi?: boolean;
}

export interface RoomQuestion {
  id: string;
  text: string;
  questionText?: string;
  askerAvatarId: string;
  askerAvatarName: string;
  askerAvatar?: string;
  isAi: boolean;
  realPlayerId?: string;
}

export interface RoomAnswer {
  questionId: string;
  responderAvatarId: string;
  responderAvatarName: string;
  responderAvatar?: string;
  text: string;
  answerText?: string;
  isAi: boolean;
  realPlayerId?: string;
}

export interface VoteSubmission {
  voterPlayerId: string;
  voterAvatarId: string;
  targetAvatarId: string;
}

export interface RoundScoreResult {
  aiRevealed: boolean;
  aiSurvived: boolean;
  aiVotesCount: number;
  aiAvatarId: string;
  aiEarnedPoints: number;
  masterBlufferPlayerId?: string;
  masterBlufferAvatarId?: string;
  masterBlufferVotesCount?: number;
  correctVoterPlayerIds: string[];
  correctVoterNames: string[];
  playerPoints: Record<string, number>;
  roundPointsEarned: Record<string, number>;
  aiPoints: number;
  playerBreakdown: Record<string, string[]>;
  votesSummary: Record<string, string[]>;
}

export interface WhoIsAiGameState {
  phase: WhoIsAiPhase;
  round: number;
  totalRounds: number;
  suspects: Suspect[];
  questions: RoomQuestion[];
  answers: RoomAnswer[];
  votes: VoteSubmission[];
  currentShowcaseIndex: number;
  scoreResult?: RoundScoreResult | null;
  cumulativeScores: Record<string, number>;
  aiCumulativeScore: number;
  timeRemaining?: number;
}
