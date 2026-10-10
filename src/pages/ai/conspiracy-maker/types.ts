export type ConspiracyPhase =
  | 'LOBBY'
  | 'EVENTS_REVEAL'
  | 'THEORY_INPUT'
  | 'DOSSIERS_SHOWCASE'
  | 'VERDICT_REVEAL'
  | 'PODIUM';

export interface EventPair {
  id: string;
  eventA: string;
  eventB: string;
  contextHint?: string;
}

export interface PlayerTheory {
  playerId: string;
  playerName: string;
  theoryText: string;
  submittedAt: number;
}

export interface TheoryAudit {
  playerId: string;
  dangerLevel: number; // 20 to 99%
  codeName: string;
  quickRoast: string;
}

export interface ConspiracyEvaluation {
  winnerPlayerId: string;
  winnerName: string;
  classifiedTitle: string;
  verdictCommentary: string;
  theoriesAudit: TheoryAudit[];
}

export interface ConspiracyScore {
  playerId: string;
  playerName: string;
  score: number;
}

export interface ConspiracyPlayer {
  id: string;
  name: string;
  isReady: boolean;
  avatarUrl?: string;
}
