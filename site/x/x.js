const LOCAL_DATA_URL = "/api/x-analysis/latest";
const STATIC_DATA_URL = "../../data/site/x-analysis/latest.json";

function getDataUrl() {
  return window.location.pathname.startsWith("/x-analysis/")
    ? LOCAL_DATA_URL
    : STATIC_DATA_URL;
}

const state = {
  data: null,
  activeTab: "posts",
  error: null,
};

const elements = {
  subtitle: document.getElementById("subtitle"),
  statusText: document.getElementById("statusText"),
  generatedAt: document.getElementById("generatedAt"),
  postCount: document.getElementById("postCount"),
  stockCount: document.getElementById("stockCount"),
  errorBox: document.getElementById("errorBox"),
  postsList: document.getElementById("postsList"),
  stocksList: document.getElementById("stocksList"),
  dailyList: document.getElementById("dailyList"),
  pipelineList: document.getElementById("pipelineList"),
  tabButtons: Array.from(document.querySelectorAll(".tab-button")),
  panels: {
    posts: document.getElementById("postsPanel"),
    stocks: document.getElementById("stocksPanel"),
    daily: document.getElementById("dailyPanel"),
    pipeline: document.getElementById("pipelinePanel"),
  },
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

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "-";
}

function normalizeStance(value) {
  const stance = firstText(value, "unclear").toLowerCase();
  return ["bullish", "bearish", "neutral", "mixed", "unclear"].includes(stance) ? stance : "unclear";
}

function normalizeStockView(view) {
  return {
    ticker: firstText(view?.ticker, view?.symbol).replace(/^\$/, "").toUpperCase(),
    stance: normalizeStance(view?.stance || view?.net_stance),
    confidence: view?.confidence,
    reason: firstText(view?.reason_cn, view?.reason, view?.latest_reason),
  };
}

