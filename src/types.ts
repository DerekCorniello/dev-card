export interface ContributionDay {
  date: string;
  contributionCount: number;
}

export interface Language {
  name: string;
  color: string;
  bytes: number;
  percentage: number;
}

export interface GitHubStats {
  commits: number;
  prs: number;
  issues: number;
  reviews: number;
  reposContributed: number;
  stars: number;
  followers: number;
}

export interface LeetCodeSubmission {
  title: string;
  timestamp: string; // Unix seconds as string
  statusDisplay: string;
  lang: string;
}

export interface LeetCodeStats {
  solved: number;
  easy: number;
  medium: number;
  hard: number;
  recentSubmissions: LeetCodeSubmission[];
}

export interface RankResult {
  level: string;
  percentile: number;
}

// contributionWeeks[weekIndex][dayIndex] where dayIndex 0=Sun, 6=Sat
export interface ProfileData {
  github: {
    contributionWeeks: ContributionDay[][];
    stats: GitHubStats;
    languages: Language[];
  };
  leetcode: LeetCodeStats;
  rank: RankResult;
  fetchedAt: string;
}

export interface Env {
  KV: KVNamespace;
  GITHUB_TOKEN: string;
  ENVIRONMENT?: string;
}
