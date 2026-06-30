import type { ContributionDay, Language, GitHubStats, LeetCodeStats, LeetCodeSubmission, RankResult, ProfileData } from "./types";

// ── Constants ──────────────────────────────────────────────────────────────

const W   = 900;
const H   = 500;
const PAD = 24;

const C = {
  bg:          "var(--c-bg)",
  border:      "var(--c-border)",
  track:       "var(--c-track)",
  textPrimary: "var(--c-text-primary)",
  textMuted:   "var(--c-text-muted)",
  accent:      "var(--c-accent)",
  heatmap0:    "var(--c-heat0)",
  heatmap1:    "var(--c-heat1)",
  heatmap2:    "var(--c-heat2)",
  heatmap3:    "var(--c-heat3)",
  heatmap4:    "var(--c-heat4)",
  easy:        "var(--c-easy)",
  medium:      "var(--c-medium)",
  hard:        "var(--c-hard)",
} as const;

const FONT        = `'JetBrains Mono', 'SFMono-Regular', Consolas, monospace`;
const MONTHS      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const LC_LANG: Record<string, string> = {
  python3: "py3", python: "py2", cpp: "C++", c: "C", java: "Java",
  javascript: "JS", typescript: "TS", rust: "rs", go: "Go",
  kotlin: "kt", swift: "Swift", csharp: "C#", ruby: "rb",
};

// ── Text helpers ───────────────────────────────────────────────────────────

function esc(s: string | number): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toLocaleString();
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function timeAgo(timestamp: string): string {
  const seconds = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (seconds < 60)    return "now";
  if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  if (days < 7)   return `${days}d ago`;
  if (days < 30)  return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${day}, ${year}`;
}

function heatColor(count: number, max: number): string {
  if (count === 0) return C.heatmap0;
  const r = count / max;
  if (r < 0.25) return C.heatmap1;
  if (r < 0.5)  return C.heatmap2;
  if (r < 0.75) return C.heatmap3;
  return C.heatmap4;
}

function rankColor(level: string): string {
  if (["S", "A+", "A"].includes(level)) return C.accent;
  if (["A-", "B+"].includes(level))     return C.easy;
  if (["B", "B-"].includes(level))      return C.medium;
  return C.hard;
}

// ── Stat icons (simple geometric, centered at cx/cy) ──────────────────────

function statIcon(type: string, cx: number, cy: number, color: string): string {
  const lc = `stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const fc = `fill="${color}"`;
  switch (type) {
    case "commits":
      // git commit: horizontal line with filled circle at center
      return `<line x1="${cx - 8}" y1="${cy}" x2="${cx - 3}" y2="${cy}" ${lc}/>`
           + `<circle cx="${cx}" cy="${cy}" r="2.5" ${fc}/>`
           + `<line x1="${cx + 3}" y1="${cy}" x2="${cx + 8}" y2="${cy}" ${lc}/>`;
    case "prs": {
      // GitHub Octicon git-pull-request (16×16 viewBox), scaled to ~13px and centered
      const s  = 0.8125;
      const tx = (cx - 8 * s).toFixed(2);
      const ty = (cy - 8 * s).toFixed(2);
      return `<g transform="translate(${tx} ${ty}) scale(${s})"><path fill="${color}" stroke="none" d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/></g>`;
    }
    case "issues":
      // circle with info symbol
      return `<circle cx="${cx}" cy="${cy}" r="5.5" ${lc}/>`
           + `<line x1="${cx}" y1="${cy - 2.5}" x2="${cx}" y2="${cy + 0.5}" ${lc}/>`
           + `<circle cx="${cx}" cy="${cy + 3}" r="0.8" ${fc}/>`;
    case "reviews":
      // eye: ellipse + pupil dot
      return `<ellipse cx="${cx}" cy="${cy}" rx="7" ry="4.5" ${lc}/>`
           + `<circle cx="${cx}" cy="${cy}" r="1.8" ${fc}/>`;
    case "repos":
      // book / file
      return `<rect x="${cx - 5}" y="${cy - 6}" width="10" height="12" rx="1.5" ${lc}/>`
           + `<line x1="${cx - 2.5}" y1="${cy - 3}" x2="${cx + 2.5}" y2="${cy - 3}" ${lc}/>`;
    case "stars": {
      const pts: string[] = [];
      for (let i = 0; i < 5; i++) {
        const oa = (i * 72 - 90) * Math.PI / 180;
        const ia = oa + 36 * Math.PI / 180;
        pts.push(`${(cx + 5.5 * Math.cos(oa)).toFixed(1)},${(cy + 5.5 * Math.sin(oa)).toFixed(1)}`);
        pts.push(`${(cx + 2.3 * Math.cos(ia)).toFixed(1)},${(cy + 2.3 * Math.sin(ia)).toFixed(1)}`);
      }
      return `<polygon points="${pts.join(" ")}" ${fc}/>`;
    }
    default:
      return `<circle cx="${cx}" cy="${cy}" r="4" ${fc}/>`;
  }
}

