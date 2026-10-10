// src/pages/ai/who-is-ai/services/scoringConfig.ts
import { Suspect, VoteSubmission, RoundScoreResult } from '../types';

export const WHO_IS_AI_POINTS = {
  CAUGHT_AI: 2,         // +2 pt per human who guessed the AI
  MASTER_BLUFF_VOTE: 1, // +1 pt per vote received by a human suspect
  AI_SURVIVAL: 3        // +3 pt for AI if it survived (received fewer votes than highest human)
};

export function calculateRoundScores(
  suspects: Suspect[],
  votes: VoteSubmission[],
  cumulativeScores: Record<string, number>,
  aiCumulativeScore: number
): RoundScoreResult {
  const aiSuspect = suspects.find((s) => s.isAi);
  const aiAvatarId = aiSuspect?.avatarId || '';

  // Count votes per suspect avatar
  const voteCounts: Record<string, number> = {};
  const votersForAvatar: Record<string, string[]> = {};

  suspects.forEach((s) => {
    voteCounts[s.avatarId] = 0;
    votersForAvatar[s.avatarId] = [];
  });

  votes.forEach((v) => {
    if (v.targetAvatarId && voteCounts[v.targetAvatarId] !== undefined) {
      voteCounts[v.targetAvatarId]++;
      votersForAvatar[v.targetAvatarId].push(v.voterPlayerId);
    }
  });

  const aiVotesCount = voteCounts[aiAvatarId] || 0;

  // Find human with the most votes
  let maxHumanVotes = 0;
  let masterBlufferAvatarId: string | undefined;
  let masterBlufferPlayerId: string | undefined;

  suspects
    .filter((s) => !s.isAi)
    .forEach((s) => {
      const cnt = voteCounts[s.avatarId] || 0;
      if (cnt > maxHumanVotes) {
        maxHumanVotes = cnt;
        masterBlufferAvatarId = s.avatarId;
        masterBlufferPlayerId = s.realPlayerId;
      }
    });

  // AI survives if it got strictly fewer votes than top human
  const aiSurvived = aiVotesCount < maxHumanVotes;
  const aiEarnedPoints = aiSurvived ? WHO_IS_AI_POINTS.AI_SURVIVAL : 0;

  const roundPointsEarned: Record<string, number> = {};
  const correctVoterPlayerIds: string[] = [];
  const correctVoterNames: string[] = [];
  const playerBreakdown: Record<string, string[]> = {};

  // Initialize for all human players
  suspects
    .filter((s) => !s.isAi && s.realPlayerId)
    .forEach((s) => {
      const pid = s.realPlayerId!;
      roundPointsEarned[pid] = 0;
      playerBreakdown[pid] = [];
    });

  // 1. Reward humans who caught the AI (+2 pt)
  votes.forEach((v) => {
    if (v.targetAvatarId === aiAvatarId) {
      const voterSuspect = suspects.find((s) => s.realPlayerId === v.voterPlayerId);
      if (voterSuspect && !voterSuspect.isAi) {
        correctVoterPlayerIds.push(v.voterPlayerId);
        if (voterSuspect.realPlayerName) {
          correctVoterNames.push(voterSuspect.realPlayerName);
        }
        roundPointsEarned[v.voterPlayerId] = (roundPointsEarned[v.voterPlayerId] || 0) + WHO_IS_AI_POINTS.CAUGHT_AI;
        playerBreakdown[v.voterPlayerId] = playerBreakdown[v.voterPlayerId] || [];
        playerBreakdown[v.voterPlayerId].push(`كشف الروبوت (+${WHO_IS_AI_POINTS.CAUGHT_AI} pt)`);
      }
    }
  });

  // 2. Reward humans who fooled others (Master Bluff: +1 pt per vote received)
  suspects
    .filter((s) => !s.isAi && s.realPlayerId)
    .forEach((s) => {
      const pid = s.realPlayerId!;
      const votesReceived = voteCounts[s.avatarId] || 0;
      if (votesReceived > 0) {
        const bluffPts = votesReceived * WHO_IS_AI_POINTS.MASTER_BLUFF_VOTE;
        roundPointsEarned[pid] = (roundPointsEarned[pid] || 0) + bluffPts;
        playerBreakdown[pid] = playerBreakdown[pid] || [];
        playerBreakdown[pid].push(`تمويه ذكي (${votesReceived} أصوات = +${bluffPts} pt)`);
      }
    });

  // Calculate cumulative scores
  const updatedPlayerPoints: Record<string, number> = { ...cumulativeScores };
  Object.keys(roundPointsEarned).forEach((pid) => {
    updatedPlayerPoints[pid] = (updatedPlayerPoints[pid] || 0) + roundPointsEarned[pid];
  });

  const updatedAiPoints = aiCumulativeScore + aiEarnedPoints;

  // Votes summary: targetAvatarId -> list of voter names
  const votesSummary: Record<string, string[]> = {};
  suspects.forEach((s) => {
    const voterIds = votersForAvatar[s.avatarId] || [];
    votesSummary[s.avatarId] = voterIds.map((vid) => {
      const voter = suspects.find((sub) => sub.realPlayerId === vid);
      return voter?.realPlayerName || voter?.avatarName || 'مجهول';
    });
  });

  return {
    aiRevealed: true,
    aiSurvived,
    aiVotesCount,
    aiAvatarId,
    aiEarnedPoints,
    masterBlufferPlayerId,
    masterBlufferAvatarId,
    masterBlufferVotesCount: maxHumanVotes,
    correctVoterPlayerIds,
    correctVoterNames,
    playerPoints: updatedPlayerPoints,
    roundPointsEarned,
    aiPoints: updatedAiPoints,
    playerBreakdown,
    votesSummary
  };
}

export function formatPt(points: number): string {
  return `${points} pt`;
}
