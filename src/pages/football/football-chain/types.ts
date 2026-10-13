import { FootballPlayer } from '../../../data/footballMasterData';

export type ChainGamePhase =
  | 'LOBBY'        // Contestant join, ready toggle, team badge preview
  | 'RACE_ACTIVE'  // Active 90s countdown race from Start -> Target
  | 'ROUND_PODIUM' // Reveal winner chain and step-by-step connections
  | 'MATCH_OVER';  // Final 5-round leaderboard and champion

export interface ChainPlayer {
  id: string;
  name: string;
  nationality?: string;
  nationalityCode?: string;
  clubs: string[];
  currentClub?: string;
  photoUrl?: string;
  position?: string;
}

export interface ChainStep {
  fromPlayer: ChainPlayer;
  toPlayer: ChainPlayer;
  connectingEntity: string; // The club or national team they shared (e.g. "ليفربول", "منتخب البرازيل")
  stepNumber: number;
}

export interface ChainChallenge {
  id: string;
  startPlayer: ChainPlayer;
  targetPlayer: ChainPlayer;
  minHops: number;
  hint?: string;
}

export interface ChainContestantProgress {
  playerId: string;
  playerName: string;
  teamLogo?: string;
  teamName?: string;
  currentStepCount: number; // For TV live track (privacy preserved)
  hasFinished: boolean;
  finishedAt?: number;
  score: number;
  roundWins: number;
}

export interface WinningChainReveal {
  winnerId: string;
  winnerName: string;
  winnerTeamLogo?: string;
  stepsCount: number;
  chainSteps: ChainStep[];
  startPlayer: ChainPlayer;
  targetPlayer: ChainPlayer;
  bonusPoints: number;
  totalPoints: number;
}

export type ChainAction =
  | 'PLAYER_READY'
  | 'KICK_PLAYER'
  | 'GAME_START'
  | 'STEP_ADVANCED'
  | 'STEP_BACKTRACKED'
  | 'CHAIN_COMPLETED'
  | 'ROUND_TIMEOUT'
  | 'START_NEXT_ROUND'
  | 'PLAYER_NEXT_ROUND_READY'
  | 'RESET_LOBBY'
  | 'ROOM_TERMINATED';

export interface ChainEventPayload {
  action: ChainAction;
  phase?: ChainGamePhase;
  round?: number;
  totalRounds?: number;
  challenge?: ChainChallenge;
  playerId?: string;
  playerName?: string;
  teamLogo?: string;
  teamName?: string;
  isReady?: boolean;
  stepCount?: number;
  targetPlayerId?: string;
  winningReveal?: WinningChainReveal;
  leaderboard?: Record<string, { score: number; wins: number; name: string; teamLogo?: string }>;
}
