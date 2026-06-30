import type { ContributionDay, GitHubStats, Language } from "./types";

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

// commits + reviews: last 12 months (matches the heatmap window, gives a full-year
//   count instead of a Jan-1-to-now slice — more representative for rank calculation)
// PRs + issues: all-time totals
// heatmap: rolling last 52 weeks
const QUERY = `
  query userStats($login: String!, $lastYear: DateTime!, $now: DateTime!, $yearStart: DateTime!) {
    user(login: $login) {
      followers {
        totalCount
      }
      repositoriesContributedTo(
        first: 1
        contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]
      ) {
        totalCount
      }
      repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC) {
        nodes {
          stargazers { totalCount }
        }
      }
      pullRequests(first: 1) {
        totalCount
      }
      openIssues: issues(states: OPEN) {
        totalCount
      }
      closedIssues: issues(states: CLOSED) {
        totalCount
      }
      heatmap: contributionsCollection(from: $lastYear, to: $now) {
        totalCommitContributions
        totalPullRequestReviewContributions
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
      yearStats: contributionsCollection(from: $yearStart, to: $now) {
        commitContributionsByRepository(maxRepositories: 100) {
          repository {
            languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
              edges {
                size
                node { name color }
              }
            }
          }
        }
      }
    }
  }
`;

export interface GitHubRawData {
  contributionWeeks: ContributionDay[][];
  stats: GitHubStats;
  rawLanguages: Map<string, { color: string; bytes: number }>;
}

export async function fetchGitHub(token: string): Promise<GitHubRawData> {
  const now = new Date();
  const lastYear = new Date(now);
  lastYear.setFullYear(now.getFullYear() - 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const res = await fetch(GITHUB_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "dev-card/1.0",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        login: "DerekCorniello",
        lastYear: lastYear.toISOString(),
        now: now.toISOString(),
        yearStart: yearStart.toISOString(),
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[github] HTTP ${res.status}: ${body.slice(0, 300)}`);
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const json = await res.json() as { data?: GitHubApiResponse; errors?: { message: string }[] };

  if (json.errors?.length) {
    console.error("[github] GraphQL errors:", json.errors);
    throw new Error(`GitHub GraphQL error: ${json.errors[0].message}`);
  }

  const user = json.data!.user;
  const stars = user.repositories.nodes.reduce((sum, r) => sum + r.stargazers.totalCount, 0);

  // Use last-12-months commits/reviews so rank reflects a full year of activity
  // rather than a partial calendar-year slice (Jan 1 → now)
  const stats: GitHubStats = {
    commits: user.heatmap.totalCommitContributions,
    prs: user.pullRequests.totalCount,
    issues: user.openIssues.totalCount + user.closedIssues.totalCount,
    reviews: user.heatmap.totalPullRequestReviewContributions,
    reposContributed: user.repositoriesContributedTo.totalCount,
    stars,
    followers: user.followers.totalCount,
  };

  const contributionWeeks = user.heatmap.contributionCalendar.weeks.map((w) => w.contributionDays);

  const rawLanguages = new Map<string, { color: string; bytes: number }>();
  for (const { repository } of user.yearStats.commitContributionsByRepository) {
    for (const edge of repository.languages.edges) {
      const name = edge.node.name;
      const existing = rawLanguages.get(name);
      if (existing) {
        existing.bytes += edge.size;
      } else {
        rawLanguages.set(name, { color: edge.node.color ?? "#58a6ff", bytes: edge.size });
      }
    }
  }

  return { contributionWeeks, stats, rawLanguages };
}

export function aggregateLanguages(
  rawLanguages: Map<string, { color: string; bytes: number }>,
  topN = 8,
): Language[] {
  const sorted = [...rawLanguages.entries()]
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, topN);

  const totalBytes = sorted.reduce((sum, [, v]) => sum + v.bytes, 0);

  return sorted.map(([name, { color, bytes }]) => ({
    name,
    color,
    bytes,
    percentage: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0,
  }));
}

interface GitHubApiResponse {
  user: {
    followers: { totalCount: number };
    repositoriesContributedTo: { totalCount: number };
    repositories: { nodes: { stargazers: { totalCount: number } }[] };
    pullRequests: { totalCount: number };
    openIssues: { totalCount: number };
    closedIssues: { totalCount: number };
    heatmap: {
      totalCommitContributions: number;
      totalPullRequestReviewContributions: number;
      contributionCalendar: {
        weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
      };
    };
    yearStats: {
      commitContributionsByRepository: {
        repository: {
          languages: {
            edges: { size: number; node: { name: string; color: string | null } }[];
          };
        };
      }[];
    };
  };
}
