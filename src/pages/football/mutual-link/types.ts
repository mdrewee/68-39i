import { WikidataClub, LiveMatchedPlayer } from '../../../utils/wikidataFootballService';

export type MutualLinkPhase = 'LOBBY' | 'GAMEPLAY' | 'ROUND_REVEAL' | 'MATCH_OVER';

export interface MutualLinkPlayer {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  isReady?: boolean;
  isLockedOut?: boolean;
  lockedUntil?: number;
}

export interface MutualLinkChallenge {
  id: string;
  clubA: WikidataClub;
  clubB: WikidataClub;
  entityA: { id: string; name: string; image: string };
  entityB: { id: string; name: string; image: string };
  validPlayers: LiveMatchedPlayer[];
  validAnswerStrings: string[];
  validDisplayNames: string[];
  revealItem: {
    id?: string;
    name: string;
    image: string;
    subtitle?: string;
  };
}

export type MutualLinkAction =
  | 'LOBBY_STATE'
  | 'PLAYER_READY'
  | 'GAME_START'
  | 'NEW_ROUND'
  | 'SUBMIT_GUESS'
  | 'ROUND_WINNER'
  | 'WRONG_GUESS'
  | 'ROUND_TIMEOUT'
  | 'NEXT_ROUND'
  | 'RESET_LOBBY'
  | 'KICK_PLAYER'
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
  matchedName?: string;
  otherOptions?: string[];
  playerId?: string;
  playerName?: string;
  isReady?: boolean;
  targetPlayerId?: string;
  players?: MutualLinkPlayer[];
  scores?: Record<string, number>;
}