// ── Section: Header ────────────────────────────────────────────────────────

function renderHeader(): string {
  return `
  <text x="${PAD}" y="34" font-family="${FONT}" font-size="20" font-weight="700" fill="${C.textPrimary}">DerekCorniello</text>
  <text x="${PAD}" y="53" font-family="${FONT}" font-size="11" fill="${C.textMuted}">Last 12 Months</text>
  <line x1="${PAD}" y1="65" x2="${W - PAD}" y2="65" stroke="${C.border}" stroke-width="1"/>`;
}

// ── Section: Heatmap ───────────────────────────────────────────────────────

function renderHeatmap(weeks: ContributionDay[][]): string {
  const CELL      = 11;
  const GAP       = 3;
  const STEP      = CELL + GAP;
  const GRID_Y    = 102;
  const NUM_WEEKS = weeks.length;

  // Center the cell grid horizontally between card edges
  const cellsWidth = (NUM_WEEKS - 1) * STEP + CELL;
  const GRID_X = PAD + Math.round((W - 2 * PAD - cellsWidth) / 2);

  const max = Math.max(...weeks.flatMap((w) => w.map((d) => d.contributionCount)), 1);

  let lastKey = "";
  let monthLabels = "";
  for (let wi = 0; wi < weeks.length; wi++) {
    const days = weeks[wi];
    if (!days.length) continue;
    const d = new Date(days[0].date + "T00:00:00");
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (wi === 0) { lastKey = key; continue; }
    if (key !== lastKey) {
      monthLabels += `<text x="${GRID_X + wi * STEP}" y="${GRID_Y - 5}" font-family="${FONT}" font-size="10" fill="${C.textMuted}">${MONTHS[d.getMonth()]}</text>`;
      lastKey = key;
    }
  }

  const dayLabels = ([
    [1, "Mon"], [3, "Wed"], [5, "Fri"],
  ] as [number, string][]).map(([row, label]) =>
    `<text x="${GRID_X - 6}" y="${GRID_Y + row * STEP + CELL - 1}" text-anchor="end" font-family="${FONT}" font-size="9" fill="${C.textMuted}">${label}</text>`,
  ).join("");

  let cells = "";
  for (let wi = 0; wi < weeks.length; wi++) {
    for (let di = 0; di < weeks[wi].length; di++) {
      const { date, contributionCount } = weeks[wi][di];
      const noun = contributionCount === 1 ? "contribution" : "contributions";
      const tooltip = `${formatDate(date)} - ${contributionCount} ${noun}`;
      cells += `<rect x="${GRID_X + wi * STEP}" y="${GRID_Y + di * STEP}" width="${CELL}" height="${CELL}" rx="2" fill="${heatColor(contributionCount, max)}"><title>${esc(tooltip)}</title></rect>`;
    }
  }

  const bottom = GRID_Y + 7 * STEP + 10;
  return `
  <text x="${PAD}" y="85" font-family="${FONT}" font-size="10" fill="${C.textMuted}">CONTRIBUTIONS</text>
  ${dayLabels}${monthLabels}${cells}
  <line x1="${PAD}" y1="${bottom}" x2="${W - PAD}" y2="${bottom}" stroke="${C.border}" stroke-width="1"/>`;
}

// ── Section: Languages (stacked bar + 2-col inline labels) ────────────────

