import { Octokit } from "@octokit/rest";

const THEMES = {
  githubDark: { bg: "#0d1117", text: "#c9d1d9", accent: "#58a6ff" },
  dracula: { bg: "#282a36", text: "#f8f8f2", accent: "#bd93f9" },
  nord: { bg: "#2e3440", text: "#d8dee9", accent: "#88c0d0" },
  solarizedDark: { bg: "#002b36", text: "#93a1a1", accent: "#b58900" },
  catppuccinMocha: { bg: "#1e1e2e", text: "#cdd6f4", accent: "#cba6f7" },
  tokyoNight: { bg: "#1a1b26", text: "#c0caf5", accent: "#7aa2f7" },
  monokai: { bg: "#272822", text: "#f8f8f2", accent: "#f92672" },
  gruvboxDark: { bg: "#282828", text: "#ebdbb2", accent: "#fabd2f" },
  emberGlow: { bg: "#1a120c", text: "#f1d8c4", accent: "#ff6d1f" }
};

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const formatNumber = (value) => new Intl.NumberFormat("en-US").format(value);
const formatDate = (value) => {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toISOString().slice(0, 10);
};

const getParam = (req, body, key, fallback) => {
  if (req.query && req.query[key] !== undefined) return req.query[key];
  if (body && body[key] !== undefined) return body[key];
  return fallback;
};

const normalizeColor = (value, fallback) => {
  if (!value) return fallback;
  return value.startsWith("#") ? value : `#${value}`;
};

const parseMetrics = (value) =>
  String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const metricLabels = {
  stars: "Stars",
  forks: "Forks",
  issues: "Issues",
  watchers: "Watchers",
  language: "Language",
  prs: "Open PRs",
  issues_only: "Open Issues",
  contributors: "Contributors",
  latest_release: "Latest release",
  last_commit: "Last commit",
  license: "License",
  size: "Size",
  created: "Created",
  updated: "Updated",
  downloads: "Downloads"
};

const metricEmoji = {
  stars: "⭐",
  forks: "🍴",
  issues: "🐞",
  watchers: "👀",
  language: "🧠",
  prs: "🔀",
  issues_only: "🧩",
  contributors: "👥",
  latest_release: "🏷️",
  last_commit: "🕒",
  license: "📄",
  size: "📦",
  created: "📆",
  updated: "📝",
  downloads: "⬇️"
};

async function fetchRepoMetrics(owner, repo, requested) {
  const needs = new Set(requested);
  if (!owner || !repo) return { values: {}, repoData: null };

  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const values = {
    stars: formatNumber(repoData.stargazers_count ?? 0),
    forks: formatNumber(repoData.forks_count ?? 0),
    issues: formatNumber(repoData.open_issues_count ?? 0),
    watchers: formatNumber(repoData.subscribers_count ?? repoData.watchers_count ?? 0),
    language: repoData.language || "N/A",
    license: repoData.license?.spdx_id || "N/A",
    size: `${formatNumber(repoData.size ?? 0)} KB`,
    created: formatDate(repoData.created_at),
    updated: formatDate(repoData.updated_at),
    last_commit: formatDate(repoData.pushed_at)
  };

  if (needs.has("prs")) {
    const prs = await octokit.search.issuesAndPullRequests({
      q: `repo:${owner}/${repo} is:pr is:open`
    });
    values.prs = formatNumber(prs.data.total_count ?? 0);
  }

  if (needs.has("issues_only")) {
    const issuesOnly = await octokit.search.issuesAndPullRequests({
      q: `repo:${owner}/${repo} is:issue is:open`
    });
    values.issues_only = formatNumber(issuesOnly.data.total_count ?? 0);
  }

  if (needs.has("contributors")) {
    const contributors = await octokit.repos.listContributors({
      owner,
      repo,
      per_page: 1,
      anon: true
    });
    const link = contributors.headers?.link || "";
    const match = /&page=(\d+)>; rel="last"/.exec(link);
    const count = match ? Number.parseInt(match[1], 10) : contributors.data.length;
    values.contributors = formatNumber(Number.isFinite(count) ? count : 0);
  }

  if (needs.has("latest_release") || needs.has("downloads")) {
    try {
      const latest = await octokit.repos.getLatestRelease({ owner, repo });
      values.latest_release = latest.data?.tag_name || "N/A";
      if (needs.has("downloads")) {
        const downloads = (latest.data.assets || []).reduce(
          (sum, asset) => sum + (asset.download_count || 0),
          0
        );
        values.downloads = formatNumber(downloads);
      }
    } catch (err) {
      values.latest_release = "N/A";
      if (needs.has("downloads")) values.downloads = "0";
    }
  }

  return { values, repoData };
}

