import {
  FOOTBALL_PLAYERS_MASTER,
  FootballPlayer,
  getPlayerPhoto,
  getClubLogo,
} from '../data/footballMasterData';
import { normalizeArabicFootball } from './footballSearch';
import { getMutualPlayersFromDb, getMutualClubsFromDb } from '../lib/footballDatabase';

export type MutualLinkType = 'PLAYER_TO_PLAYER' | 'CLUB_TO_CLUB';

export interface MutualLinkChallenge {
  id: string;
  type: MutualLinkType;
  entityA: { name: string; image: string };
  entityB: { name: string; image: string };
  validAnswers: string[]; // Normalized strings for instant exhaustive matching
  validDisplayNames: string[]; // All valid human-readable answer names
  revealItem: {
    name: string;
    image: string;
    subtitle?: string;
  };
  matchingPlayers?: {
    id: string;
    name: string;
    photo?: string;
    aliases: string[];
  }[];
}

// Common aliases for clubs ONLY (National teams / countries strictly prohibited)
const CLUB_ALIASES: Record<string, string[]> = {
  'ريال مدريد': ['ريال مدريد', 'الريال', 'الميرينغي', 'الملكي', 'real madrid', 'madrid'],
  'برشلونة': ['برشلونة', 'البارسا', 'البرشا', 'barcelona', 'barca'],
  'الهلال': ['الهلال', 'الزعيم', 'الموج الأزرق', 'al hilal', 'hilal'],
  'النصر': ['النصر', 'العالمي', 'فارس نجد', 'al nassr', 'nassr'],
  'الاتحاد': ['الاتحاد', 'العميد', 'النمور', 'al ittihad', 'ittihad'],
  'الأهلي': ['الأهلي', 'الراقي', 'قلعة الكؤوس', 'al ahli', 'ahli', 'الأهلي السعودي'],
  'الأهلي السعودي': ['الأهلي', 'الراقي', 'al ahli', 'الأهلي السعودي'],
  'مانشستر سيتي': ['مانشستر سيتي', 'السيتي', 'man city', 'city', 'مان سيتي'],
  'مانشستر يونايتد': ['مانشستر يونايتد', 'اليونايتد', 'الشياطين الحمر', 'man united', 'united'],
  'بايرن ميونخ': ['بايرن ميونخ', 'البايرن', 'البافاري', 'bayern', 'bayern munich'],
  'باريس سان جيرمان': ['باريس سان جيرمان', 'باريس', 'بي اس جي', 'psg', 'paris'],
  'ليفربول': ['ليفربول', 'الريدز', 'liverpool', 'reds'],
  'أرسنال': ['أرسنال', 'الغانرز', 'arsenal', 'gunners', 'المدفعجية'],
  'تشيلسي': ['تشيلسي', 'البلوز', 'chelsea', 'blues'],
  'يوفنتوس': ['يوفنتوس', 'اليوفي', 'السيدة العجوز', 'juventus', 'juve'],
  'ميلان': ['ميلان', 'الروسونيري', 'إيه سي ميلان', 'milan', 'ac milan'],
  'إنتر ميلان': ['إنتر ميلان', 'الإنتر', 'النيراتزوري', 'inter', 'inter milan'],
  'الشباب': ['الشباب', 'الليث', 'al shabab', 'shabab'],
  'الاتفاق': ['الاتفاق', 'فارس الدهناء', 'al ettifaq', 'ettifaq'],
  'القادسية': ['القادسية', 'بنو قادس', 'al qadsiah', 'qadsiah'],
  'التعاون': ['التعاون', 'سكري القصيم', 'al taawoun'],
  'الفتح': ['الفتح', 'النموذجي', 'al fateh'],
  'الوحدة': ['الوحدة', 'فرسان مكة', 'al wehda'],
  'الأهلي المصري': ['الأهلي المصري', 'نادي القرن', 'الأهلي القاهري'],
  'الزمالك': ['الزمالك', 'الفارس الأبيض', 'ميت عقبة'],
  'أتلتيكو مدريد': ['أتلتيكو مدريد', 'الروخي بلانكوس', 'atletico'],
  'توتنهام': ['توتنهام', 'السبيرز', 'tottenham', 'spurs'],
  'بوروسيا دورتموند': ['بوروسيا دورتموند', 'دورتموند', 'dortmund', 'bvb'],
};