function renderLanguages(languages: Language[], y0: number): string {
  const BAR_W = 420;
  const BAR_H = 8;
  const barY  = y0 + 26;
  const gridY = barY + BAR_H + 14;

  let barSegments = "";
  let barX = PAD;
  for (const lang of languages) {
    const segW = (lang.percentage / 100) * BAR_W;
    if (segW < 0.5) continue;
    barSegments += `<rect x="${barX.toFixed(2)}" y="${barY}" width="${segW.toFixed(2)}" height="${BAR_H}" fill="${lang.color}"><title>${esc(lang.name)}: ${lang.percentage.toFixed(2)}%</title></rect>`;
    barX += segW;
  }

  // Two left-aligned columns: each item is "Name - pct%" inline
  const COL2_X = PAD + BAR_W / 2 + 20;  // 254 — generous gap between columns

  let items = "";
  for (let i = 0; i < Math.min(languages.length, 8); i++) {
    const { name, color, percentage } = languages[i];
    const right = i >= 4;
    const row   = right ? i - 4 : i;
    const x     = right ? COL2_X : PAD;
    const y     = gridY + row * 18;
    const label = `${name} - ${percentage.toFixed(2)}%`;
    items += `
    <circle cx="${x + 4}" cy="${y - 3.5}" r="4" fill="${color}"/>
    <text x="${x + 13}" y="${y}" font-family="${FONT}" font-size="11" fill="${C.textPrimary}">${esc(label)}</text>`;
  }

  return `
  <text x="${PAD}" y="${y0 + 13}" font-family="${FONT}" font-size="10" fill="${C.textMuted}">TOP LANGUAGES</text>
  <clipPath id="lbar"><rect x="${PAD}" y="${barY}" width="${BAR_W}" height="${BAR_H}" rx="4"/></clipPath>
  <rect x="${PAD}" y="${barY}" width="${BAR_W}" height="${BAR_H}" rx="4" fill="${C.track}"/>
  <g clip-path="url(#lbar)">${barSegments}</g>
  ${items}`;
}

// ── Section: Stats + big Rank circle ──────────────────────────────────────

function renderStats(stats: GitHubStats, rank: RankResult, y0: number): string {
  const rankCX    = W - PAD - 44;   // 832
  const rankCY    = y0 + 90;        // vertically centered in section
  const rankR     = 42;
  const rankClr   = rankColor(rank.level);
  const circ      = +(2 * Math.PI * rankR).toFixed(2);
  const offset    = +((1 - rank.percentile / 100) * circ).toFixed(2);

  // Render rank level as a single text string; shift x right by 6px when a
  // modifier (+/-) is present so the heavier letter character sits optically
  // centered in the circle rather than the geometric string center.
  const hasMod  = /[+-]$/.test(rank.level);
  const rankTX  = rankCX + (hasMod ? 6 : 0);

  const rankEl = `
  <circle cx="${rankCX}" cy="${rankCY}" r="${rankR}" fill="none" stroke="${C.track}" stroke-width="5"/>
  <circle cx="${rankCX}" cy="${rankCY}" r="${rankR}" fill="none" stroke="${rankClr}" stroke-width="5"
    stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
    stroke-linecap="round" transform="rotate(-90 ${rankCX} ${rankCY})"/>
  <text x="${rankTX}" y="${rankCY + 9}" text-anchor="middle"
    font-family="${FONT}" font-size="22" font-weight="700" fill="${C.textPrimary}">${esc(rank.level)}</text>
  <text x="${rankCX}" y="${rankCY + rankR + 13}" text-anchor="middle"
    font-family="${FONT}" font-size="9" fill="${C.textMuted}">RANK</text>`;

  // Stats grid: 2 rows × 3 cols left of the rank circle, with icons above each value
  const x      = 464;
  const availW = rankCX - rankR - 16 - x;
  const colW   = availW / 3;

  const grid: [string, string | number, string][] = [
    ["Commits",       fmt(stats.commits),       "commits"],
    ["Pull Requests", fmt(stats.prs),            "prs"],
    ["Issues",        fmt(stats.issues),         "issues"],
    ["Code Reviews",  fmt(stats.reviews),        "reviews"],
    ["Repos",         stats.reposContributed,    "repos"],
    ["Stars",         fmt(stats.stars),          "stars"],
  ];

  let out = `
  <text x="${x}" y="${y0 + 13}" font-family="${FONT}" font-size="10" fill="${C.textMuted}">STATS</text>
  ${rankEl}`;

  for (let i = 0; i < grid.length; i++) {
    const [label, value, iconType] = grid[i];
    const col    = i % 3;
    const row    = Math.floor(i / 3);
    const tx     = x + col * colW + colW / 2;
    const iconY  = y0 + 44 + row * 62;
    const vy     = iconY + 28;
    out += statIcon(iconType, tx, iconY, C.textMuted);
    out += `
    <text x="${tx.toFixed(1)}" y="${vy}" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="700" fill="${C.accent}">${esc(value)}</text>
    <text x="${tx.toFixed(1)}" y="${vy + 14}" text-anchor="middle" font-family="${FONT}" font-size="9" fill="${C.textMuted}">${esc(label)}</text>`;
  }

  return out;
}

