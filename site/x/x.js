const LOCAL_DATA_URL = "/api/x-analysis/latest";
const STATIC_DATA_URL = "../../data/site/x-analysis/latest.json";

function getDataUrl() {
  return window.location.pathname.startsWith("/x-analysis/")
    ? LOCAL_DATA_URL
    : STATIC_DATA_URL;
}

const state = {
  data: null,
  error: null,
};

const elements = {
  subtitle: document.getElementById("subtitle"),
  statusText: document.getElementById("statusText"),
  generatedAt: document.getElementById("generatedAt"),
  postCount: document.getElementById("postCount"),
  errorBox: document.getElementById("errorBox"),
  postsList: document.getElementById("postsList"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeTicker(value) {
  return String(value || "").replace(/^\$/, "").trim().toUpperCase();
}

function normalizePost(post) {
  const visibility = firstText(post?.visibility, "public");
  const mentionedTickers = asArray(post?.mentioned_tickers || post?.tickers)
    .map(normalizeTicker)
    .filter(Boolean);
  return {
    id: firstText(post?.post_id, post?.id, post?.url, "unknown"),
    url: firstText(post?.url, post?.source_url),
    publishedAt: firstText(post?.published_at, post?.created_at),
    createdAt: firstText(post?.published_at, post?.created_at, post?.collected_at_utc),
    visibility,
    isSubscriberOnly: visibility === "subscriber_only",
    summary: firstText(post?.summary_cn, post?.summary),
    keyPoints: asArray(post?.key_points),
    mentionedTickers,
  };
}

function postSortTimestamp(post) {
  const timestamp = Date.parse(post?.publishedAt || post?.createdAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getPosts(data) {
  return asArray(data?.posts)
    .map(normalizePost)
    .sort((a, b) => postSortTimestamp(b) - postSortTimestamp(a));
}

function badge(label, className = "") {
  return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
}

function renderPosts(posts) {
  if (!posts.length) {
    elements.postsList.innerHTML = `<div class="empty-state">No posts found in latest.json.</div>`;
    return;
  }
  elements.postsList.innerHTML = posts.map((post) => {
    const timeLabel = post.publishedAt
      ? `Published ${formatDate(post.publishedAt)}`
      : "Published time unknown";
    const tickerLine = post.mentionedTickers.length
      ? `<div class="ticker-line">${escapeHtml(post.mentionedTickers.map((item) => `$${item}`).join(" "))}</div>`
      : "";
    return `
      <article class="post-card">
        <div class="card-topline">
          <span>${escapeHtml(timeLabel)}</span>
          ${badge(post.visibility, post.isSubscriberOnly ? "visibility-private" : "visibility-public")}
        </div>
        <h3>${escapeHtml(post.summary || "No summary yet")}</h3>
        ${post.keyPoints.length ? `<ul class="point-list">${post.keyPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
        <div class="meta-row">
          ${tickerLine}
          ${post.url ? `<a href="${escapeHtml(post.url)}" target="_blank" rel="noreferrer">Open source</a>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

function renderAll() {
  const data = state.data || {};
  const posts = getPosts(data);
  const publishedTimes = posts
    .map((post) => formatDate(post.publishedAt))
    .filter((value) => value !== "-")
    .slice(0, 3)
    .join(" - ");
  elements.subtitle.textContent = `@${firstText(data.account, "aleabitoreddit")} latest posts${publishedTimes ? ` - ${publishedTimes}` : ""}`;
  elements.statusText.textContent = state.error ? "Error" : "Ready";
  elements.generatedAt.textContent = formatDate(data.generated_at || data.updated_at);
  elements.postCount.textContent = String(posts.length);
  elements.errorBox.hidden = !state.error;
  elements.errorBox.textContent = state.error || "";
  renderPosts(posts);
}

async function loadData() {
  try {
    const response = await fetch(`${getDataUrl()}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load latest.json: HTTP ${response.status}`);
    state.data = await response.json();
    state.error = null;
  } catch (error) {
    state.data = null;
    state.error = error instanceof Error ? error.message : String(error);
  }
  renderAll();
}

loadData();
