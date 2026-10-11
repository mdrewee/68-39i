import { MutualLinkChallenge } from '../../../utils/mutualLinkEngine';

export type MutualLinkPhase = 'LOBBY' | 'GAMEPLAY' | 'ROUND_REVEAL' | 'MATCH_OVER';

export interface MutualLinkPlayer {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  isLockedOut?: boolean;
  lockedUntil?: number;
}

export type MutualLinkAction =
  | 'LOBBY_STATE'
  | 'GAME_START'
  | 'NEW_ROUND'
  | 'SUBMIT_GUESS'
  | 'ROUND_WINNER'
  | 'WRONG_GUESS'
  | 'ROUND_TIMEOUT'
  | 'NEXT_ROUND'
  | 'RESET_LOBBY'
  | 'ROOM_TERMINATED';

export interface MutualLinkEventPayload {
  action: MutualLinkAction;
  phase?: MutualLinkPhase;
  round?: number;
  maxRounds?: number;
  challenge?: MutualLinkChallenge;
  winnerPlayerId?: string;
  winnerPlayerName?: string;
  guessText?: string;
  playerId?: string;
  playerName?: string;
  players?: MutualLinkPlayer[];
  scores?: Record<string, number>;
}
