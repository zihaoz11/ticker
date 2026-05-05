const GITHUB_DATA_URL = "https://zihaoz11.github.io/ticker/data/site/x-analysis/latest.json";
const STATIC_DATA_URL = "../../data/site/x-analysis/latest.json";
const FAVORITES_STORAGE_KEY = "x-analysis-favorite-posts-v1";
const AUTHOR_STORAGE_KEY = "x-analysis-active-author-v1";
const TEAR_LAYER_STORAGE_KEY = "x-analysis-tear-layer-v1";
const FILTER_LABELS = {
  all: "All",
  public: "Public",
  sub: "Sub",
  favorites: "Favorites",
};

function getDataUrl() {
  if (window.location.protocol === "http:" && ["127.0.0.1", "localhost"].includes(window.location.hostname)) {
    return `${window.location.origin}/api/x-analysis/latest`;
  }
  return window.location.pathname.startsWith("/x-analysis/")
    ? GITHUB_DATA_URL
    : STATIC_DATA_URL;
}

function getRunApiCandidates(path = "/api/x-analysis/run") {
  const candidates = [];
  if (window.location.protocol === "http:" && ["127.0.0.1", "localhost"].includes(window.location.hostname)) {
    candidates.push(`${window.location.origin}${path}`);
  }
  candidates.push(`http://127.0.0.1:4174${path}`);
  candidates.push(`http://127.0.0.1:4173${path}`);
  return Array.from(new Set(candidates));
}

const state = {
  data: null,
  error: null,
  selectedDate: localDateKey(new Date()),
  activeAuthor: loadStoredValue(AUTHOR_STORAGE_KEY, "serenity"),
  activeTearLayer: loadStoredValue(TEAR_LAYER_STORAGE_KEY, ""),
  activeFilter: "all",
  activeTab: "posts",
  favoriteIds: loadFavoriteIds(),
};

