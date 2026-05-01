const LOCAL_DATA_URL = "/api/x-analysis/latest";
const STATIC_DATA_URL = "../../data/site/x-analysis/latest.json";

function getDataUrl() {
  return window.location.pathname.startsWith("/x-analysis/")
    ? LOCAL_DATA_URL
    : STATIC_DATA_URL;
}

function getRunApiCandidates() {
  const candidates = [];
  if (window.location.protocol === "http:" && ["127.0.0.1", "localhost"].includes(window.location.hostname)) {
    candidates.push(`${window.location.origin}/api/x-analysis/run`);
  }
  candidates.push("http://127.0.0.1:4174/api/x-analysis/run");
  candidates.push("http://127.0.0.1:4173/api/x-analysis/run");
  return Array.from(new Set(candidates));
}

const state = {
  data: null,
  error: null,
  selectedDate: localDateKey(new Date()),
};

const elements = {
  subtitle: document.getElementById("subtitle"),
  statusText: document.getElementById("statusText"),
  generatedAt: document.getElementById("generatedAt"),
  postCount: document.getElementById("postCount"),
  errorBox: document.getElementById("errorBox"),
  refreshStatus: document.getElementById("refreshStatus"),
  refreshButton: document.getElementById("refreshButton"),
  postsList: document.getElementById("postsList"),
  prevDateButton: document.getElementById("prevDateButton"),
  nextDateButton: document.getElementById("nextDateButton"),
  datePicker: document.getElementById("datePicker"),
  dateLabel: document.getElementById("dateLabel"),
  dateCount: document.getElementById("dateCount"),
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

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  const [year, month, day] = String(key || "").split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function addDays(key, days) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function formatDateLabel(key) {
  const date = dateFromKey(key);
  const label = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    weekday: "short",
  });
  return key === localDateKey(new Date()) ? `Today · ${label}` : label;
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

function postDateKey(post) {
  const date = new Date(post?.publishedAt || post?.createdAt || "");
  return Number.isNaN(date.getTime()) ? "" : localDateKey(date);
}

function getPosts(data) {
  return asArray(data?.posts)
    .map(normalizePost)
    .sort((a, b) => postSortTimestamp(b) - postSortTimestamp(a));
}

function availablePostDates(posts) {
  return Array.from(new Set(posts.map(postDateKey).filter(Boolean))).sort();
}

function badge(label, className = "") {
  return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
}

function renderDateControls(allPosts, filteredPosts) {
  const dates = availablePostDates(allPosts);
  const today = localDateKey(new Date());
  const minDate = dates[0] || today;
  elements.datePicker.value = state.selectedDate;
  elements.datePicker.min = minDate;
  elements.datePicker.max = today;
  elements.dateLabel.textContent = formatDateLabel(state.selectedDate);
  elements.dateCount.textContent = `${filteredPosts.length} posts`;
  elements.prevDateButton.disabled = state.selectedDate <= minDate;
  elements.nextDateButton.disabled = state.selectedDate >= today;
}

function renderPosts(posts, selectedDate) {
  if (!posts.length) {
    elements.postsList.innerHTML = `<div class="empty-state">No posts found for ${escapeHtml(formatDateLabel(selectedDate))}.</div>`;
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
  const allPosts = getPosts(data);
  const posts = allPosts.filter((post) => postDateKey(post) === state.selectedDate);
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
  renderDateControls(allPosts, posts);
  renderPosts(posts, state.selectedDate);
}

function setRefreshStatus(message, tone = "info") {
  elements.refreshStatus.hidden = !message;
  elements.refreshStatus.textContent = message || "";
  elements.refreshStatus.dataset.tone = tone;
}

function setSelectedDate(key) {
  state.selectedDate = key || localDateKey(new Date());
  renderAll();
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

async function runManualRefresh() {
  elements.refreshButton.disabled = true;
  elements.refreshButton.textContent = "Refreshing...";
  setRefreshStatus("Checking X for new posts. Keep the local server, Edge profile, and Ollama available.", "info");
  const body = {
    account: "aleabitoreddit",
    max_items: 200,
    window_hours: 336,
    publish: true,
    use_llm: true,
    publish_only_on_new: true,
    reuse_analysis_cache: true,
  };
  let lastError = "";
  try {
    for (const url of getRunApiCandidates()) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || `HTTP ${response.status}`);
        }
        state.data = payload.latest_payload || state.data;
        state.error = null;
        const newCount = Number(payload.new_raw_count || 0);
        if (newCount > 0) {
          setRefreshStatus(`Refresh complete. ${newCount} new post(s) published to GitHub.`, "success");
        } else {
          setRefreshStatus("Refresh complete. No new posts since the last refresh; existing posts were kept.", "success");
        }
        renderAll();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    throw new Error(lastError || "Local refresh API is unavailable.");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    setRefreshStatus(
      `Refresh failed. Open the local dashboard first with start_dashboard.cmd, then use http://127.0.0.1:4174/x-analysis/. Detail: ${detail}`,
      "error",
    );
  } finally {
    elements.refreshButton.disabled = false;
    elements.refreshButton.textContent = "Refresh";
  }
}

elements.prevDateButton.addEventListener("click", () => setSelectedDate(addDays(state.selectedDate, -1)));
elements.nextDateButton.addEventListener("click", () => setSelectedDate(addDays(state.selectedDate, 1)));
elements.datePicker.addEventListener("change", () => setSelectedDate(elements.datePicker.value));
elements.refreshButton.addEventListener("click", runManualRefresh);

loadData();
