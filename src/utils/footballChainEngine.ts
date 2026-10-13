import { ChainPlayer, ChainStep } from '../pages/football/football-chain/types';
import { FOOTBALL_PLAYERS_MASTER, FootballPlayer } from '../data/footballMasterData';

/**
 * Normalizes club names for robust Arabic string matching:
 * - Removes leading 'ال' (e.g. 'الهلال' -> 'هلال')
 * - Normalizes diacritics and Alef forms
 * - Removes whitespace
 */
export const normalizeClub = (clubName: string): string => {
  if (!clubName) return '';
  return clubName
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\u0640/g, '')
    .replace(/^ال/g, '')
    .replace(/\s+/g, '');
};

/**
 * Normalizes player names for collision and loop checks
 */
export const normalizePlayerName = (name: string): string => {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
};

/**
 * Checks if two players ever shared a senior club or national team.
 * Returns the matching entity label (e.g. "ليفربول", "منتخب البرازيل") or null.
 */
export const getConnectingEntity = (
  playerA: ChainPlayer,
  playerB: ChainPlayer
): string | null => {
  if (!playerA || !playerB) return null;

  // 1. Check shared national team
  if (
    playerA.nationality &&
    playerB.nationality &&
    playerA.nationality.trim() === playerB.nationality.trim()
  ) {
    return `منتخب ${playerA.nationality.trim()}`;
  }

  // 2. Check shared clubs
  if (playerA.clubs && playerB.clubs && playerA.clubs.length > 0 && playerB.clubs.length > 0) {
    const sharedClub = playerA.clubs.find((clubA) => {
      const normA = normalizeClub(clubA);
      if (!normA) return false;
      return playerB.clubs.some((clubB) => {
        const normB = normalizeClub(clubB);
        return normA === normB || normA.includes(normB) || normB.includes(normA);
      });
    });

    if (sharedClub) {
      return sharedClub;
    }
  }

  return null;
};

/**
 * Converts FootballPlayer from master data to ChainPlayer
 */
export const toChainPlayer = (p: FootballPlayer): ChainPlayer => ({
  id: p.id,
  name: p.name,
  nationality: p.nationality,
  nationalityCode: p.nationalityCode,
  clubs: p.clubs || [],
  currentClub: p.currentClub,
  position: p.position,
  photoUrl: p.photo,
});

/**
 * Finds a player in the master dataset by ID or approximate name
 */
export const findChainPlayer = (query: string): ChainPlayer | null => {
  const normQuery = normalizePlayerName(query);
  if (!normQuery) return null;

  const found = FOOTBALL_PLAYERS_MASTER.find((p) => {
    if (p.id === query) return true;
    if (normalizePlayerName(p.name) === normQuery) return true;
    if (p.aliases && p.aliases.some((a) => normalizePlayerName(a) === normQuery)) return true;
    return false;
  });

  return found ? toChainPlayer(found) : null;
};
