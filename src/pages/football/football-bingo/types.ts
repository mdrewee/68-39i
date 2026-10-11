import { ActiveFootballer, PlayerBingoTile } from '../../../data/footballBingoData';

export type FootballBingoPhase = 'LOBBY' | 'GAMEPLAY' | 'ROUND_WIN' | 'MATCH_OVER';

export interface FootballBingoPlayer {
  id: string;
  name: string;
  isReady: boolean;
  claimedCount: number;
  score: number; // Rounds won
  board?: PlayerBingoTile[];
}

export type FootballBingoAction =
  | 'GAME_START'
  | 'NEW_PLAYER'
  | 'PLAYER_PROGRESS'
  | 'BINGO_CLAIM'
  | 'NEXT_ROUND'
  | 'RESET_LOBBY'
  | 'PLAYER_READY_UPDATE';

export interface FootballBingoEventPayload {
  action: FootballBingoAction;
  phase?: FootballBingoPhase;
  round?: number;
  maxRounds?: number;
  player?: ActiveFootballer;
  winner?: {
    id: string;
    name: string;
    round: number;
  };
  claimedCount?: number;
  playerId?: string;
  isReady?: boolean;
  scores?: Record<string, number>;
}
