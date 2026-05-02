const GITHUB_DATA_URL = "https://zihaoz11.github.io/ticker/data/site/x-analysis/latest.json";
const STATIC_DATA_URL = "../../data/site/x-analysis/latest.json";
const FAVORITES_STORAGE_KEY = "x-analysis-favorite-posts-v1";
const FILTER_LABELS = {
  all: "All",
  public: "Public",
  sub: "Sub",
  favorites: "Favorites",
};

function getDataUrl() {
  return window.location.pathname.startsWith("/x-analysis/")
    ? GITHUB_DATA_URL
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
  activeFilter: "all",
  favoriteIds: loadFavoriteIds(),
};

const elements = {
  subtitle: document.getElementById("subtitle"),
  statusText: document.getElementById("statusText"),
  generatedAt: document.getElementById("generatedAt"),
  postCount: document.getElementById("postCount"),
  visibilityCount: document.getElementById("visibilityCount"),
  errorBox: document.getElementById("errorBox"),
  refreshStatus: document.getElementById("refreshStatus"),
  refreshButton: document.getElementById("refreshButton"),
  postsList: document.getElementById("postsList"),
  prevDateButton: document.getElementById("prevDateButton"),
  nextDateButton: document.getElementById("nextDateButton"),
  datePicker: document.getElementById("datePicker"),
  dateLabel: document.getElementById("dateLabel"),
  dateCount: document.getElementById("dateCount"),
  filterButtons: Array.from(document.querySelectorAll("[data-filter]")),
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

function loadFavoriteIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function saveFavoriteIds() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(state.favoriteIds)));
  } catch {
    // Favorites are local convenience state; ignore storage failures.
  }
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
  const publishedAt = firstText(post?.published_at, post?.created_at);
  const url = firstText(post?.url, post?.source_url);
  const summary = firstText(post?.summary_cn, post?.summary);
  const id = firstText(post?.post_id, post?.id, url, `${publishedAt}|${summary}`, "unknown");
  const mentionedTickers = asArray(post?.mentioned_tickers || post?.tickers)
    .map(normalizeTicker)
    .filter(Boolean);
  return {
    id,
    favoriteKey: id,
    url,
    publishedAt,
    createdAt: firstText(post?.published_at, post?.created_at, post?.collected_at_utc),
    visibility,
    isSubscriberOnly: visibility === "subscriber_only",
    summary,
    keyPoints: asArray(post?.key_points),
    mentionedTickers,
  };
}

function visibilityLabel(post) {
  return post.isSubscriberOnly ? "sub" : "public";
}

function visibilitySummary(posts) {
  const subCount = posts.filter((post) => post.isSubscriberOnly).length;
  const publicCount = posts.length - subCount;
  return `${publicCount} public / ${subCount} sub`;
}

function isFavorite(post) {
  return state.favoriteIds.has(post.favoriteKey);
}

function favoriteSummary(posts) {
  return posts.filter(isFavorite).length;
}