const elements = {
  subtitle: document.getElementById("subtitle"),
  statusText: document.getElementById("statusText"),
  generatedAt: document.getElementById("generatedAt"),
  primaryMetricLabel: document.getElementById("primaryMetricLabel"),
  postCount: document.getElementById("postCount"),
  secondaryMetricLabel: document.getElementById("secondaryMetricLabel"),
  visibilityCount: document.getElementById("visibilityCount"),
  errorBox: document.getElementById("errorBox"),
  refreshStatus: document.getElementById("refreshStatus"),
  refreshButton: document.getElementById("refreshButton"),
  authorTabs: document.getElementById("authorTabs"),
  serenityTabs: document.getElementById("serenityTabs"),
  postsList: document.getElementById("postsList"),
  prevDateButton: document.getElementById("prevDateButton"),
  nextDateButton: document.getElementById("nextDateButton"),
  datePicker: document.getElementById("datePicker"),
  dateLabel: document.getElementById("dateLabel"),
  dateCount: document.getElementById("dateCount"),
  filterButtons: Array.from(document.querySelectorAll("[data-filter]")),
  tabButtons: Array.from(document.querySelectorAll("[data-tab]")),
  postsPanel: document.getElementById("postsPanel"),
  reportPanel: document.getElementById("reportPanel"),
  tearPanel: document.getElementById("tearPanel"),
  postPanelSummary: document.getElementById("postPanelSummary"),
  reportPanelSummary: document.getElementById("reportPanelSummary"),
  dailyReport: document.getElementById("dailyReport"),
  tearPanelSummary: document.getElementById("tearPanelSummary"),
  tearLayerTabs: document.getElementById("tearLayerTabs"),
  tearEntriesList: document.getElementById("tearEntriesList"),
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

function loadStoredValue(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function saveStoredValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Local UI preference only.
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
  return key === localDateKey(new Date()) ? `Today - ${label}` : label;
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

function getAuthors(data) {
  const authors = asArray(data?.authors)
    .filter((author) => author && typeof author === "object")
    .map((author) => ({
      ...author,
      id: firstText(author.id, "serenity"),
      displayName: firstText(author.display_name, author.name, author.id, "Serenity"),
    }));
  if (!authors.find((author) => author.id === "serenity")) {
    authors.unshift({
      id: "serenity",
      displayName: "Serenity",
      kind: "x",
      content_layers: [
        { id: "posts", title: "Posts", entry_count: asArray(data?.posts).length },
        { id: "daily_report", title: "Daily Report", entry_count: data?.daily_report ? 1 : 0 },
      ],
    });
  }
  if (!authors.find((author) => author.id === "tear")) {
    authors.push({
      id: "tear",
      displayName: "tear",
      kind: "gmail",
      content_layers: [],
      entries: [],
    });
  }
  return authors;
}

function activeAuthor(data) {
  const authors = getAuthors(data);
  return authors.find((author) => author.id === state.activeAuthor) || authors[0];
}

function isTearAuthor(author) {
  return author?.id === "tear";
}

function getTearEntries(author) {
  return asArray(author?.entries)
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id: firstText(entry.entry_id, entry.source_id, `${entry.content_date}|${entry.subject}`),
      subject: firstText(entry.subject),
      contentDate: firstText(entry.content_date, entry.email_ts),
      emailTs: firstText(entry.email_ts),
      layerId: firstText(entry.content_layer_id, "tear-email"),
      layerTitle: firstText(entry.content_layer_title, "tear email"),
      summary: firstText(entry.summary_cn),
      keyPoints: asArray(entry.key_points).map(String).filter(Boolean),
      themes: asArray(entry.themes).map(String).filter(Boolean),
      mentionedTickers: asArray(entry.mentioned_tickers).map(normalizeTicker).filter(Boolean),
      stockViews: asArray(entry.stock_views)
        .filter((view) => view && typeof view === "object")
        .map((view) => ({
          ticker: normalizeTicker(view.ticker),
          stance: firstText(view.stance, "unclear"),
          confidence: Number(view.confidence || 0),
          reason: firstText(view.reason_cn),
        }))
        .filter((view) => view.ticker),
      fallbackUsed: Boolean(entry.fallback_used),
    }))
    .sort((a, b) => String(b.contentDate || b.emailTs).localeCompare(String(a.contentDate || a.emailTs)));
}

function getTearLayers(author, entries) {
  const layers = asArray(author?.content_layers)
    .filter((layer) => layer && typeof layer === "object")
    .map((layer) => ({
      id: firstText(layer.id, "tear-email"),
      title: firstText(layer.title, layer.id, "tear email"),
      entryCount: Number(layer.entry_count || 0),
      latestDate: firstText(layer.latest_date),
    }));
  if (layers.length) return layers;
  const buckets = new Map();
  for (const entry of entries) {
    const current = buckets.get(entry.layerId) || {
      id: entry.layerId,
      title: entry.layerTitle,
      entryCount: 0,
      latestDate: "",
    };
    current.entryCount += 1;
    if (entry.contentDate > current.latestDate) current.latestDate = entry.contentDate;
    buckets.set(entry.layerId, current);
  }
  return Array.from(buckets.values()).sort((a, b) => String(b.latestDate).localeCompare(String(a.latestDate)));
}

function getOutsideCandidates(report) {
  return asArray(report?.outside_candidates)
    .map((item, index) => ({
      rank: Number(item?.rank || index + 1),
      ticker: normalizeTicker(item?.ticker),
      company: firstText(item?.company),
      score: Number(item?.score || 0),
      confidence: Number(item?.confidence || 0),
      chainRole: firstText(item?.chain_role, "产业链关键节点"),
      importance: firstText(item?.importance_cn),
      boundaryExpansion: firstText(item?.boundary_expansion_cn),
      triggerLogic: firstText(item?.trigger_logic_cn),
      outsideReason: firstText(item?.outside_reason_cn),
      anchorTickers: asArray(item?.anchor_tickers).map(normalizeTicker).filter(Boolean),
      anchorSourcePostIds: asArray(item?.anchor_source_post_ids).map(String).filter(Boolean),
      triggerKeywords: asArray(item?.trigger_keywords).map(String).filter(Boolean),
      triggerSignals: asArray(item?.trigger_signals).map(String).filter(Boolean),
      sourcePostIds: asArray(item?.source_post_ids).map(String).filter(Boolean),
      riskNotes: asArray(item?.risk_notes).map(String).filter(Boolean),
      externalEvidence: normalizeExternalEvidence(item?.external_evidence),
      researchReport: normalizeCandidateResearchReport(item?.research_report_cn),
    }))
    .filter((item) => item.ticker)
    .sort((a, b) => a.rank - b.rank || b.score - a.score);
}

function normalizeExternalEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") {
    return { items: [], warnings: [] };
  }
  return {
    items: asArray(evidence.items).map((item) => ({
      category: firstText(item?.category),
      source: firstText(item?.source),
      title: firstText(item?.title),
      date: firstText(item?.date),
      url: firstText(item?.url),
      summary: firstText(item?.summary),
      evidenceType: firstText(item?.evidence_type_cn),
      reliability: firstText(item?.reliability),
    })).filter((item) => item.title || item.summary),
    warnings: asArray(evidence.warnings).map(String).filter(Boolean),
  };
}

function normalizeCandidateResearchReport(report) {
  if (!report || typeof report !== "object") {
    return { title: "", thesis: "", sourcePostIds: [], sections: [] };
  }
  return {
    title: firstText(report.title_cn),
    thesis: firstText(report.one_line_thesis_cn),
    sourcePostIds: asArray(report.source_post_ids).map(String).filter(Boolean),
    sections: asArray(report.sections).map((section) => ({
      heading: firstText(section?.heading_cn),
      items: asArray(section?.items_cn).map(String).filter(Boolean),
    })).filter((section) => section.heading || section.items.length),
  };
}

function renderExternalEvidence(evidence) {
  if (!evidence.items.length && !evidence.warnings.length) return "";
  return `
    <section class="external-evidence-panel">
      <div class="research-report-heading">
        <span class="summary-label">External evidence</span>
        <h4>SEC / policy / order evidence</h4>
      </div>
      ${evidence.items.length ? `
        <div class="evidence-list">
          ${evidence.items.slice(0, 8).map((item) => `
            <article class="evidence-item">
              <div class="evidence-item-topline">
                <span>${escapeHtml(item.evidenceType || item.category || "evidence")}</span>
                <span>${escapeHtml([item.source, item.date].filter(Boolean).join(" · ") || "-")}</span>
              </div>
              <h5>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title || item.url)}</a>` : escapeHtml(item.title || "-")}</h5>
              ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ""}
            </article>
          `).join("")}
        </div>
      ` : `<div class="small-text">No external evidence captured in this refresh.</div>`}
      ${evidence.warnings.length ? `<ul class="point-list">${evidence.warnings.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    </section>
  `;
}

function percentLabel(value) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function availablePostDates(posts) {
  return Array.from(new Set(posts.map(postDateKey).filter(Boolean))).sort();
}

function nearestAvailableDate(dates, selectedDate) {
  if (!dates.length) return selectedDate;
  if (dates.includes(selectedDate)) return selectedDate;
  const previous = dates.filter((date) => date <= selectedDate).pop();
  return previous || dates[0];
}

function currentViewPosts(allPosts) {
  return filteredPostsForActiveFilter(allPosts);
}

function ensureSelectedDateInView(viewPosts) {
  const dates = availablePostDates(viewPosts);
  if (!dates.length) return;
  state.selectedDate = nearestAvailableDate(dates, state.selectedDate);
}