// ── Section: LeetCode wheel (stroke-based) + recent submissions ────────────

function renderLeetCode(lc: LeetCodeStats, y0: number): string {
  // Wheel dimensions — stroke-based circles guarantee a perfect ring shape
  const cx  = PAD + 58;    // 82
  const cy  = y0 + 58;     // donut center
  const r   = 36;           // ring radius
  const sw  = 14;           // stroke-width → outer = r+sw/2 = 43, inner = r-sw/2 = 29
  const circ = 2 * Math.PI * r;
  const GAP_PX     = 2;
  // Rotating each segment forward by half the gap width centers the gap between
  // neighbors instead of placing it entirely at the trailing edge of each arc.
  const halfGapDeg = (GAP_PX / circ) * 360;

  const total = (lc.easy + lc.medium + lc.hard) || 1;
  const difficulties: [string, number, string][] = [
    ["Easy",   lc.easy,   C.easy],
    ["Medium", lc.medium, C.medium],
    ["Hard",   lc.hard,   C.hard],
  ];

  // Track ring
  let wheel = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.track}" stroke-width="${sw}"/>`;

  // Colored segments via stroke-dasharray; each circle is rotated to its start angle
  let cumPct = 0;
  for (const [label, count, color] of difficulties) {
    const pct    = count / total;
    const arcLen = Math.max(0, pct * circ - GAP_PX);
    const rest   = circ - arcLen;
    const angle  = -90 + cumPct * 360 + halfGapDeg;
    wheel += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
      stroke-dasharray="${arcLen.toFixed(2)} ${rest.toFixed(2)}" stroke-linecap="butt"
      transform="rotate(${angle.toFixed(2)} ${cx} ${cy})">
      <title>${esc(label)}: ${count}</title></circle>`;
    cumPct += pct;
  }

  // Solved count in center hole
  wheel += `
  <text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="${FONT}" font-size="17" font-weight="700" fill="${C.textPrimary}">${lc.solved}</text>
  <text x="${cx}" y="${cy + 15}" text-anchor="middle" font-family="${FONT}" font-size="6" fill="${C.textMuted}">solved</text>`;

  // E / M / H mini-stats to the right of the wheel, before the vertical divider
  const statsX = cx + r + sw / 2 + 18;  // right edge of wheel + gap = 143
  const divX   = 310;
  const emhColW = (divX - statsX) / 3;

  let diffStats = "";
  for (let i = 0; i < difficulties.length; i++) {
    const [label, count, color] = difficulties[i];
    const tx = statsX + i * emhColW + emhColW / 2;
    diffStats += `
    <text x="${tx.toFixed(1)}" y="${cy - 14}" text-anchor="middle" font-family="${FONT}" font-size="9" fill="${C.textMuted}">${label.toUpperCase()}</text>
    <text x="${tx.toFixed(1)}" y="${cy + 2}" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="700" fill="${color}">${count}</text>`;
  }

  // Vertical divider between wheel area and submissions
  const divLine = `<line x1="${divX}" y1="${y0 + 6}" x2="${divX}" y2="${y0 + 110}" stroke="${C.border}" stroke-width="1"/>`;

  // Recent submissions (right of divider)
  const subX = divX + 14;   // 324
  let subLabel = `<text x="${subX}" y="${y0 + 11}" font-family="${FONT}" font-size="9" fill="${C.textMuted}">RECENT</text>`;

  let submissions = "";
  for (let i = 0; i < Math.min(lc.recentSubmissions.length, 5); i++) {
    const sub: LeetCodeSubmission = lc.recentSubmissions[i];
    const rowY      = y0 + 24 + i * 20;
    const accepted  = sub.statusDisplay === "Accepted";
    const dotColor  = accepted ? C.easy : C.hard;
    const langStr   = LC_LANG[sub.lang] ?? sub.lang;
    const ago       = timeAgo(sub.timestamp);
    // Title: reserve ~44px for lang + ~44px for time-ago on the right
    const titleW    = W - PAD - subX - 15 - 44 - 44;
    const titleText = truncate(sub.title, Math.floor(titleW / 6.4));

    submissions += `
    <circle cx="${subX + 5}" cy="${rowY - 3}" r="3.5" fill="${dotColor}"/>
    <text x="${subX + 15}" y="${rowY}" font-family="${FONT}" font-size="11" fill="${C.textPrimary}">${esc(titleText)}</text>
    <text x="${W - PAD - 44}" y="${rowY}" text-anchor="end" font-family="${FONT}" font-size="9" fill="${C.textMuted}">${esc(langStr)}</text>
    <text x="${W - PAD}" y="${rowY}" text-anchor="end" font-family="${FONT}" font-size="9" fill="${C.textMuted}">${esc(ago)}</text>`;
  }

  return `${wheel}${diffStats}${divLine}${subLabel}${submissions}`;
}

// ── Card ───────────────────────────────────────────────────────────────────

export function renderCard(data: ProfileData): string {
  const GRID_Y     = 102;
  const heatBottom = GRID_Y + 7 * 14 + 10;  // 210
  const colY       = heatBottom + 16;         // 226
  const lcDivY     = colY + 158;              // 384  (icon rows need extra vertical room)
  const lcY        = lcDivY + 4;              // 388

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Developer card for DerekCorniello">
  <title>DerekCorniello - Developer Card</title>
  <defs>
    <style><![CDATA[
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
      :root {
        --c-bg: #0d1117;
        --c-border: #30363d;
        --c-track: #21262d;
        --c-text-primary: #e6edf3;
        --c-text-muted: #8b949e;
        --c-accent: #58a6ff;
        --c-heat0: #161b22;
        --c-heat1: #0e4429;
        --c-heat2: #006d32;
        --c-heat3: #26a641;
        --c-heat4: #39d353;
        --c-easy: #2ea043;
        --c-medium: #d29922;
        --c-hard: #f85149;
      }
      @media (prefers-color-scheme: light) {
        :root {
          --c-bg: #ffffff;
          --c-border: #d0d7de;
          --c-track: #eaeef2;
          --c-text-primary: #1f2328;
          --c-text-muted: #57606a;
          --c-accent: #0969da;
          --c-heat0: #ebedf0;
          --c-heat1: #9be9a8;
          --c-heat2: #40c463;
          --c-heat3: #30a14e;
          --c-heat4: #216e39;
          --c-easy: #1a7f37;
          --c-medium: #9a6700;
          --c-hard: #cf222e;
        }
      }
    ]]></style>
  </defs>
  <!-- Divider with LEETCODE badge tab -->
  <line x1="${PAD}" y1="${lcDivY}" x2="${W - PAD}" y2="${lcDivY}" stroke="${C.border}" stroke-width="1"/>
  <rect x="${PAD}" y="${lcDivY - 7}" width="82" height="14" rx="2" fill="${C.bg}"/>
  <text x="${PAD + 5}" y="${lcDivY + 4}" font-family="${FONT}" font-size="10" fill="${C.textMuted}">LEETCODE</text>

  ${renderHeader()}
  ${renderHeatmap(data.github.contributionWeeks)}
  ${renderLanguages(data.github.languages, colY)}
  ${renderStats(data.github.stats, data.rank, colY)}
  ${renderLeetCode(data.leetcode, lcY)}
</svg>`;
}

export function renderErrorCard(message: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="110" viewBox="0 0 ${W} 110" role="img">
  <title>Error</title>
  <rect width="${W}" height="110" rx="12" fill="${C.bg}"/>
  <text x="${W / 2}" y="48" text-anchor="middle" font-family="${FONT}" font-size="15" fill="${C.hard}">Failed to load developer card</text>
  <text x="${W / 2}" y="70" text-anchor="middle" font-family="${FONT}" font-size="12" fill="${C.textMuted}">${esc(message)}</text>
</svg>`;
}
