import { fetchGitHub, aggregateLanguages } from "./github";
import { fetchLeetCode } from "./leetcode";
import { calculateRank } from "./rank";
import { renderCard, renderErrorCard } from "./renderer";
import type { Env, ProfileData } from "./types";

const KV_KEY = "profile_data";

// ── Data pipeline ──────────────────────────────────────────────────────────

async function buildProfileData(env: Env): Promise<ProfileData> {
  if (!env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is not set — add it to .dev.vars for local dev or via `wrangler secret put GITHUB_TOKEN` for production");
  }
  console.log("[dev-card] fetching GitHub + LeetCode data...");
  const [ghRaw, leetcode] = await Promise.all([
    fetchGitHub(env.GITHUB_TOKEN),
    fetchLeetCode(),
  ]);

  const languages = aggregateLanguages(ghRaw.rawLanguages, 8);
  const rank = calculateRank(ghRaw.stats);
  console.log(`[dev-card] rank=${rank.level} (${rank.percentile.toFixed(1)}%), languages=${languages.length}, commits=${ghRaw.stats.commits}`);

  return {
    github: {
      contributionWeeks: ghRaw.contributionWeeks,
      stats: ghRaw.stats,
      languages,
    },
    leetcode,
    rank,
    fetchedAt: new Date().toISOString(),
  };
}

async function refreshData(env: Env): Promise<ProfileData> {
  const fresh = await buildProfileData(env);
  await env.KV.put(KV_KEY, JSON.stringify(fresh), {
    // TTL slightly longer than the cron interval so stale data survives a missed cron
    expirationTtl: 60 * 60 * 8,
  });
  return fresh;
}

async function getOrRefreshData(env: Env): Promise<ProfileData> {
  const cached = await env.KV.get(KV_KEY);
  if (cached) {
    return JSON.parse(cached) as ProfileData;
  }
  return refreshData(env);
}

// ── Fetch handler ──────────────────────────────────────────────────────────

async function handleFetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname !== "/card.svg") {
    return new Response("Not Found", { status: 404 });
  }

  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  let svg: string;
  let isError = false;
  try {
    const data = await getOrRefreshData(env);
    svg = renderCard(data);
  } catch (err) {
    isError = true;
    console.error("[dev-card] fetch failed:", err);
    const stale = await env.KV.get(KV_KEY);
    if (stale) {
      isError = false;
      console.log("[dev-card] serving stale cached data");
      svg = renderCard(JSON.parse(stale) as ProfileData);
    } else {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[dev-card] no cached data available, returning error card");
      svg = renderErrorCard(msg);
    }
  }

  const response = new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": isError ? "no-store" : "public, max-age=21600, s-maxage=21600",
    },
  });

  if (!isError) {
    ctx.waitUntil(cache.put(request, response.clone()));
  }

  return response;
}

// ── Scheduled handler (cron every 6 hours) ────────────────────────────────

async function handleScheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
  console.log("[dev-card] cron triggered, refreshing data...");
  try {
    await refreshData(env);
    console.log("[dev-card] cron refresh complete");
  } catch (err) {
    console.error("[dev-card] cron refresh failed:", err);
  }
}

// ── Export ─────────────────────────────────────────────────────────────────

export default {
  fetch: handleFetch,
  scheduled: handleScheduled,
};