function adjacentAvailableDate(direction) {
  const allPosts = getPosts(state.data || {});
  const dates = availablePostDates(currentViewPosts(allPosts));
  if (!dates.length) return state.selectedDate;
  const currentDate = nearestAvailableDate(dates, state.selectedDate);
  const index = dates.indexOf(currentDate);
  const nextIndex = Math.max(0, Math.min(dates.length - 1, index + direction));
  return dates[nextIndex] || currentDate;
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
  const maxDate = dates[dates.length - 1] || today;
  const selectedIndex = dates.indexOf(state.selectedDate);
  elements.datePicker.value = state.selectedDate;
  elements.datePicker.min = minDate;
  elements.datePicker.max = maxDate;
  elements.dateLabel.textContent = formatDateLabel(state.selectedDate);
  elements.dateCount.textContent = `${filteredPosts.length} posts - ${visibilitySummary(filteredPosts)}`;
  elements.prevDateButton.disabled = selectedIndex <= 0;
  elements.nextDateButton.disabled = selectedIndex < 0 || selectedIndex >= dates.length - 1;
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

function renderCandidateResearchReport(report) {
  if (!report.title && !report.thesis && !report.sections.length) return "";
  return `
    <section class="candidate-research-report">
      <div class="research-report-heading">
        <span class="summary-label">Research note</span>
        <h4>${escapeHtml(report.title || "产业链边界扩展研报")}</h4>
      </div>
      ${report.thesis ? `<p class="research-thesis">${escapeHtml(report.thesis)}</p>` : ""}
      <div class="research-section-list">
        ${report.sections.map((section) => `
          <section class="research-subsection">
            <h5>${escapeHtml(section.heading || "分析段落")}</h5>
            ${section.items.length ? `<ul class="point-list">${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
          </section>
        `).join("")}
      </div>
      ${report.sourcePostIds.length ? `<div class="small-text">research source posts ${escapeHtml(report.sourcePostIds.slice(0, 6).join(", "))}</div>` : ""}
    </section>
  `;
}

function renderOutsideCandidateCard(candidate) {
  return `
    <article class="candidate-card">
      <div class="stock-header">
        <div>
          <span class="summary-label">#${escapeHtml(candidate.rank)} outside post</span>
          <h3>$${escapeHtml(candidate.ticker)} ${escapeHtml(candidate.company)}</h3>
        </div>
        <div class="score-pill">${escapeHtml(candidate.score.toFixed(0))}</div>
      </div>
      <div class="badge-row">
        ${badge(candidate.chainRole, "theme-badge")}
        ${badge(`confidence ${percentLabel(candidate.confidence)}`)}
      </div>
      ${candidate.anchorTickers.length ? `<div class="small-text">source anchors ${escapeHtml(candidate.anchorTickers.map((item) => `$${item}`).join(" "))}</div>` : ""}
      <div class="reason-list">
        <div class="stance-reason">
          <span class="summary-label">Why this node matters</span>
          <p>${escapeHtml(candidate.importance || "-")}</p>
        </div>
        <div class="stance-reason">
          <span class="summary-label">Boundary expansion path</span>
          <p>${escapeHtml(candidate.boundaryExpansion || "-")}</p>
        </div>
        <div class="stance-reason">
          <span class="summary-label">Blogger logic imitation</span>
          <p>${escapeHtml(candidate.triggerLogic || "-")}</p>
        </div>
        <div class="stance-reason">
          <span class="summary-label">Outside-post guard</span>
          <p>${escapeHtml(candidate.outsideReason || "-")}</p>
        </div>
      </div>
      ${renderExternalEvidence(candidate.externalEvidence)}
      ${renderCandidateResearchReport(candidate.researchReport)}
      ${candidate.triggerSignals.length ? `<div class="badge-row">${candidate.triggerSignals.map((item) => badge(item)).join("")}</div>` : ""}
      ${candidate.triggerKeywords.length ? `<div class="small-text">keywords ${escapeHtml(candidate.triggerKeywords.slice(0, 8).join(", "))}</div>` : ""}
      <div class="small-text">anchor source posts ${escapeHtml(candidate.anchorSourcePostIds.slice(0, 6).join(", ") || "-")}</div>
      <div class="small-text">logic source posts ${escapeHtml(candidate.sourcePostIds.slice(0, 6).join(", ") || "-")}</div>
      ${candidate.riskNotes.length ? `<ul class="point-list">${candidate.riskNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    </article>
  `;
}

function renderDailyReport(data) {
  const report = data?.daily_report || {};
  const sections = asArray(report.sections);
  const outsideCandidates = getOutsideCandidates(report);
  elements.reportPanelSummary.textContent = firstText(report.date, "-");
  if (!report.title_cn && !sections.length) {
    elements.dailyReport.innerHTML = `<div class="empty-state">No daily report in the current payload.</div>`;
    return;
  }
  elements.dailyReport.innerHTML = `
    <section class="report-header">
      <h3>${escapeHtml(firstText(report.title_cn, "Daily Report"))}</h3>
      <p>${escapeHtml(firstText(report.summary_cn, ""))}</p>
    </section>
    ${outsideCandidates.length ? `
      <section class="report-section">
        <h3>Outside-Post Boundary Expansion Candidates</h3>
        <div class="candidate-list">
          ${outsideCandidates.map(renderOutsideCandidateCard).join("")}
        </div>
      </section>
    ` : ""}
    ${sections.map((section) => `
      <section class="report-section">
        <h3>${escapeHtml(firstText(section.heading_cn, "Section"))}</h3>
        <ul class="point-list">
          ${asArray(section.items_cn).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>
    `).join("")}
  `;
}

function renderAuthorControls(authors) {
  elements.authorTabs.innerHTML = authors.map((author) => `
    <button
      class="author-button ${author.id === state.activeAuthor ? "is-active" : ""}"
      type="button"
      data-author="${escapeHtml(author.id)}"
    >${escapeHtml(author.displayName)}</button>
  `).join("");
}

function renderTearLayerTabs(layers) {
  elements.tearLayerTabs.hidden = !layers.length;
  elements.tearLayerTabs.innerHTML = layers.map((layer) => `
    <button
      class="content-tab-button ${layer.id === state.activeTearLayer ? "is-active" : ""}"
      type="button"
      data-tear-layer="${escapeHtml(layer.id)}"
    >
      <span>${escapeHtml(layer.title)}</span>
      <strong>${escapeHtml(layer.entryCount)}</strong>
    </button>
  `).join("");
}

function renderTearStockViews(views) {
  if (!views.length) return "";
  return `
    <div class="tear-stock-view-list">
      ${views.slice(0, 12).map((view) => `
        <div class="tear-stock-view">
          <span class="ticker-chip">$${escapeHtml(view.ticker)}</span>
          <span>${escapeHtml(view.stance)}</span>
          ${view.reason ? `<p>${escapeHtml(view.reason)}</p>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function renderTearEntryCard(entry) {
  const tickerLine = entry.mentionedTickers.length
    ? `<div class="ticker-line">${escapeHtml(entry.mentionedTickers.slice(0, 30).map((item) => `$${item}`).join(" "))}</div>`
    : "";
  return `
    <article class="post-card tear-card">
      <div class="card-topline">
        <span>${escapeHtml(entry.contentDate || "-")}</span>
        <div class="card-actions">
          ${entry.fallbackUsed ? badge("needs LLM", "visibility-private") : badge("summary", "visibility-public")}
        </div>
      </div>
      <h3>${escapeHtml(entry.subject || entry.layerTitle || "tear email")}</h3>
      ${entry.summary ? `<p class="tear-summary">${escapeHtml(entry.summary)}</p>` : ""}
      ${entry.keyPoints.length ? `<ul class="point-list">${entry.keyPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${renderTearStockViews(entry.stockViews)}
      <div class="meta-row">
        ${tickerLine}
        ${entry.themes.length ? `<span>${escapeHtml(entry.themes.slice(0, 6).join(" / "))}</span>` : ""}
      </div>
    </article>
  `;
}

function renderTearAuthor(author) {
  const entries = getTearEntries(author);
  const layers = getTearLayers(author, entries);
  if (!layers.find((layer) => layer.id === state.activeTearLayer)) {
    state.activeTearLayer = layers[0]?.id || "";
    saveStoredValue(TEAR_LAYER_STORAGE_KEY, state.activeTearLayer);
  }
  const layerEntries = state.activeTearLayer
    ? entries.filter((entry) => entry.layerId === state.activeTearLayer)
    : entries;
  const currentLayer = layers.find((layer) => layer.id === state.activeTearLayer);
  elements.subtitle.textContent = `${author.displayName} email summaries${currentLayer ? ` - ${currentLayer.title}` : ""}`;
  elements.statusText.textContent = state.error ? "Error" : "Ready";
  elements.generatedAt.textContent = formatDate(author.updated_at);
  elements.primaryMetricLabel.textContent = "Entries";
  elements.secondaryMetricLabel.textContent = "Layers";
  elements.postCount.textContent = String(layerEntries.length);
  elements.visibilityCount.textContent = `${layers.length} layers`;
  elements.postPanelSummary.textContent = "-";
  elements.reportPanelSummary.textContent = "-";
  elements.tearPanelSummary.textContent = `${entries.length} total entries`;
  renderTearLayerTabs(layers);
  elements.tearEntriesList.innerHTML = layerEntries.length
    ? layerEntries.map(renderTearEntryCard).join("")
    : `<div class="empty-state">No tear email summaries yet. Run Refresh tear after Gmail OAuth is configured.</div>`;
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

function renderTabs(author) {
  if (state.activeTab === "gems") state.activeTab = "report";
  const tearActive = isTearAuthor(author);
  elements.serenityTabs.hidden = tearActive;
  for (const button of elements.tabButtons) {
    const tab = button.dataset.tab || "posts";
    button.classList.toggle("is-active", tab === state.activeTab);
  }
  elements.postsPanel.hidden = tearActive || state.activeTab !== "posts";
  elements.reportPanel.hidden = tearActive || state.activeTab !== "report";
  elements.tearPanel.hidden = !tearActive;
  elements.refreshButton.textContent = tearActive
    ? "Refresh tear"
    : state.activeTab === "posts" ? "Refresh Posts" : "Refresh Learning";
}

function renderAll() {
  const data = state.data || {};
  const authors = getAuthors(data);
  const author = activeAuthor(data);
  if (author?.id && author.id !== state.activeAuthor) {
    state.activeAuthor = author.id;
    saveStoredValue(AUTHOR_STORAGE_KEY, state.activeAuthor);
  }
  renderAuthorControls(authors);
  if (isTearAuthor(author)) {
    elements.errorBox.hidden = !state.error;
    elements.errorBox.textContent = state.error || "";
    renderTearAuthor(author);
    renderTabs(author);
    return;
  }
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
  elements.primaryMetricLabel.textContent = "Posts";
  elements.secondaryMetricLabel.textContent = "Visibility";
  elements.postCount.textContent = String(posts.length);
  elements.visibilityCount.textContent = visibilitySummary(posts);
  elements.errorBox.hidden = !state.error;
  elements.errorBox.textContent = state.error || "";
  elements.postPanelSummary.textContent = `${allPosts.length} total posts`;
  renderFilterControls(allPosts);
  renderDateControls(viewPosts, posts);
  renderPosts(posts, state.selectedDate);
  renderDailyReport(data);
  renderTabs(author);
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
  if (isTearAuthor(activeAuthor(state.data || {}))) {
    await runTearRefresh();
    return;
  }
  if (state.activeTab === "report") {
    await runLearningRefresh();
    return;
  }
  await runPostsRefresh();
}

async function runPostsRefresh() {
  elements.refreshButton.disabled = true;
  elements.refreshButton.textContent = "Refreshing Posts...";
  setRefreshStatus("Posts refresh: checking X for new posts from the last 24 hours. Keep the local server, Edge profile, and Ollama available.", "info");
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
    for (const url of getRunApiCandidates("/api/x-analysis/run")) {
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
          setRefreshStatus(`Posts refresh complete. ${newCount} new post(s) published to GitHub; daily report was rebuilt from preserved history.`, "success");
        } else {
          setRefreshStatus("Posts refresh complete. No new posts found in the last 24 hours; publish was skipped.", "success");
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
      `Posts refresh failed. Open the local dashboard first with start_x_analysis.cmd, then use http://127.0.0.1:4174/x-analysis/. Detail: ${detail}`,
      "error",
    );
  } finally {
    elements.refreshButton.disabled = false;
    renderAll();
  }
}

async function runLearningRefresh() {
  elements.refreshButton.disabled = true;
  elements.refreshButton.textContent = "Refreshing Learning...";
  const label = "Daily Report";
  setRefreshStatus(`${label} refresh: rebuilding the research lens and outside-post boundary expansion candidates from existing post history. X will not be fetched.`, "info");
  const body = {
    account: "aleabitoreddit",
    publish: true,
    remove_local_site_payload_after_publish: true,
  };
  let lastError = "";
  try {
    for (const url of getRunApiCandidates("/api/x-analysis/refresh-learning")) {
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
        const candidateCount = Number(payload.daily_candidate_count || state.data?.daily_report?.outside_candidates?.length || 0);
        const postCount = Number(payload.source_post_count || state.data?.posts?.length || 0);
        setRefreshStatus(`${label} refresh complete. Rebuilt ${candidateCount} outside-post boundary candidate(s) from ${postCount} preserved post(s).`, "success");
        renderAll();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    throw new Error(lastError || "Local learning refresh API is unavailable.");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    setRefreshStatus(
      `${label} refresh failed. Open the local dashboard first with start_x_analysis.cmd, then use http://127.0.0.1:4174/x-analysis/. Detail: ${detail}`,
      "error",
    );
  } finally {
    elements.refreshButton.disabled = false;
    renderAll();
  }
}

async function runTearRefresh() {
  elements.refreshButton.disabled = true;
  elements.refreshButton.textContent = "Refreshing tear...";
  setRefreshStatus("tear refresh: reading recent Gmail newsletters, generating Chinese summaries, and publishing public summaries only.", "info");
  const body = {
    query: "from:tear@tradingedge.club newer_than:60d",
    max_results: 200,
    publish: true,
    use_llm: true,
    remove_local_site_payload_after_publish: true,
  };
  let lastError = "";
  try {
    for (const url of getRunApiCandidates("/api/x-analysis/refresh-tear")) {
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
        const newCount = Number(payload.new_entry_count || 0);
        const totalCount = Number(payload.entry_count || 0);
        setRefreshStatus(`tear refresh complete. ${newCount} new email summar${newCount === 1 ? "y" : "ies"}; ${totalCount} total.`, "success");
        renderAll();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    throw new Error(lastError || "Local tear refresh API is unavailable.");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    setRefreshStatus(
      `tear refresh failed. Check Gmail OAuth credentials, then use http://127.0.0.1:4174/x-analysis/. Detail: ${detail}`,
      "error",
    );
  } finally {
    elements.refreshButton.disabled = false;
    renderAll();
  }
}

elements.prevDateButton.addEventListener("click", () => setSelectedDate(adjacentAvailableDate(-1)));
elements.nextDateButton.addEventListener("click", () => setSelectedDate(adjacentAvailableDate(1)));
elements.datePicker.addEventListener("change", () => setSelectedDate(elements.datePicker.value));
elements.refreshButton.addEventListener("click", runManualRefresh);
elements.authorTabs.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const button = target?.closest("[data-author]");
  if (!button) return;
  state.activeAuthor = button.dataset.author || "serenity";
  saveStoredValue(AUTHOR_STORAGE_KEY, state.activeAuthor);
  renderAll();
});
elements.tearLayerTabs.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const button = target?.closest("[data-tear-layer]");
  if (!button) return;
  state.activeTearLayer = button.dataset.tearLayer || "";
  saveStoredValue(TEAR_LAYER_STORAGE_KEY, state.activeTearLayer);
  renderAll();
});
for (const button of elements.tabButtons) {
  button.addEventListener("click", () => {
    state.activeTab = button.dataset.tab || "posts";
    renderAll();
  });
}
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
