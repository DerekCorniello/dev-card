import type { LeetCodeStats } from "./types";

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

const QUERY = `
  query userProfile($username: String!) {
    user: matchedUser(username: $username) {
      submits: submitStatsGlobal {
        ac: acSubmissionNum {
          difficulty
          count
        }
      }
    }
    recentSubmissionList(username: $username, limit: 5) {
      title
      timestamp
      statusDisplay
      lang
    }
  }
`;

interface LeetCodeApiResponse {
  data: {
    user: {
      submits: {
        ac: { difficulty: string; count: number }[];
      };
    } | null;
    recentSubmissionList: {
      title: string;
      timestamp: string;
      statusDisplay: string;
      lang: string;
    }[] | null;
  };
}

export async function fetchLeetCode(): Promise<LeetCodeStats> {
  const res = await fetch(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com",
      Origin: "https://leetcode.com",
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({
      operationName: "userProfile",
      query: QUERY,
      variables: { username: "DerekCorn" },
    }),
  });

  if (!res.ok) {
    throw new Error(`LeetCode API error: ${res.status}`);
  }

  const json = await res.json() as LeetCodeApiResponse;

  if (!json.data.user) {
    throw new Error("LeetCode user not found");
  }

  const ac = json.data.user.submits.ac;
  const get = (difficulty: string) => ac.find((x) => x.difficulty === difficulty)?.count ?? 0;

  return {
    solved: get("All"),
    easy: get("Easy"),
    medium: get("Medium"),
    hard: get("Hard"),
    recentSubmissions: json.data.recentSubmissionList ?? [],
  };
}