function renderBadge({
  owner,
  repo,
  metrics,
  colors,
  titleSizePx,
  metricSizePx,
  glow,
  emoji,
  metricValues,
  transparentBg,
  outline
}) {
  const lineHeight = Math.max(14, Math.round(metricSizePx * 1.6));
  const titleY = 18 + titleSizePx;
  const metricsStartY = titleY + Math.round(metricSizePx * 1.8);
  let y = metricsStartY;
  const selected = parseMetrics(metrics);

  const statLines = selected
    .map((stat) => {
      const label = metricLabels[stat] || stat;
      const value = metricValues[stat] ?? "N/A";
      const lineY = y + Math.round(lineHeight / 2);
      const baseX = 20;
      const emojiEnabled = emoji === "1";
      const emojiChar = metricEmoji[stat] || "•";
      const labelX = emojiEnabled ? baseX + Math.round(metricSizePx * 1.4) : baseX;
      const emojiLine = emojiEnabled
        ? `<text x="${baseX}" y="${lineY}" class="stat emoji" dominant-baseline="middle">${emojiChar}</text>`
        : "";
      const labelLine = `<text x="${labelX}" y="${lineY}" class="stat" dominant-baseline="middle">${label}: ${value}</text>`;
      y += lineHeight;
      return `${emojiLine}\n  ${labelLine}`;
    })
    .join("\n");

  const bgFill = transparentBg === "1" ? "transparent" : colors.bg;
  const stroke = outline === "1" ? colors.accent : "none";
  return `
<svg width="420" height="${y + 20}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text { font-family: monospace; fill: ${colors.text}; }
    .title { font-size: ${titleSizePx}px; fill: ${colors.accent}; }
    .stat { font-size: ${metricSizePx}px; }
    .emoji { font-size: ${metricSizePx}px; }
  </style>

  <defs>
    ${glow === "1" ? `
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>` : ""}
  </defs>

  <rect x="1" y="1" rx="12" width="418" height="${y + 10}"
        fill="${bgFill}" stroke="${stroke}"
        filter="${glow === "1" ? "url(#glow)" : ""}" />

  <text x="20" y="${titleY}" class="title" style="font-size:${titleSizePx}px;fill:${colors.accent}">${owner}/${repo}</text>
  ${statLines}
</svg>`;
}