function normalizePost(post) {
  const stockViews = asArray(post?.stock_views || post?.stocks).map(normalizeStockView).filter((item) => item.ticker);
  const visibility = firstText(post?.visibility, "public");
  const isSubscriberOnly = visibility === "subscriber_only";
  return {
    id: firstText(post?.post_id, post?.id, post?.url, "unknown"),
    url: firstText(post?.url, post?.source_url),
    publishedAt: firstText(post?.published_at, post?.created_at),
    createdAt: firstText(post?.published_at, post?.created_at, post?.collected_at_utc),
    visibility,
    isSubscriberOnly,
    summary: firstText(post?.summary_cn, post?.summary),
    keyPoints: asArray(post?.key_points),
    themes: asArray(post?.themes),
    mentionedTickers: asArray(post?.mentioned_tickers || post?.tickers).map((item) => String(item).replace(/^\$/, "").toUpperCase()),
    importance: post?.importance,
    confidence: post?.confidence,
    riskNotes: asArray(post?.risk_notes),
    stockViews,
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

function getStockViewsFromPosts(posts) {
  const byTicker = new Map();
  for (const post of posts) {
    for (const view of post.stockViews) {
      const current = byTicker.get(view.ticker) || {
        ticker: view.ticker,
        bullish_count: 0,
        bearish_count: 0,
        neutral_count: 0,
        mixed_count: 0,
        unclear_count: 0,
        latest_reasons: [],
        post_ids: [],
      };
      const key = `${view.stance}_count`;
      if (Object.prototype.hasOwnProperty.call(current, key)) current[key] += 1;
      else current.unclear_count += 1;
      if (view.reason) current.latest_reasons.push(view.reason);
      current.post_ids.push(post.id);
      byTicker.set(view.ticker, current);
    }
  }
  return Array.from(byTicker.values());
}

function getStockViews(data, posts) {
  const explicit = asArray(data?.stock_views || data?.stocks);
  if (explicit.length) {
    return explicit.map((item) => ({
      ticker: firstText(item?.ticker, item?.symbol).replace(/^\$/, "").toUpperCase(),
      bullish_count: Number(item?.bullish_count || 0),
      bearish_count: Number(item?.bearish_count || 0),
      neutral_count: Number(item?.neutral_count || 0),
      mixed_count: Number(item?.mixed_count || 0),
      unclear_count: Number(item?.unclear_count || 0),
      net_stance: firstText(item?.net_stance, item?.stance),
      latest_reasons: asArray(item?.latest_reasons || item?.reasons),
      post_ids: asArray(item?.post_ids),
    })).filter((item) => item.ticker);
  }
  return getStockViewsFromPosts(posts);
}

function badge(label, className = "") {
  return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
}

function renderStockBadges(stockViews) {
  if (!stockViews.length) return `<div class="muted">No stock stance detected.</div>`;
  return `
    <div class="badge-row">
      ${stockViews.map((view) => {
        const label = `$${view.ticker} ${view.stance}${Number.isFinite(Number(view.confidence)) ? ` ${formatNumber(view.confidence)}` : ""}`;
        return badge(label, `stance-${view.stance}`);
      }).join("")}
    </div>
  `;
}

function renderPosts(posts) {
  if (!posts.length) {
    elements.postsList.innerHTML = `<div class="empty-state">No posts found in latest.json.</div>`;
    return;
  }
  elements.postsList.innerHTML = posts.map((post) => {
    const details = post.stockViews
      .map((view) => `
        <div class="stance-reason">
          <strong>$${escapeHtml(view.ticker)} ${escapeHtml(view.stance)}</strong>
          <span>${escapeHtml(view.reason || "No reason provided.")}</span>
        </div>
      `).join("");
    const timeLabel = post.publishedAt
      ? `Published ${formatDate(post.publishedAt)}`
      : `Published time unknown`;
    return `
      <article class="post-card">
        <div class="card-topline">
          <span>${escapeHtml(timeLabel)}</span>
          ${badge(post.visibility, post.isSubscriberOnly ? "visibility-private" : "visibility-public")}
        </div>
        <h3>${escapeHtml(post.summary || "No summary yet")}</h3>
        ${post.keyPoints.length ? `<ul class="point-list">${post.keyPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
        ${renderStockBadges(post.stockViews)}
        ${details ? `<div class="stance-details">${details}</div>` : ""}
        <div class="meta-row">
          ${post.themes.map((item) => badge(item, "theme-badge")).join("")}
          ${post.mentionedTickers.map((item) => badge(`$${item}`, "ticker-badge")).join("")}
          ${post.url ? `<a href="${escapeHtml(post.url)}" target="_blank" rel="noreferrer">Open source</a>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

function netStance(stock) {
  if (stock.net_stance) return normalizeStance(stock.net_stance);
  const counts = [
    ["bullish", stock.bullish_count || 0],
    ["bearish", stock.bearish_count || 0],
    ["neutral", stock.neutral_count || 0],
    ["mixed", stock.mixed_count || 0],
    ["unclear", stock.unclear_count || 0],
  ].sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : "unclear";
}

function renderStocks(stocks) {
  if (!stocks.length) {
    elements.stocksList.innerHTML = `<div class="empty-state">No stock views found.</div>`;
    return;
  }
  elements.stocksList.innerHTML = stocks.map((stock) => {
    const stance = netStance(stock);
    return `
      <article class="stock-card">
        <div class="stock-header">
          <h3>$${escapeHtml(stock.ticker)}</h3>
          ${badge(stance, `stance-${escapeHtml(stance)}`)}
        </div>
        <div class="count-grid">
          <span>Bullish <strong>${escapeHtml(stock.bullish_count || 0)}</strong></span>
          <span>Bearish <strong>${escapeHtml(stock.bearish_count || 0)}</strong></span>
          <span>Neutral <strong>${escapeHtml(stock.neutral_count || 0)}</strong></span>
          <span>Mixed <strong>${escapeHtml(stock.mixed_count || 0)}</strong></span>
        </div>
        <div class="reason-list">
          ${asArray(stock.latest_reasons).slice(0, 4).map((reason) => `<p>${escapeHtml(reason)}</p>`).join("") || `<p class="muted">No reasons available.</p>`}
        </div>
        ${asArray(stock.post_ids).length ? `<div class="muted small-text">Posts: ${escapeHtml(asArray(stock.post_ids).slice(0, 8).join(", "))}</div>` : ""}
      </article>
    `;
  }).join("");
}

function renderDaily(data, posts, stocks) {
  const daily = data?.daily || data?.daily_summary || {};
  const themes = asArray(daily.themes || data?.themes);
  const highlights = asArray(daily.highlights || daily.key_points || data?.key_points);
  const importantPosts = posts
    .filter((post) => Number(post.importance || 0) >= 4)
    .slice(0, 5);
  const topStocks = stocks.slice(0, 8);
  elements.dailyList.innerHTML = `
    <article class="info-card">
      <h3>Summary</h3>
      <p>${escapeHtml(firstText(daily.summary_cn, daily.summary, data?.summary_cn, "No daily summary in latest.json."))}</p>
    </article>
    <article class="info-card">
      <h3>Themes</h3>
      <div class="badge-row">${themes.length ? themes.map((item) => badge(item, "theme-badge")).join("") : `<span class="muted">No themes available.</span>`}</div>
    </article>
    <article class="info-card">
      <h3>Highlights</h3>
      ${highlights.length ? `<ul class="point-list">${highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p class="muted">No highlights available.</p>`}
    </article>
    <article class="info-card">
      <h3>Top Stocks</h3>
      <div class="badge-row">${topStocks.length ? topStocks.map((stock) => badge(`$${stock.ticker} ${netStance(stock)}`, `stance-${netStance(stock)}`)).join("") : `<span class="muted">No stock views available.</span>`}</div>
    </article>
    <article class="info-card">
      <h3>Important Posts</h3>
      ${importantPosts.length ? importantPosts.map((post) => `<p><strong>${escapeHtml(formatDate(post.createdAt))}</strong> ${escapeHtml(post.summary || post.id)}</p>`).join("") : `<p class="muted">No posts marked important.</p>`}
    </article>
  `;
}

function renderPipeline(data) {
  const status = data?.status || data?.pipeline || {};
  const warnings = asArray(data?.warnings || status?.warnings);
  const rows = [
    ["Account", firstText(data?.account, status?.account, "aleabitoreddit")],
    ["Last fetch", formatDate(status?.last_fetch_at || data?.last_fetch_at)],
    ["Last analyze", formatDate(status?.last_analyze_at || data?.last_analyze_at)],
    ["New posts", status?.new_posts ?? "-"],
    ["Analyzed posts", status?.analyzed_posts ?? "-"],
    ["Repo push", firstText(status?.repo_push, status?.publisher, "-")],
    ["Data source", firstText(status?.source, data?.source, "-")],
  ];
  elements.pipelineList.innerHTML = `
    <article class="info-card pipeline-card">
      <h3>Run Status</h3>
      <dl>
        ${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
      </dl>
    </article>
    <article class="info-card pipeline-card">
      <h3>Warnings</h3>
      ${warnings.length ? `<ul class="point-list">${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p class="muted">No warnings.</p>`}
    </article>
  `;
}

function renderAll() {
  const data = state.data || {};
  const posts = getPosts(data);
  const stocks = getStockViews(data, posts);
  const publishedTimes = posts.map((post) => formatDate(post.publishedAt)).filter((value) => value !== "-").slice(0, 3).join(" · ");
  elements.subtitle.textContent = `@${firstText(data.account, "aleabitoreddit")} latest posts${publishedTimes ? ` · ${publishedTimes}` : ""}`;
  elements.statusText.textContent = state.error ? "Error" : "Ready";
  elements.generatedAt.textContent = formatDate(data.generated_at || data.updated_at);
  elements.postCount.textContent = String(posts.length);
  elements.stockCount.textContent = String(stocks.length);
  elements.errorBox.hidden = !state.error;
  elements.errorBox.textContent = state.error || "";
  renderPosts(posts);
  renderStocks(stocks);
  renderDaily(data, posts, stocks);
  renderPipeline(data);
}

function setActiveTab(tab) {
  state.activeTab = tab;
  for (const button of elements.tabButtons) {
    const isActive = button.dataset.tab === tab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  }
  for (const [name, panel] of Object.entries(elements.panels)) {
    const isActive = name === tab;
    panel.hidden = !isActive;
    panel.classList.toggle("is-active", isActive);
  }
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

for (const button of elements.tabButtons) {
  button.addEventListener("click", () => setActiveTab(button.dataset.tab));
}

setActiveTab(state.activeTab);
loadData();
