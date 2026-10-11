import {
  FOOTBALL_PLAYERS_MASTER,
  FootballPlayer,
  getPlayerPhoto,
  getClubLogo,
} from '../data/footballMasterData';

export type MutualLinkType = 'PLAYER_TO_PLAYER' | 'CLUB_TO_CLUB';

export interface MutualLinkChallenge {
  id: string;
  type: MutualLinkType;
  entityA: { name: string; image: string };
  entityB: { name: string; image: string };
  validAnswers: string[]; // List of valid player/club names or IDs
  validDisplayNames: string[];
  revealItem: {
    name: string;
    image: string;
    subtitle?: string;
  };
}

// Common aliases for top clubs & countries to ensure contestants' guesses match smoothly
const ENTITY_ALIASES: Record<string, string[]> = {
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
  'السعودية': ['السعودية', 'المنتخب السعودي', 'الأخضر', 'الصقور', 'saudi arabia', 'saudi'],
  'البرازيل': ['البرازيل', 'السامبا', 'السيليساو', 'brazil'],
  'الأرجنتين': ['الأرجنتين', 'التانغو', 'البيسيليستي', 'argentina'],
  'فرنسا': ['فرنسا', 'الديوك', 'france'],
  'البرتغال': ['البرتغال', 'برازيل أوروبا', 'portugal'],
  'إسبانيا': ['إسبانيا', 'الماتادور', 'لا روخا', 'spain'],
  'ألمانيا': ['ألمانيا', 'المانشافت', 'الماكينات', 'germany'],
  'مصر': ['مصر', 'الفراعنة', 'منتخب مصر', 'egypt'],
  'المغرب': ['المغرب', 'أسود الأطلس', 'منتخب المغرب', 'morocco'],
  'كرواتيا': ['كرواتيا', 'croatia'],
};

/**
 * Expand a list of entity names into all valid search terms and aliases
 */
function expandEntityAnswers(entities: string[]): string[] {
  const result = new Set<string>();
  for (const ent of entities) {
    result.add(ent);
    const aliases = ENTITY_ALIASES[ent];
    if (aliases) {
      aliases.forEach(a => result.add(a));
    }
  }
  return Array.from(result);
}

/**
 * Procedural Question Generator for "حلقة الوصل"
 * Generates balanced challenges using set intersections on careers & clubs
 */
export const generateMutualLinkChallenges = (count = 5): MutualLinkChallenge[] => {
  const challenges: MutualLinkChallenge[] = [];
  const players = FOOTBALL_PLAYERS_MASTER;

  // Curate all clubs with at least 1 player in the dataset
  const allClubs = Array.from(new Set(players.flatMap(p => p.clubs))).filter(c => c && c.trim().length > 1);

  // Keep track of used pairs to prevent repetition within the 5 rounds
  const usedSignatures = new Set<string>();

  for (let i = 0; i < count; i++) {
    // Alternate or 50% chance between Club-to-Club and Player-to-Player
    const isClubMode = i % 2 === 0;

    if (isClubMode) {
      let clubA = '', clubB = '';
      let sharedPlayers: FootballPlayer[] = [];
      let attempts = 0;

      while (sharedPlayers.length === 0 && attempts < 80) {
        attempts++;
        clubA = allClubs[Math.floor(Math.random() * allClubs.length)];
        clubB = allClubs[Math.floor(Math.random() * allClubs.length)];
        if (clubA === clubB) continue;

        const sig = [clubA, clubB].sort().join('___');
        if (usedSignatures.has(sig)) continue;

        sharedPlayers = players.filter(p => p.clubs.includes(clubA) && p.clubs.includes(clubB));
      }

      // If random search struggled, fallback to popular pairings
      if (sharedPlayers.length === 0) {
        const popularClubs = ['الهلال', 'النصر', 'الاتحاد', 'الأهلي', 'ريال مدريد', 'برشلونة', 'مانشستر سيتي', 'تشيلسي', 'ميلان', 'يوفنتوس', 'باريس سان جيرمان'];
        for (let a = 0; a < popularClubs.length; a++) {
          for (let b = a + 1; b < popularClubs.length; b++) {
            const sig = [popularClubs[a], popularClubs[b]].sort().join('___');
            if (usedSignatures.has(sig)) continue;
            const shared = players.filter(p => p.clubs.includes(popularClubs[a]) && p.clubs.includes(popularClubs[b]));
            if (shared.length > 0) {
              clubA = popularClubs[a];
              clubB = popularClubs[b];
              sharedPlayers = shared;
              break;
            }
          }
          if (sharedPlayers.length > 0) break;
        }
      }

      if (sharedPlayers.length > 0) {
        const sig = [clubA, clubB].sort().join('___');
        usedSignatures.add(sig);

        // Pick primary reveal hero (prefer player with photo or top player)
        const primaryHero = sharedPlayers.find(p => p.photo) || sharedPlayers[0];

        // Collect all valid answer representations
        const validAnswers = Array.from(new Set(
          sharedPlayers.flatMap(p => [
            p.name,
            ...p.aliases,
            p.id,
            p.name.replace(/^ال/, ''), // without 'Al'
          ])
        ));

        challenges.push({
          id: `ml_club_${Date.now()}_${i}`,
          type: 'CLUB_TO_CLUB',
          entityA: { name: clubA, image: getClubLogo(clubA) },
          entityB: { name: clubB, image: getClubLogo(clubB) },
          validAnswers,
          validDisplayNames: sharedPlayers.map(p => p.name),
          revealItem: {
            name: primaryHero.name,
            image: getPlayerPhoto(primaryHero),
            subtitle: `لعب مع ${clubA} و ${clubB}`,
          },
        });
        continue;
      }
    }

    // Player-to-Player Mode: Find 2 players with at least 1 shared club or nationality
    let pA: FootballPlayer | null = null;
    let pB: FootballPlayer | null = null;
    let mutualEntities: string[] = [];
    let pAttempts = 0;

    while (mutualEntities.length === 0 && pAttempts < 80) {
      pAttempts++;
      pA = players[Math.floor(Math.random() * players.length)];
      pB = players[Math.floor(Math.random() * players.length)];
      if (!pA || !pB || pA.id === pB.id) continue;

      const sig = [pA.id, pB.id].sort().join('___');
      if (usedSignatures.has(sig)) continue;

      // Find common clubs
      const commonClubs = pA.clubs.filter(c => pB!.clubs.includes(c));
      const commonCountry = (pA.nationality && pA.nationality === pB.nationality) ? [pA.nationality] : [];
      mutualEntities = Array.from(new Set([...commonClubs, ...commonCountry]));
    }

    if (pA && pB && mutualEntities.length > 0) {
      const sig = [pA.id, pB.id].sort().join('___');
      usedSignatures.add(sig);

      const primaryEntity = mutualEntities[0];
      const validAnswers = expandEntityAnswers(mutualEntities);

      challenges.push({
        id: `ml_player_${Date.now()}_${i}`,
        type: 'PLAYER_TO_PLAYER',
        entityA: { name: pA.name, image: getPlayerPhoto(pA) },
        entityB: { name: pB.name, image: getPlayerPhoto(pB) },
        validAnswers,
        validDisplayNames: mutualEntities,
        revealItem: {
          name: primaryEntity,
          image: getClubLogo(primaryEntity),
          subtitle: `حلقة الوصل بين ${pA.name} و ${pB.name}`,
        },
      });
    }
  }

  return challenges;
};