function filteredPostsForActiveFilter(posts) {
  if (state.activeFilter === "public") return posts.filter((post) => !post.isSubscriberOnly);
  if (state.activeFilter === "sub") return posts.filter((post) => post.isSubscriberOnly);
  if (state.activeFilter === "favorites") return posts.filter(isFavorite);
  return posts;
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

function currentViewPosts(allPosts) {
  return filteredPostsForActiveFilter(allPosts);
}

function ensureSelectedDateInView(viewPosts) {
  const dates = availablePostDates(viewPosts);
  if (!dates.length) return;
  if (!dates.includes(state.selectedDate)) {
    state.selectedDate = dates[dates.length - 1];
  }
}

function badge(label, className = "") {
  return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
}

function filterCountFor(datePosts, filter) {
  if (filter === "public") return datePosts.filter((post) => !post.isSubscriberOnly).length;
  if (filter === "sub") return datePosts.filter((post) => post.isSubscriberOnly).length;
  if (filter === "favorites") return favoriteSummary(datePosts);
  return datePosts.length;
}

function renderDateControls(allPosts, filteredPosts) {
  const dates = availablePostDates(allPosts);
  const today = localDateKey(new Date());
  const minDate = dates[0] || today;
  elements.datePicker.value = state.selectedDate;
  elements.datePicker.min = minDate;
  elements.datePicker.max = today;
  elements.dateLabel.textContent = formatDateLabel(state.selectedDate);
  elements.dateCount.textContent = `${filteredPosts.length} posts · ${visibilitySummary(filteredPosts)}`;
  elements.prevDateButton.disabled = state.selectedDate <= minDate;
  elements.nextDateButton.disabled = state.selectedDate >= today;
}

function renderFilterControls(datePosts) {
  for (const button of elements.filterButtons) {
    const filter = button.dataset.filter || "all";
    button.classList.toggle("is-active", filter === state.activeFilter);
    button.textContent = `${FILTER_LABELS[filter] || filter} ${filterCountFor(datePosts, filter)}`;
  }
}

function renderPostCard(post) {
  const timeLabel = post.publishedAt
    ? `Published ${formatDate(post.publishedAt)}`
    : "Published time unknown";
  const tickerLine = post.mentionedTickers.length
    ? `<div class="ticker-line">${escapeHtml(post.mentionedTickers.map((item) => `$${item}`).join(" "))}</div>`
    : "";
  const favorite = isFavorite(post);
  return `
    <article class="post-card ${post.isSubscriberOnly ? "is-subscriber-only" : "is-public"}">
      <div class="card-topline">
        <span>${escapeHtml(timeLabel)}</span>
        <div class="card-actions">
          ${badge(visibilityLabel(post), post.isSubscriberOnly ? "visibility-private" : "visibility-public")}
          <button
            class="favorite-button ${favorite ? "is-favorite" : ""}"
            type="button"
            data-favorite-id="${escapeHtml(post.favoriteKey)}"
            aria-pressed="${favorite ? "true" : "false"}"
          >${favorite ? "Saved" : "Save"}</button>
        </div>
      </div>
      <h3>${escapeHtml(post.summary || "No summary yet")}</h3>
      ${post.keyPoints.length ? `<ul class="point-list">${post.keyPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      <div class="meta-row">
        ${tickerLine}
        ${post.url ? `<a href="${escapeHtml(post.url)}" target="_blank" rel="noreferrer">Open source</a>` : ""}
      </div>
    </article>
  `;
}

function renderPostGroup(title, posts) {
  if (!posts.length) return "";
  return `
    <section class="post-group" aria-label="${escapeHtml(title)}">
      <div class="post-group-heading">
        <h3>${escapeHtml(title)}</h3>
        <span>${posts.length} posts</span>
      </div>
      <div class="post-group-list">
        ${posts.map(renderPostCard).join("")}
      </div>
    </section>
  `;
}

function renderPosts(posts, selectedDate) {
  if (!posts.length) {
    const filterLabel = FILTER_LABELS[state.activeFilter] || state.activeFilter;
    elements.postsList.innerHTML = `<div class="empty-state">No ${escapeHtml(filterLabel.toLowerCase())} posts found for ${escapeHtml(formatDateLabel(selectedDate))}.</div>`;
    return;
  }
  const subscriberPosts = posts.filter((post) => post.isSubscriberOnly);
  const publicPosts = posts.filter((post) => !post.isSubscriberOnly);
  elements.postsList.innerHTML = [
    renderPostGroup("Subscriber-only", subscriberPosts),
    renderPostGroup("Public", publicPosts),
  ].join("");
}

function renderAll() {
  const data = state.data || {};
  const allPosts = getPosts(data);
  const viewPosts = currentViewPosts(allPosts);
  ensureSelectedDateInView(viewPosts);
  const posts = viewPosts.filter((post) => postDateKey(post) === state.selectedDate);
  const publishedTimes = posts
    .map((post) => formatDate(post.publishedAt))
    .filter((value) => value !== "-")
    .slice(0, 3)
    .join(" - ");
  elements.subtitle.textContent = `@${firstText(data.account, "aleabitoreddit")} latest posts${publishedTimes ? ` - ${publishedTimes}` : ""}`;
  elements.statusText.textContent = state.error ? "Error" : "Ready";
  elements.generatedAt.textContent = formatDate(data.generated_at || data.updated_at);
  elements.postCount.textContent = String(posts.length);
  elements.visibilityCount.textContent = visibilitySummary(posts);
  elements.errorBox.hidden = !state.error;
  elements.errorBox.textContent = state.error || "";
  renderFilterControls(allPosts);
  renderDateControls(viewPosts, posts);
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
  setRefreshStatus("Checking X for new posts from the last 24 hours. Keep the local server, Edge profile, and Ollama available.", "info");
  const body = {
    account: "aleabitoreddit",
    max_items: 200,
    window_hours: 24,
    publish: true,
    use_llm: true,
    publish_only_on_new: true,
    reuse_analysis_cache: true,
    reanalyze_fallback_cache: true,
    fail_on_new_fallback: true,
    fail_on_incomplete_subscriber: true,
    ensure_visible_edge: true,
    remove_local_site_payload_after_publish: true,
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
          setRefreshStatus("Refresh complete. No new posts found in the last 24 hours; publish was skipped.", "success");
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
for (const button of elements.filterButtons) {
  button.addEventListener("click", () => {
    state.activeFilter = button.dataset.filter || "all";
    renderAll();
  });
}
elements.postsList.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const button = target?.closest("[data-favorite-id]");
  if (!button) return;
  const id = button.dataset.favoriteId;
  if (!id) return;
  if (state.favoriteIds.has(id)) {
    state.favoriteIds.delete(id);
  } else {
    state.favoriteIds.add(id);
  }
  saveFavoriteIds();
  renderAll();
});

loadData();