function renderTemplate({
  title,
  subtitle,
  slots,
  colors,
  titleSizePx,
  metricSizePx,
  glow,
  emoji,
  logoHref,
  bgHref,
  style,
  metricValues,
  transparentBg,
  outline
}) {
  const width = style === "compact" ? 940 : 1200;
  const height = style === "compact" ? 220 : 320;
  const padding = style === "compact" ? 28 : 40;
  const logoSize = style === "compact" ? 72 : 96;
  const hasLogo = Boolean(logoHref);
  const contentX = padding + (hasLogo ? logoSize + 20 : 0);
  const titleY = padding + titleSizePx;
  const subtitleY = titleY + Math.round(titleSizePx * 1.4);
  const metricsY = height - padding - Math.round(metricSizePx * 0.2);
  const metricList = parseMetrics(slots);
  const metricCount = metricList.length || 3;
  const metricGap = Math.floor((width - contentX - padding) / metricCount);

  const metricBlocks = metricList
    .map((key, index) => {
      const label = metricLabels[key] || key;
      const value = metricValues[key] ?? "N/A";
      const icon = emoji === "1" ? `${metricEmoji[key] || "•"} ` : "";
      const x = contentX + metricGap * index;
      return `
    <g transform="translate(${x}, ${metricsY})">
      <text class="metric" y="0" dominant-baseline="middle" style="font-size:${metricSizePx}px">${icon}${label}: ${value}</text>
    </g>`;
    })
    .join("\n");

  const bgFill = transparentBg === "1" ? "transparent" : colors.bg;
  const overlayFill = transparentBg === "1" ? "transparent" : colors.bg;
  const overlayOpacity = bgHref ? "0.6" : "1";
  const stroke = outline === "1" ? colors.accent : "none";
  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text { font-family: "Iceland", monospace; fill: ${colors.text}; }
    .title { font-size: ${titleSizePx}px; fill: ${colors.accent}; font-weight: 700; }
    .subtitle { font-size: ${Math.max(10, Math.round(titleSizePx * 0.7))}px; fill: ${colors.text}; }
    .metric { font-size: ${metricSizePx}px; }
  </style>
  <defs>
    ${glow === "1" ? `
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>` : ""}
    ${bgHref ? `
    <pattern id="bgImage" patternUnits="objectBoundingBox" width="1" height="1">
      <image href="${bgHref}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />
    </pattern>` : ""}
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" rx="24"
        fill="${bgHref ? "url(#bgImage)" : bgFill}" />
  <rect x="0" y="0" width="${width}" height="${height}" rx="24"
        fill="${overlayFill}" opacity="${overlayOpacity}"
        stroke="${stroke}" filter="${glow === "1" ? "url(#glow)" : ""}" />

  ${hasLogo ? `<image href="${logoHref}" x="${padding}" y="${padding}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" />` : ""}

  <text x="${contentX}" y="${titleY}" class="title">${title}</text>
  ${subtitle ? `<text x="${contentX}" y="${subtitleY}" class="subtitle">${subtitle}</text>` : ""}
  ${metricBlocks}
</svg>`;
}

export default async function handler(req, res) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const mode = getParam(req, body, "mode", "badge");
  const owner = getParam(req, body, "owner", "");
  const repo = getParam(req, body, "repo", "");
  const metrics = getParam(req, body, "metrics", "stars,forks,issues,watchers");
  const slots = getParam(req, body, "slots", "stars,forks,downloads");
  const themeKey = getParam(req, body, "theme", "");
  const bg = normalizeColor(getParam(req, body, "bg", "#0d1117"), "#0d1117");
  const text = normalizeColor(getParam(req, body, "text", "#c9d1d9"), "#c9d1d9");
  const accent = normalizeColor(getParam(req, body, "accent", "#00f7ff"), "#00f7ff");
  const glow = getParam(req, body, "glow", "0");
  const emoji = getParam(req, body, "emoji", "1");
  const transparentBg = getParam(req, body, "transparentBg", "0");
  const outline = getParam(req, body, "outline", "1");
  const titleSize = getParam(req, body, "titleSize", 14);
  const metricSize = getParam(req, body, "metricSize", 12);
  const style = getParam(req, body, "style", "wide");

  const theme = THEMES[themeKey] || null;
  const colors = theme || { bg, text, accent };

  if (mode !== "template" && (!owner || !repo)) {
    return res.status(400).send("Missing owner or repo");
  }

  const requestedMetrics = mode === "template" ? parseMetrics(slots) : parseMetrics(metrics);
  let metricValues = {};

  try {
    if (owner && repo && requestedMetrics.length) {
      const { values } = await fetchRepoMetrics(owner, repo, requestedMetrics);
      metricValues = values;
    }
  } catch (err) {
    return res.status(502).send("Failed to fetch GitHub data.");
  }

  const titleSizePx = clamp(toInt(titleSize, 14), 10, 32);
  const metricSizePx = clamp(toInt(metricSize, 12), 9, 24);

  let svg = "";
  if (mode === "template") {
    const title = getParam(req, body, "title", "") || (owner && repo ? `${owner}/${repo}` : "GitHub Project");
    const subtitle = getParam(req, body, "subtitle", "");
    const logoHref = getParam(req, body, "logoData", "") || getParam(req, body, "logoUrl", "");
    const bgHref = getParam(req, body, "bgImageData", "") || getParam(req, body, "bgImageUrl", "");
    svg = renderTemplate({
      title,
      subtitle,
      slots,
      colors,
      titleSizePx,
      metricSizePx,
      glow,
      emoji,
      logoHref,
      bgHref,
      style,
      metricValues,
      transparentBg,
      outline
    });
  } else {
    svg = renderBadge({
      owner,
      repo,
      metrics,
      colors,
      titleSizePx,
      metricSizePx,
      glow,
      emoji,
      metricValues,
      transparentBg,
      outline
    });
  }

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "s-maxage=1800");
  res.send(svg);
}