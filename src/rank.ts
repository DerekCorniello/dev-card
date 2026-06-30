import type { GitHubStats, RankResult } from "./types";

// Ported from https://github.com/anuraghazra/github-readme-stats
function exponentialCdf(x: number): number {
  return 1 - 2 ** -x;
}

function logNormalCdf(x: number): number {
  return x / (1 + x);
}

const THRESHOLDS = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
const LEVELS = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C"];

export function calculateRank(stats: GitHubStats): RankResult {
  const COMMITS_MEDIAN = 1000, COMMITS_WEIGHT = 2;
  const PRS_MEDIAN = 50,      PRS_WEIGHT = 3;
  const ISSUES_MEDIAN = 25,   ISSUES_WEIGHT = 1;
  const REVIEWS_MEDIAN = 2,   REVIEWS_WEIGHT = 1;
  const STARS_MEDIAN = 50,    STARS_WEIGHT = 4;
  const FOLLOWERS_MEDIAN = 10, FOLLOWERS_WEIGHT = 1;
  const TOTAL_WEIGHT = COMMITS_WEIGHT + PRS_WEIGHT + ISSUES_WEIGHT + REVIEWS_WEIGHT + STARS_WEIGHT + FOLLOWERS_WEIGHT;

  const rank =
    1 -
    (COMMITS_WEIGHT * exponentialCdf(stats.commits / COMMITS_MEDIAN) +
      PRS_WEIGHT * exponentialCdf(stats.prs / PRS_MEDIAN) +
      ISSUES_WEIGHT * exponentialCdf(stats.issues / ISSUES_MEDIAN) +
      REVIEWS_WEIGHT * exponentialCdf(stats.reviews / REVIEWS_MEDIAN) +
      STARS_WEIGHT * logNormalCdf(stats.stars / STARS_MEDIAN) +
      FOLLOWERS_WEIGHT * logNormalCdf(stats.followers / FOLLOWERS_MEDIAN)) /
      TOTAL_WEIGHT;

  const percentile = rank * 100;
  const level = LEVELS[THRESHOLDS.findIndex((t) => percentile <= t)] ?? "C";

  return { level, percentile };
}