/**
 * Expand club names into all valid normalized search terms and aliases
 */
function expandClubAnswers(clubs: string[]): string[] {
  const result = new Set<string>();
  for (const c of clubs) {
    result.add(normalizeArabicFootball(c));
    if (c.startsWith('ال')) {
      result.add(normalizeArabicFootball(c.slice(2)));
    }
    const aliases = CLUB_ALIASES[c];
    if (aliases) {
      aliases.forEach(a => {
        result.add(normalizeArabicFootball(a));
        if (a.startsWith('ال')) {
          result.add(normalizeArabicFootball(a.slice(2)));
        }
      });
    }
  }
  return Array.from(result).filter(Boolean);
}

/**
 * Procedural Question Generator for "حلقة الوصل"
 * Clubs Only Rule (منع المنتخبات نهائياً):
 * - Club-to-Club: Answer is any mutual player
 * - Player-to-Player: Answer is any mutual club
 * Strictly 10 rounds, guaranteed variety and exhaustive matching.
 */
export const generateMutualLinkChallenges = (count = 10): MutualLinkChallenge[] => {
  const challenges: MutualLinkChallenge[] = [];
  const players = FOOTBALL_PLAYERS_MASTER;

  // Curate all clubs with at least 1 player in the dataset (Strictly clubs)
  const allClubs = Array.from(new Set(players.flatMap(p => p.clubs))).filter(c => c && c.trim().length > 1);

  // Keep track of used pairs to prevent repetition within the 10 rounds
  const usedSignatures = new Set<string>();

  for (let i = 0; i < count; i++) {
    // 50% Club-to-Club, 50% Player-to-Player
    const isClubMode = i % 2 === 0;

    if (isClubMode) {
      let clubA = '', clubB = '';
      let allMatchingPlayers: FootballPlayer[] = [];
      let attempts = 0;

      while (allMatchingPlayers.length === 0 && attempts < 100) {
        attempts++;
        clubA = allClubs[Math.floor(Math.random() * allClubs.length)];
        clubB = allClubs[Math.floor(Math.random() * allClubs.length)];
        if (clubA === clubB) continue;

        const sig = [clubA, clubB].sort().join('___');
        if (usedSignatures.has(sig)) continue;

        allMatchingPlayers = players.filter(p => p.clubs.includes(clubA) && p.clubs.includes(clubB));
      }

      // If random search struggled, fallback to popular pairings
      if (allMatchingPlayers.length === 0) {
        const popularClubs = [
          'الهلال', 'النصر', 'الاتحاد', 'الأهلي', 'ريال مدريد',
          'برشلونة', 'مانشستر سيتي', 'تشيلسي', 'ميلان', 'يوفنتوس',
          'باريس سان جيرمان', 'ليفربول', 'أرسنال', 'الشباب', 'الاتفاق'
        ];
        for (let a = 0; a < popularClubs.length; a++) {
          for (let b = a + 1; b < popularClubs.length; b++) {
            const sig = [popularClubs[a], popularClubs[b]].sort().join('___');
            if (usedSignatures.has(sig)) continue;
            const shared = players.filter(p => p.clubs.includes(popularClubs[a]) && p.clubs.includes(popularClubs[b]));
            if (shared.length > 0) {
              clubA = popularClubs[a];
              clubB = popularClubs[b];
              allMatchingPlayers = shared;
              break;
            }
          }
          if (allMatchingPlayers.length > 0) break;
        }
      }

      if (allMatchingPlayers.length > 0) {
        const sig = [clubA, clubB].sort().join('___');
        usedSignatures.add(sig);

        // Pick primary reveal hero (prefer player with photo or first player)
        const primaryHero = allMatchingPlayers.find(p => p.photo) || allMatchingPlayers[0];

        // Exhaustive validAnswers: includes ALL matching players and their aliases (normalized)
        const validAnswersSet = new Set<string>();
        allMatchingPlayers.forEach(p => {
          validAnswersSet.add(normalizeArabicFootball(p.name));
          if (p.name.startsWith('ال')) {
            validAnswersSet.add(normalizeArabicFootball(p.name.slice(2)));
          }
          p.aliases.forEach(a => {
            validAnswersSet.add(normalizeArabicFootball(a));
            if (a.startsWith('ال')) {
              validAnswersSet.add(normalizeArabicFootball(a.slice(2)));
            }
          });
        });

        const validDisplayNames = allMatchingPlayers.map(p => p.name);

        challenges.push({
          id: `ml_club_${Date.now()}_${i}`,
          type: 'CLUB_TO_CLUB',
          entityA: { name: clubA, image: getClubLogo(clubA) },
          entityB: { name: clubB, image: getClubLogo(clubB) },
          validAnswers: Array.from(validAnswersSet),
          validDisplayNames,
          revealItem: {
            name: primaryHero.name,
            image: getPlayerPhoto(primaryHero),
            subtitle: `لعب مع ${clubA} و ${clubB}`,
          },
          matchingPlayers: allMatchingPlayers.map(p => ({
            id: p.id,
            name: p.name,
            photo: getPlayerPhoto(p),
            aliases: p.aliases,
          })),
        });
        continue;
      }
    }

    // Player-to-Player Mode: Find 2 players with at least 1 shared CLUB (NO NATIONAL TEAMS)
    let pA: FootballPlayer | null = null;
    let pB: FootballPlayer | null = null;
    let mutualClubs: string[] = [];
    let pAttempts = 0;

    while (mutualClubs.length === 0 && pAttempts < 100) {
      pAttempts++;
      pA = players[Math.floor(Math.random() * players.length)];
      pB = players[Math.floor(Math.random() * players.length)];
      if (!pA || !pB || pA.id === pB.id) continue;

      const sig = [pA.id, pB.id].sort().join('___');
      if (usedSignatures.has(sig)) continue;

      // Find common CLUBS ONLY (strictly no nationality comparison)
      mutualClubs = pA.clubs.filter(c => pB!.clubs.includes(c));
    }

    if (pA && pB && mutualClubs.length > 0) {
      const sig = [pA.id, pB.id].sort().join('___');
      usedSignatures.add(sig);

      const primaryClub = mutualClubs[0];
      const validAnswers = expandClubAnswers(mutualClubs);

      challenges.push({
        id: `ml_player_${Date.now()}_${i}`,
        type: 'PLAYER_TO_PLAYER',
        entityA: { name: pA.name, image: getPlayerPhoto(pA) },
        entityB: { name: pB.name, image: getPlayerPhoto(pB) },
        validAnswers,
        validDisplayNames: mutualClubs,
        revealItem: {
          name: primaryClub,
          image: getClubLogo(primaryClub),
          subtitle: `نادي مشترك بين ${pA.name} و ${pB.name}`,
        },
      });
    }
  }

  return challenges;
};

/**
 * Asynchronously enrich challenge answers from Supabase historical database
 */
export async function enrichChallengeFromDb(challenge: MutualLinkChallenge): Promise<MutualLinkChallenge> {
  if (challenge.type === 'CLUB_TO_CLUB') {
    const dbPlayers = await getMutualPlayersFromDb(challenge.entityA.name, challenge.entityB.name);
    if (dbPlayers.length > 0) {
      const answersSet = new Set(challenge.validAnswers);
      const displayNamesSet = new Set(challenge.validDisplayNames);

      dbPlayers.forEach(p => {
        answersSet.add(normalizeArabicFootball(p.name));
        if (p.name.startsWith('ال')) {
          answersSet.add(normalizeArabicFootball(p.name.slice(2)));
        }
        displayNamesSet.add(p.name);
      });

      return {
        ...challenge,
        validAnswers: Array.from(answersSet),
        validDisplayNames: Array.from(displayNamesSet),
      };
    }
  }

  return challenge;
}
