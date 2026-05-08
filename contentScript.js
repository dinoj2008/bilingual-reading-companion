// contentScript.js

// 每批最多翻译多少个正文块（整页翻译用）
const MAX_BLOCKS_PER_BATCH = 20;
// 只翻译“够长”的正文，避免菜单 / 按钮之类的短语
const MIN_TEXT_LENGTH = 20;

const processedBlocks = new WeakSet();

const DEFAULT_UI_SETTINGS = {
  selectionPopupFontSize: 15,
  floatingBallEnabled: true,
  floatingBallPosition: "right",
  floatingBallOpacity: 82,
  floatingBallHoverOnly: false
};

const SELECTION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SELECTION_CACHE_MAX = 80;
const PROMPT_PROFILE_ORDER = ["news", "general", "literary", "academic"];

const selectionTranslationCache = new Map();

let uiSettings = { ...DEFAULT_UI_SETTINGS };
let isPageTranslating = false;
let pageTranslationHud = null;
let bilingualStylesInjected = false;
let bilingualTranslationsHidden = false;
let selectionButton = null;           // 选区悬浮“译”按钮
let selectionPopupHideTimer = null;   // 翻译弹窗自动隐藏计时器
let selectionPopup = null;            // 当前弹窗 DOM
let selectionPopupPinned = false;     // 是否已固定到右下角
let selectionPopupDocClickHandler = null; // 点击页面关闭弹窗的监听器引用
let floatingRoot = null;
let floatingPanel = null;
let floatingPanelDocClickHandler = null;

function log(...args) {
  console.log("[BilingualExt CS]", ...args);
}

log("contentScript loaded");

function loadUiSettings() {
  chrome.storage.local.get({ ui: null }, (items) => {
    uiSettings = {
      ...DEFAULT_UI_SETTINGS,
      ...(items.ui || {})
    };
    syncFloatingBall();
  });
}

loadUiSettings();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.ui) {
    uiSettings = {
      ...DEFAULT_UI_SETTINGS,
      ...(changes.ui.newValue || {})
    };
    syncFloatingBall();
  }
});

// ========== 工具函数 ==========

function isInNonContentAreaElement(el) {
  let cur = el;
  let depth = 0;

  const EXCLUDED_TAGS = ["NAV", "HEADER", "FOOTER", "ASIDE", "FORM"];
  const EXCLUDED_KEYWORDS = [
    "nav", "menu", "header", "footer", "sidebar",
    "comment", "comments", "reply",
    "ad", "ads", "advert", "sponsor", "promo",
    "breadcrumb",
    "subscribe", "signup", "newsletter",
    "related", "recommend", "recomend",
    "share", "social",
    "cookie", "banner", "popup", "modal",
    "toolbar", "topbar", "pagination", "pager",
    "author", "bio", "profile", "metadata", "info", // 新增：作者、简介等
    "copyright", "disclaimer"
  ];

  while (cur && depth < 10) {
    if (cur.tagName === "ARTICLE" || cur.tagName === "MAIN" || cur.getAttribute("role") === "main") {
      return false;
    }

    const tag = cur.tagName;
    if (EXCLUDED_TAGS.includes(tag)) {
      return true;
    }

    const cls = (cur.className || "").toString().toLowerCase();
    const id = (cur.id || "").toString().toLowerCase();
    const combined = cls + " " + id;

    if (EXCLUDED_KEYWORDS.some(kw => combined.includes(kw))) {
      return true;
    }

    cur = cur.parentElement;
    depth++;
  }

  return false;
}

// 尝试找到页面的“主要内容”区域，缩小搜索范围
function findMainContentRoot() {
  // 1. 常见的语义标签
  const semanticMain = document.querySelector("main, article, [role='main']");
  if (semanticMain) {
    log("Found semantic main content:", semanticMain);
    return semanticMain;
  }

  // 2. 常见的 ID/Class 命名
  const commonSelectors = [
    "#content", ".content", "#main", ".main",
    ".post-content", ".article-body", ".entry-content",
    "#article", ".article"
  ];

  for (const sel of commonSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      log("Found main content by selector:", sel);
      return el;
    }
  }

  // 3. 找不到就回退到 body
  log("No main content wrapper found, using body.");
  return document.body;
}

function shouldTranslateBlock(el, isStrict = false, options = {}) {
  if (!el) return false;

  // 1. 忽略不可见元素
  if (el.offsetParent === null) return false;

  // 2. 忽略过窄的元素 (侧边栏、作者简介框通常很窄)
  // 提高阈值到 320px，过滤掉更多侧边栏
  const minWidth = options.minWidth ?? (isStrict ? 320 : 180);
  if (!options.allowNarrow && el.offsetWidth > 0 && el.offsetWidth < minWidth) {
    return false;
  }

  const text = el.innerText.trim();
  if (!text) return false;

  // 对于普通 div (isStrict=true)，要求更长的文本，避免翻译短按钮/菜单
  const minLen = options.minLength ?? (isStrict ? 50 : MIN_TEXT_LENGTH);
  if (text.length < minLen) return false;

  if (!/[A-Za-z]/.test(text)) return false;
  if (/[\u4e00-\u9fff]/.test(text)) return false;

  if (isInNonContentAreaElement(el)) return false;

  if (el.hasAttribute("data-bilingual-processed")) return false; // Prevent re-translation
  if (el.hasAttribute("data-bilingual-processing")) return false;

  return true;
}

function collectPrimaryBlocks(root) {
  // 优先抓取明确的语义标签
  const selector = [
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "li",
    "[data-testid='ContentHeaderHed']",
    "[data-testid='ContentHeaderDek']",
    "[data-testid='tweetText']",
    "[data-testid='post-title']",
    "[data-testid='post-content']",
    "shreddit-post [slot='title']",
    "shreddit-post [slot='text-body']",
    "shreddit-comment [slot='comment']"
  ].join(", ");
  const allNodes = Array.from(root.querySelectorAll(selector));
  const targets = allNodes.filter(el => {
    if (processedBlocks.has(el)) return false;
    return shouldTranslateBlock(el, false, {
      minLength: isHeadingElement(el) ? 8 : MIN_TEXT_LENGTH,
      minWidth: isHeadingElement(el) ? 80 : 180,
      allowNarrow: isSocialTextElement(el)
    }); // 宽松模式
  });
  return targets;
}

function collectHeadlineBlocks() {
  const selectors = [
    "h1",
    "h2",
    "[data-testid='ContentHeaderHed']",
    "[data-testid='ContentHeaderDek']",
    "[data-testid='article-title']",
    "[data-testid='article-subtitle']",
    "[property='headline']",
    "[class*='headline' i]",
    "[class*='dek' i]",
    "[class*='subtitle' i]"
  ];

  return Array.from(document.querySelectorAll(selectors.join(", ")))
    .filter(el => !processedBlocks.has(el))
    .filter(el => shouldTranslateBlock(el, false, {
      minLength: 8,
      minWidth: 60,
      allowNarrow: true
    }));
}

function collectSocialTextBlocks(root) {
  const selectors = [
    "article [data-testid='tweetText']",
    "article div[lang][dir='auto']",
    "article span[lang]",
    "shreddit-post [slot='title']",
    "shreddit-post [slot='text-body']",
    "shreddit-comment [slot='comment']",
    "[data-testid='post-title']",
    "[data-testid='post-content']",
    "[data-adclicklocation='title']",
    "[data-click-id='text']"
  ];

  return Array.from(root.querySelectorAll(selectors.join(", ")))
    .filter(el => !processedBlocks.has(el))
    .filter(el => !hasCandidateAncestor(el))
    .filter(el => shouldTranslateBlock(el, false, {
      minLength: 6,
      minWidth: 40,
      allowNarrow: true
    }));
}

function collectReadableLeafBlocks(root) {
  const selector = "article div, article section, main div, main section";
  return Array.from(root.querySelectorAll(selector))
    .filter(el => !processedBlocks.has(el))
    .filter(el => !hasCandidateAncestor(el))
    .filter(el => {
      if (el.querySelector("p, h1, h2, h3, h4, h5, h6, blockquote, li, [data-testid='tweetText']")) return false;
      if (el.childElementCount > 8) return false;
      return shouldTranslateBlock(el, true, {
        minLength: 80,
        minWidth: 180
      });
    });
}

function isHeadingElement(el) {
  return /^H[1-6]$/.test(el.tagName) ||
    /headline|title|dek|subtitle/i.test(`${el.getAttribute("data-testid") || ""} ${el.className || ""}`);
}

function isSocialTextElement(el) {
  return Boolean(el.closest("article, shreddit-post, shreddit-comment")) &&
    (/tweetText|post-title|post-content/i.test(el.getAttribute("data-testid") || "") ||
      el.hasAttribute("lang") ||
      el.hasAttribute("slot"));
}

function hasCandidateAncestor(el) {
  let cur = el.parentElement;
  while (cur && cur !== document.body) {
    if (cur.hasAttribute("data-bilingual-processed") || cur.hasAttribute("data-bilingual-processing")) return true;
    if (cur.matches("p, h1, h2, h3, h4, h5, h6, blockquote, li, [data-testid='tweetText']")) return true;
    cur = cur.parentElement;
  }
  return false;
}

function collectFallbackBlocks(root) {
  // 针对 div, article, section
  const selector = "article, section, div";
  const allBlocks = Array.from(root.querySelectorAll(selector));
  const targets = allBlocks.filter(el => {
    if (processedBlocks.has(el)) return false;

    // 关键修复：如果这个 div 内部已经包含了我们主要关心的标签
    if (el.querySelector("p, h1, h2, h3, h4, h5, h6, li, blockquote")) return false;

    const ownText = (el.innerText || "").trim();
    // 严格模式：普通 div 必须有较长文本 (50字符) 才翻译
    if (!ownText || ownText.length < 50) return false;

    // 再次检查子元素数量
    if (el.childElementCount > 20) return false;

    return shouldTranslateBlock(el, true); // 严格模式
  });
  return targets;
}

function collectContentBlocks(root) {
  // 1. 确定搜索范围
  const scope = findMainContentRoot();

  const headlines = collectHeadlineBlocks();
  const primary = collectPrimaryBlocks(scope);
  const social = collectSocialTextBlocks(document.body);
  const fallback = collectFallbackBlocks(scope);
  const leafFallback = collectReadableLeafBlocks(document.body);

  log(`Found headline blocks: ${headlines.length}, primary blocks: ${primary.length}, social blocks: ${social.length}, fallback blocks: ${fallback.length}, leaf fallback blocks: ${leafFallback.length}`);

  // 2. 去重 (防止同一个元素被多次选中，虽然 selector 不重叠，但防万一)
  return dedupeTranslationTargets([
    ...headlines,
    ...primary,
    ...social,
    ...fallback,
    ...leafFallback
  ]);
}

function dedupeTranslationTargets(targets) {
  const unique = [];
  const seen = new Set();

  targets.forEach(el => {
    if (!el || seen.has(el)) return;
    if (unique.some(existing => existing.contains(el) && existing.innerText.trim() === el.innerText.trim())) return;

    for (let i = unique.length - 1; i >= 0; i--) {
      const existing = unique[i];
      if (el.contains(existing) && existing.innerText.trim() === el.innerText.trim()) {
        seen.delete(existing);
        unique.splice(i, 1);
      }
    }

    seen.add(el);
    unique.push(el);
  });

  return unique;
}

// 调用 background → 本地代理 → LM Studio
function translateBatch(texts, useCase = "page", providerId = null) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "TRANSLATE_BATCH", payload: texts, useCase, providerId },
      (response) => {
        if (!response) {
          reject(new Error("No response from background"));
          return;
        }
        if (!response.ok) {
          reject(new Error(response.error || "Unknown error"));
          return;
        }
        if (!Array.isArray(response.translations)) {
          reject(new Error("Invalid translations from background"));
          return;
        }
        resolve({ translations: response.translations, modelUsed: response.modelUsed });
      }
    );
  });
}

function sendPageTranslationStatus(payload) {
  chrome.runtime.sendMessage({ type: "PAGE_TRANSLATION_STATUS", payload }, () => {
    // The badge is helpful but nonessential; ignore closed-worker errors.
  });
}

function getSelectionCacheKey(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getCachedSelectionTranslation(key) {
  const cached = selectionTranslationCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.time > SELECTION_CACHE_TTL_MS) {
    selectionTranslationCache.delete(key);
    return null;
  }

  return cached;
}

function setCachedSelectionTranslation(key, value) {
  if (!key || !value?.translation) return;

  selectionTranslationCache.set(key, {
    ...value,
    time: Date.now()
  });

  while (selectionTranslationCache.size > SELECTION_CACHE_MAX) {
    const oldestKey = selectionTranslationCache.keys().next().value;
    selectionTranslationCache.delete(oldestKey);
  }
}

function toggleBilingualTranslations() {
  injectBilingualStyles();
  const blocks = getTranslationBlocks();

  if (!blocks.length) {
    showTranslationToast("当前页面还没有译文");
    return { hidden: bilingualTranslationsHidden, count: 0 };
  }

  bilingualTranslationsHidden = !bilingualTranslationsHidden;
  blocks.forEach(block => {
    setTranslationBlockVisibility(block);
  });

  showTranslationToast(bilingualTranslationsHidden ? "已隐藏译文" : "已显示译文");
  return { hidden: bilingualTranslationsHidden, count: blocks.length };
}

function getTranslationBlocks() {
  return Array.from(document.querySelectorAll(".bilingual-zh[data-bilingual-inserted='true']"));
}

function setTranslationBlockVisibility(block) {
  if (!block) return;

  if (bilingualTranslationsHidden) {
    block.style.setProperty("display", "none", "important");
  } else {
    block.style.removeProperty("display");
  }
}

function quickTogglePageTranslation() {
  if (isPageTranslating) {
    const countText = pageTranslationHud?.querySelector(".bilingual-hud-count")?.textContent || "";
    showTranslationToast(countText ? `正在翻译页面：${countText}` : "页面正在翻译中，请稍等");
    return;
  }

  if (getTranslationBlocks().length) {
    toggleBilingualTranslations();
    return;
  }

  makePageBilingual();
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response || !response.ok) {
        reject(new Error(response?.error || "操作失败"));
        return;
      }
      resolve(response);
    });
  });
}

function getFloatingProvider(state, providerId) {
  return state?.providerProfiles?.find(provider => provider.id === providerId) ||
    state?.providerProfiles?.[0] ||
    null;
}

function getFloatingModelOptions(provider) {
  const models = [];
  const seen = new Set();

  [provider?.modelName, ...(provider?.models || [])].forEach(model => {
    const clean = String(model || "").trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    models.push(clean);
  });

  return models;
}

function destroyFloatingBall() {
  closeFloatingPanel();
  if (floatingRoot) {
    floatingRoot.remove();
    floatingRoot = null;
    floatingPanel = null;
  }
}

function syncFloatingBall() {
  if (!document.body) {
    setTimeout(syncFloatingBall, 100);
    return;
  }

  if (!uiSettings.floatingBallEnabled) {
    destroyFloatingBall();
    return;
  }

  injectBilingualStyles();

  if (!floatingRoot) {
    floatingRoot = document.createElement("div");
    floatingRoot.id = "bilingual-floating-root";

    const buttonStack = document.createElement("div");
    buttonStack.className = "bilingual-floating-buttons";

    const quickBtn = document.createElement("button");
    quickBtn.type = "button";
    quickBtn.className = "bilingual-floating-ball bilingual-floating-quick";
    quickBtn.textContent = "译";
    quickBtn.title = "翻译/显示原文";
    quickBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      closeFloatingPanel();
      quickTogglePageTranslation();
    });

    const menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.className = "bilingual-floating-ball bilingual-floating-menu";
    menuBtn.textContent = "☰";
    menuBtn.title = "快速设置";
    menuBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFloatingPanel();
    });

    floatingPanel = document.createElement("div");
    floatingPanel.className = "bilingual-floating-panel hidden";

    buttonStack.appendChild(quickBtn);
    buttonStack.appendChild(menuBtn);
    floatingRoot.appendChild(buttonStack);
    floatingRoot.appendChild(floatingPanel);
    document.body.appendChild(floatingRoot);
  }

  floatingRoot.classList.toggle("bilingual-floating-left", uiSettings.floatingBallPosition === "left");
  floatingRoot.classList.toggle("bilingual-floating-right", uiSettings.floatingBallPosition !== "left");
  floatingRoot.classList.toggle("bilingual-floating-hover-only", Boolean(uiSettings.floatingBallHoverOnly));
  floatingRoot.style.opacity = String(Math.max(20, Math.min(100, Number(uiSettings.floatingBallOpacity) || 82)) / 100);
}

function toggleFloatingPanel() {
  if (!floatingPanel) return;

  if (!floatingPanel.classList.contains("hidden")) {
    closeFloatingPanel();
    return;
  }

  openFloatingPanel();
}

function openFloatingPanel() {
  syncFloatingBall();
  if (!floatingPanel) return;

  floatingPanel.classList.remove("hidden");
  floatingPanel.innerHTML = `<div class="bilingual-floating-status">正在读取设置…</div>`;

  detachFloatingPanelDocClickHandler();
  floatingPanelDocClickHandler = (event) => {
    if (!floatingRoot || floatingRoot.contains(event.target)) return;
    closeFloatingPanel();
  };
  document.addEventListener("mousedown", floatingPanelDocClickHandler, true);

  sendRuntimeMessage({ type: "GET_POPUP_STATE" })
    .then(response => renderFloatingPanel(response.state))
    .catch(err => {
      if (!floatingPanel) return;
      floatingPanel.innerHTML = `<div class="bilingual-floating-status">读取失败：${err.message}</div>`;
    });
}

function closeFloatingPanel() {
  if (floatingPanel) {
    floatingPanel.classList.add("hidden");
  }
  detachFloatingPanelDocClickHandler();
}

function detachFloatingPanelDocClickHandler() {
  if (floatingPanelDocClickHandler) {
    document.removeEventListener("mousedown", floatingPanelDocClickHandler, true);
    floatingPanelDocClickHandler = null;
  }
}

function renderFloatingPanel(state) {
  if (!floatingPanel || !state) return;

  const pageProvider = getFloatingProvider(state, state.pageProviderId);
  const pageModels = getFloatingModelOptions(pageProvider);
  const selectionProvider = getFloatingProvider(state, state.selectionProviderId);
  const selectionModels = getFloatingModelOptions(selectionProvider);
  const promptProfiles = state.promptProfiles || {};

  floatingPanel.innerHTML = "";

  const header = document.createElement("div");
  header.className = "bilingual-floating-header";

  const title = document.createElement("span");
  title.textContent = "双语阅读";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "bilingual-floating-close";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    closeFloatingPanel();
  });

  header.appendChild(title);
  header.appendChild(closeBtn);

  const providerField = createFloatingField("全文服务");
  const providerSelect = document.createElement("select");
  providerSelect.className = "bilingual-floating-select";
  (state.providerProfiles || []).forEach(provider => {
    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = provider.name || provider.modelName || provider.id;
    if (provider.id === pageProvider?.id) option.selected = true;
    providerSelect.appendChild(option);
  });
  providerSelect.addEventListener("change", () => {
    setFloatingStatus("正在切换全文服务…");
    sendRuntimeMessage({
      type: "SET_PROVIDER_FOR_USE_CASE",
      useCase: "page",
      providerId: providerSelect.value
    })
      .then(response => {
        renderFloatingPanel(response.state);
        showTranslationToast("全文服务已切换");
      })
      .catch(err => setFloatingStatus(`切换失败：${err.message}`));
  });
  providerField.appendChild(providerSelect);

  const modelField = createFloatingField("全文模型");
  const modelSelect = document.createElement("select");
  modelSelect.className = "bilingual-floating-select";
  if (!pageModels.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "请到设置页加载模型";
    modelSelect.appendChild(option);
    modelSelect.disabled = true;
  } else {
    pageModels.forEach(model => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      if (model === pageProvider?.modelName) option.selected = true;
      modelSelect.appendChild(option);
    });
  }
  modelSelect.addEventListener("change", () => {
    if (!modelSelect.value || !pageProvider?.id) return;
    setFloatingStatus("正在切换模型…");
    sendRuntimeMessage({
      type: "SET_PROVIDER_MODEL",
      useCase: "page",
      providerId: pageProvider.id,
      modelName: modelSelect.value
    })
      .then(response => {
        renderFloatingPanel(response.state);
        showTranslationToast(`全文模型已切换：${modelSelect.value}`);
      })
      .catch(err => setFloatingStatus(`切换失败：${err.message}`));
  });
  modelField.appendChild(modelSelect);

  const selectionProviderField = createFloatingField("划词服务");
  const selectionProviderSelect = document.createElement("select");
  selectionProviderSelect.className = "bilingual-floating-select";
  (state.providerProfiles || []).forEach(provider => {
    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = provider.name || provider.modelName || provider.id;
    if (provider.id === selectionProvider?.id) option.selected = true;
    selectionProviderSelect.appendChild(option);
  });
  selectionProviderSelect.addEventListener("change", () => {
    setFloatingStatus("正在切换划词服务…");
    sendRuntimeMessage({
      type: "SET_PROVIDER_FOR_USE_CASE",
      useCase: "selection",
      providerId: selectionProviderSelect.value
    })
      .then(response => {
        renderFloatingPanel(response.state);
        showTranslationToast("划词服务已切换");
      })
      .catch(err => setFloatingStatus(`切换失败：${err.message}`));
  });
  selectionProviderField.appendChild(selectionProviderSelect);

  const selectionModelField = createFloatingField("划词模型");
  const selectionModelSelect = document.createElement("select");
  selectionModelSelect.className = "bilingual-floating-select";
  if (!selectionModels.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "请到设置页加载模型";
    selectionModelSelect.appendChild(option);
    selectionModelSelect.disabled = true;
  } else {
    selectionModels.forEach(model => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      if (model === selectionProvider?.modelName) option.selected = true;
      selectionModelSelect.appendChild(option);
    });
  }
  selectionModelSelect.addEventListener("change", () => {
    if (!selectionModelSelect.value || !selectionProvider?.id) return;
    setFloatingStatus("正在切换划词模型…");
    sendRuntimeMessage({
      type: "SET_PROVIDER_MODEL",
      useCase: "selection",
      providerId: selectionProvider.id,
      modelName: selectionModelSelect.value
    })
      .then(response => {
        renderFloatingPanel(response.state);
        showTranslationToast(`划词模型已切换：${selectionModelSelect.value}`);
      })
      .catch(err => setFloatingStatus(`切换失败：${err.message}`));
  });
  selectionModelField.appendChild(selectionModelSelect);

  const profileField = createFloatingField("翻译风格");
  const profileSelect = document.createElement("select");
  profileSelect.className = "bilingual-floating-select";
  PROMPT_PROFILE_ORDER.forEach(id => {
    if (!promptProfiles[id]) return;
    const option = document.createElement("option");
    option.value = id;
    option.textContent = promptProfiles[id].label || id;
    if (id === state.translation?.promptProfile) option.selected = true;
    profileSelect.appendChild(option);
  });
  profileSelect.addEventListener("change", () => {
    setFloatingStatus("正在切换风格…");
    sendRuntimeMessage({
      type: "SET_PROMPT_PROFILE",
      promptProfile: profileSelect.value
    })
      .then(response => {
        renderFloatingPanel(response.state);
        showTranslationToast("翻译风格已切换");
      })
      .catch(err => setFloatingStatus(`切换失败：${err.message}`));
  });
  profileField.appendChild(profileSelect);

  const status = document.createElement("div");
  status.className = "bilingual-floating-status";
  status.textContent = [
    pageProvider?.modelName ? `全文：${pageProvider.modelName}` : "全文模型未设置",
    selectionProvider?.modelName ? `划词：${selectionProvider.modelName}` : "划词模型未设置"
  ].join(" / ");

  floatingPanel.appendChild(header);
  floatingPanel.appendChild(providerField);
  floatingPanel.appendChild(modelField);
  floatingPanel.appendChild(selectionProviderField);
  floatingPanel.appendChild(selectionModelField);
  floatingPanel.appendChild(profileField);
  floatingPanel.appendChild(status);
}

function createFloatingField(labelText) {
  const field = document.createElement("div");
  field.className = "bilingual-floating-field";

  const label = document.createElement("div");
  label.className = "bilingual-floating-label";
  label.textContent = labelText;

  field.appendChild(label);
  return field;
}

function setFloatingStatus(text) {
  if (!floatingPanel) return;
  const status = floatingPanel.querySelector(".bilingual-floating-status");
  if (status) {
    status.textContent = text;
  }
}

function injectBilingualStyles() {
  if (bilingualStylesInjected) return;
  bilingualStylesInjected = true;

  const style = document.createElement("style");
  style.id = "bilingual-translator-styles";
  style.textContent = `
    .bilingual-zh {
      color: #4b5563 !important;
      margin-bottom: 12px !important;
      font-size: 0.95em !important;
      line-height: 1.65 !important;
      box-sizing: border-box !important;
      display: block !important;
      max-width: 100% !important;
    }

    .bilingual-pending {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      color: #64748b !important;
      margin: 8px 0 12px !important;
      padding: 6px 8px !important;
      border-left: 3px solid #93c5fd !important;
      background: rgba(37, 99, 235, 0.06) !important;
      border-radius: 4px !important;
      font-size: 0.92em !important;
      line-height: 1.45 !important;
    }

    .bilingual-spinner {
      width: 13px !important;
      height: 13px !important;
      flex: 0 0 13px !important;
      border: 2px solid rgba(37, 99, 235, 0.25) !important;
      border-top-color: #2563eb !important;
      border-radius: 50% !important;
      animation: bilingual-spin 0.8s linear infinite !important;
    }

    .bilingual-hud {
      position: fixed !important;
      top: 16px !important;
      right: 16px !important;
      z-index: 999999 !important;
      width: 260px !important;
      padding: 12px !important;
      color: #0f172a !important;
      background: rgba(255, 255, 255, 0.96) !important;
      border: 1px solid rgba(148, 163, 184, 0.45) !important;
      border-radius: 8px !important;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18) !important;
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    }

    .bilingual-hud-title {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 8px !important;
      margin-bottom: 8px !important;
      font-weight: 700 !important;
    }

    .bilingual-hud-subtitle {
      color: #64748b !important;
      margin-bottom: 8px !important;
    }

    .bilingual-hud-bar {
      height: 6px !important;
      overflow: hidden !important;
      background: #e2e8f0 !important;
      border-radius: 999px !important;
    }

    .bilingual-hud-fill {
      width: 0% !important;
      height: 100% !important;
      background: linear-gradient(90deg, #2563eb, #14b8a6) !important;
      border-radius: inherit !important;
      transition: width 0.2s ease !important;
    }

    .bilingual-toast {
      position: fixed !important;
      top: 16px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      z-index: 999999 !important;
      padding: 8px 12px !important;
      color: #fff !important;
      background: rgba(15, 23, 42, 0.9) !important;
      border-radius: 999px !important;
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.22) !important;
    }

    #bilingual-floating-root {
      position: fixed !important;
      top: 46% !important;
      z-index: 999998 !important;
      display: flex !important;
      align-items: flex-start !important;
      gap: 8px !important;
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      color: #172033 !important;
      transition: opacity 0.18s ease, transform 0.18s ease !important;
    }

    #bilingual-floating-root.bilingual-floating-right {
      right: 12px !important;
      flex-direction: row-reverse !important;
    }

    #bilingual-floating-root.bilingual-floating-left {
      left: 12px !important;
      flex-direction: row !important;
    }

    #bilingual-floating-root.bilingual-floating-hover-only:not(:hover) {
      opacity: 0.35 !important;
    }

    .bilingual-floating-buttons {
      display: grid !important;
      gap: 8px !important;
    }

    .bilingual-floating-ball {
      width: 42px !important;
      height: 42px !important;
      border: 0 !important;
      border-radius: 999px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: #fff !important;
      background: #2563eb !important;
      box-shadow: 0 10px 26px rgba(37, 99, 235, 0.36) !important;
      cursor: pointer !important;
      font: 700 16px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      user-select: none !important;
    }

    .bilingual-floating-menu {
      color: #2563eb !important;
      background: #fff !important;
      border: 1px solid rgba(37, 99, 235, 0.22) !important;
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.16) !important;
      font-size: 17px !important;
    }

    .bilingual-floating-panel {
      width: 286px !important;
      max-width: calc(100vw - 72px) !important;
      padding: 10px !important;
      border: 1px solid rgba(148, 163, 184, 0.45) !important;
      border-radius: 8px !important;
      color: #172033 !important;
      background: rgba(255, 255, 255, 0.98) !important;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18) !important;
    }

    .bilingual-floating-panel.hidden {
      display: none !important;
    }

    .bilingual-floating-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 8px !important;
      margin-bottom: 8px !important;
      color: #172033 !important;
      font-weight: 700 !important;
    }

    .bilingual-floating-close {
      border: 0 !important;
      background: transparent !important;
      color: #64748b !important;
      cursor: pointer !important;
      font: 700 18px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    }

    .bilingual-floating-actions {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 7px !important;
      margin-bottom: 9px !important;
    }

    .bilingual-floating-button {
      min-height: 32px !important;
      border: 0 !important;
      border-radius: 6px !important;
      color: #fff !important;
      background: #2563eb !important;
      cursor: pointer !important;
      font: 700 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    }

    .bilingual-floating-button.secondary {
      color: #172033 !important;
      background: #f1f5f9 !important;
      border: 1px solid #d9e0ea !important;
    }

    .bilingual-floating-field {
      display: grid !important;
      gap: 5px !important;
      margin-top: 8px !important;
    }

    .bilingual-floating-label {
      color: #334155 !important;
      font-size: 12px !important;
      font-weight: 700 !important;
    }

    .bilingual-floating-select {
      width: 100% !important;
      min-height: 31px !important;
      padding: 5px 7px !important;
      border: 1px solid #d9e0ea !important;
      border-radius: 6px !important;
      color: #172033 !important;
      background: #fff !important;
      font: 12px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    }

    .bilingual-floating-status {
      min-height: 16px !important;
      margin-top: 8px !important;
      color: #64748b !important;
      font-size: 12px !important;
    }

    @keyframes bilingual-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.documentElement.appendChild(style);
}

function showTranslationToast(text) {
  injectBilingualStyles();
  const oldToast = document.querySelector(".bilingual-toast");
  if (oldToast) oldToast.remove();

  const toast = document.createElement("div");
  toast.className = "bilingual-toast";
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function updateTranslationHud(done, total, state = "running", detail = "") {
  injectBilingualStyles();

  if (!pageTranslationHud) {
    pageTranslationHud = document.createElement("div");
    pageTranslationHud.className = "bilingual-hud";
    pageTranslationHud.innerHTML = `
      <div class="bilingual-hud-title">
        <span>页面翻译中</span>
        <span class="bilingual-hud-count">0/0</span>
      </div>
      <div class="bilingual-hud-subtitle">正在准备段落…</div>
      <div class="bilingual-hud-bar"><div class="bilingual-hud-fill"></div></div>
    `;
    document.body.appendChild(pageTranslationHud);
  }

  const countEl = pageTranslationHud.querySelector(".bilingual-hud-count");
  const titleEl = pageTranslationHud.querySelector(".bilingual-hud-title span:first-child");
  const subtitleEl = pageTranslationHud.querySelector(".bilingual-hud-subtitle");
  const fillEl = pageTranslationHud.querySelector(".bilingual-hud-fill");
  const percent = total ? Math.round((done / total) * 100) : 0;

  if (state === "done") {
    titleEl.textContent = "页面翻译完成";
  } else if (state === "error") {
    titleEl.textContent = "页面翻译中断";
  } else {
    titleEl.textContent = "页面翻译中";
  }

  countEl.textContent = `${done}/${total}`;
  subtitleEl.textContent = detail || (state === "done" ? "翻译完成" : "正在调用模型，请稍等…");
  fillEl.style.width = `${percent}%`;

  sendPageTranslationStatus({
    state,
    text: state === "running" ? `${percent}%` : "",
    title: state === "running" ? `正在翻译页面：${done}/${total}` : "整页双语翻译"
  });

  if (state === "done") {
    setTimeout(() => {
      if (pageTranslationHud) {
        pageTranslationHud.remove();
        pageTranslationHud = null;
      }
    }, 2600);
  }
}

function createPendingTranslationBlock(el) {
  injectBilingualStyles();
  const pending = document.createElement("div");
  pending.className = "bilingual-zh bilingual-pending";
  pending.setAttribute("data-bilingual-inserted", "true");

  const spinner = document.createElement("span");
  spinner.className = "bilingual-spinner";

  const label = document.createElement("span");
  label.textContent = "翻译中…";

  pending.appendChild(spinner);
  pending.appendChild(label);
  placeTranslationBlock(el, pending);
  return pending;
}

function placeTranslationBlock(el, block) {
  const tag = el.tagName.toLowerCase();
  if (tag === "li") {
    el.appendChild(block);
  } else {
    el.insertAdjacentElement("afterend", block);
  }
}

function completeTranslationBlock(el, block, zh) {
  block.className = "bilingual-zh";
  block.textContent = zh.trim();
  setTranslationBlockVisibility(block);
  el.setAttribute("data-bilingual-processed", "true");
  el.removeAttribute("data-bilingual-processing");
  processedBlocks.add(el);
}

function failTranslationBlock(el, block, errorText) {
  block.className = "bilingual-zh";
  block.style.color = "#b42318";
  block.textContent = errorText;
  el.removeAttribute("data-bilingual-processing");
}

function captureSelectionForLearning(selectionMeta, translation, modelUsed) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "CAPTURE_SELECTION",
        payload: {
          sourceText: selectionMeta.text,
          contextText: selectionMeta.contextText,
          captureKind: selectionMeta.kind,
          translation,
          modelUsed,
          pageTitle: document.title || "",
          pageUrl: window.location.href || ""
        }
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.ok) {
          reject(new Error(response?.error || "Capture failed"));
          return;
        }
        resolve(response);
      }
    );
  });
}

function buildLearningCard(selectionMeta, translation, modelUsed) {
  const sourceText = selectionMeta.text;
  const contextText = selectionMeta.contextText || sourceText;
  const isShortTerm = selectionMeta.kind === "term";
  const compactTitle = String(isShortTerm ? sourceText : contextText).replace(/\s+/g, " ").trim();
  const title = compactTitle.slice(0, 72) || "Selection";
  const pageTitle = document.title || window.location.href || "Unknown page";
  const pageUrl = window.location.href || "";
  const sourceLine = pageUrl ? `[${escapeMarkdownLinkText(pageTitle)}](${pageUrl})` : pageTitle;
  const eudicLine = isShortTerm
    ? `- 欧路：[${escapeMarkdownLinkText(sourceText)}](eudic://dict/${encodeURIComponent(sourceText)})`
    : "";

  const lines = [
    "",
    "---",
    "",
    `## ${isShortTerm ? "词卡" : "句卡"}：${cleanMarkdownHeading(title)}`,
    "",
    "### 中文解释",
    "",
    translation,
    "",
    `### ${isShortTerm ? "英文上下文" : "英文原文"}`,
    "",
    markdownQuote(highlightTermInText(contextText, sourceText, isShortTerm)),
    "",
    `### ${isShortTerm ? "上下文翻译" : "中文翻译"}`,
    "",
    isShortTerm ? "（可在复习时自行补充或用全文翻译对照。）" : translation,
    "",
    "### 主动回忆",
    "",
    "- [ ] 不看译文，复述它的意思",
    "- [ ] 用它造一个自己的句子",
    `- [ ] 下次复习：${getReviewDate(3)}`,
    "",
    "### 来源",
    "",
    `- 页面：${sourceLine}`,
    eudicLine,
    `- 类型：${isShortTerm ? "词卡" : "段落卡"}`,
    `- 时间：${formatLocalTimestamp()}`,
  ].filter(Boolean);

  if (modelUsed) {
    lines.push(`- 模型：\`${String(modelUsed).replace(/`/g, "\\`")}\``);
  }

  lines.push("", "#language-learning #browser-selection");

  return lines.join("\n");
}

function analyzeSelection(selection) {
  const text = selection.toString().trim();
  const kind = isTermLikeSelection(text) ? "term" : "passage";
  const contextText = kind === "term" ? getSelectionContextBlock(selection, text) : text;

  return {
    text,
    kind,
    contextText: contextText || text
  };
}

function isTermLikeSelection(text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  const words = cleaned.match(/[A-Za-z][A-Za-z'-]*/g) || [];
  const sentencePunctuation = /[.!?。！？]\s*$/.test(cleaned) || /[.!?。！？].+\S/.test(cleaned);
  return cleaned.length <= 80 && words.length >= 1 && words.length <= 6 && !sentencePunctuation;
}

function getSelectionContextBlock(selection, selectedText) {
  if (!selection || selection.rangeCount === 0) return selectedText;

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;
  const block = findBestContextBlock(container);
  const blockText = (block?.innerText || selectedText).replace(/\s+/g, " ").trim();

  if (!blockText || blockText.length <= selectedText.length) return selectedText;

  if (blockText.length <= 1200) return blockText;

  const index = findSelectedTextIndex(blockText, selectedText);
  if (index < 0) {
    return blockText.slice(0, 1200).trim();
  }

  return extractContextWindowAroundIndex(blockText, index, selectedText.length);
}

function findBestContextBlock(container) {
  if (!container) return null;
  const block = container.closest("p, li, blockquote");
  if (block) return block;

  const socialBlock = container.closest("[data-testid='tweetText'], [slot='text-body'], [slot='comment'], [data-click-id='text']");
  if (socialBlock) return socialBlock;

  return container.closest("article, section, div") || container;
}

function findSelectedTextIndex(text, selectedText) {
  const normalizedSelection = selectedText.replace(/\s+/g, " ").trim();
  let index = text.indexOf(normalizedSelection);
  if (index >= 0) return index;

  index = text.toLowerCase().indexOf(normalizedSelection.toLowerCase());
  return index;
}

function extractSentenceAroundIndex(text, index, length) {
  const boundaries = ".!?。！？";
  let start = index;
  let end = index + length;

  while (start > 0 && !boundaries.includes(text[start - 1])) start--;
  while (end < text.length && !boundaries.includes(text[end])) end++;
  if (end < text.length) end++;

  const sentence = text.slice(start, end).trim();
  if (sentence.length >= length && sentence.length <= 500) return sentence;

  const windowStart = Math.max(0, index - 180);
  const windowEnd = Math.min(text.length, index + length + 220);
  return text.slice(windowStart, windowEnd).trim();
}

function extractContextWindowAroundIndex(text, index, length) {
  const windowStart = Math.max(0, index - 450);
  const windowEnd = Math.min(text.length, index + length + 550);
  return text.slice(windowStart, windowEnd).trim();
}

function highlightTermInText(text, term, shouldHighlight) {
  if (!shouldHighlight) return text;
  const escaped = escapeRegExp(String(term || "").trim());
  if (!escaped) return text;
  return String(text || "").replace(new RegExp(`(${escaped})`, "i"), "**$1**");
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markdownQuote(text) {
  return String(text || "")
    .split(/\n+/)
    .map(line => `> ${line}`)
    .join("\n");
}

function buildCallout(type, title, text) {
  const body = String(text || "")
    .trim()
    .split(/\n+/)
    .map(line => `> ${line}`)
    .join("\n");

  return `> [!${type}] ${title}\n${body}`;
}

function formatLocalTimestamp() {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function getReviewDate(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function cleanMarkdownHeading(text) {
  return String(text || "Selection")
    .replace(/^#+\s*/, "")
    .replace(/[\r\n]+/g, " ")
    .trim() || "Selection";
}

function escapeMarkdownLinkText(text) {
  return String(text || "")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

// ========== 整页翻译：正文块后插入中文块 ==========

async function makePageBilingual() {
  log("makePageBilingual triggered");

  if (isPageTranslating) {
    const countText = pageTranslationHud?.querySelector(".bilingual-hud-count")?.textContent || "";
    showTranslationToast(countText ? `正在翻译页面：${countText}` : "页面正在翻译中，请稍等");
    return;
  }

  isPageTranslating = true;
  injectBilingualStyles();

  const blocks = collectContentBlocks(document.body);
  log("Total content blocks to translate:", blocks.length);

  if (!blocks.length) {
    showTranslationToast("没有找到新的可翻译正文");
    sendPageTranslationStatus({ state: "done" });
    isPageTranslating = false;
    return;
  }

  const items = blocks.map(el => ({
    el,
    text: el.innerText.trim()
  }));

  items.forEach(item => {
    item.el.setAttribute("data-bilingual-processing", "true");
    item.pendingBlock = createPendingTranslationBlock(item.el);
  });

  let translatedCount = 0;
  let lastModelUsed = "";
  let hadFatalError = false;
  updateTranslationHud(translatedCount, items.length, "running", "正在提交翻译请求…");

  let index = 0;
  try {
    while (index < items.length) {
      const batchItems = items.slice(index, index + MAX_BLOCKS_PER_BATCH);
      const batchTexts = batchItems.map(item => item.text);
      log("Sending block batch of size:", batchItems.length);

      const { translations, modelUsed } = await translateBatch(batchTexts, "page");

      if (modelUsed) {
        lastModelUsed = modelUsed;
        log(`Batch translated using model: ${modelUsed}`);
      }

      batchItems.forEach((item, i) => {
        const zh = translations[i];
        if (zh) {
          completeTranslationBlock(item.el, item.pendingBlock, zh);
        } else {
          failTranslationBlock(item.el, item.pendingBlock, "翻译结果为空");
        }

        translatedCount++;
        updateTranslationHud(
          translatedCount,
          items.length,
          "running",
          lastModelUsed ? `正在翻译，模型：${lastModelUsed}` : "正在翻译，请稍等…"
        );
      });

      index += MAX_BLOCKS_PER_BATCH;
    }
  } catch (err) {
    hadFatalError = true;
    log("Error translating batch:", err);
    items.forEach(item => {
      if (item.el.hasAttribute("data-bilingual-processing")) {
        failTranslationBlock(item.el, item.pendingBlock, `翻译失败：${err.message}`);
      }
    });
    updateTranslationHud(translatedCount, items.length, "error", "翻译中断，请稍后重试");
    sendPageTranslationStatus({ state: "error", title: "页面翻译失败" });
    showTranslationToast("页面翻译失败，请查看控制台或设置");
  } finally {
    isPageTranslating = false;
  }

  if (!hadFatalError) {
    updateTranslationHud(items.length, items.length, "done", "翻译完成");
    showTranslationToast("页面翻译完成");
  }

  log("Bilingual conversion finished.");
}

// ========== 选区翻译相关：复制 / 弹窗 / 悬浮按钮 / 快捷键 ==========

function copyToClipboard(text) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(err => {
      log("Clipboard write failed:", err);
    });
  } else {
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.style.position = "fixed";
    temp.style.left = "-9999px";
    document.body.appendChild(temp);
    temp.select();
    try {
      document.execCommand("copy");
    } catch (e) {
      log("document.execCommand copy failed:", e);
    }
    document.body.removeChild(temp);
  }
}

function clearSelectionPopupTimer() {
  if (selectionPopupHideTimer) {
    clearTimeout(selectionPopupHideTimer);
    selectionPopupHideTimer = null;
  }
}

function detachPopupDocClickHandler() {
  if (selectionPopupDocClickHandler) {
    document.removeEventListener("mousedown", selectionPopupDocClickHandler, true);
    selectionPopupDocClickHandler = null;
  }
}

function removeSelectionPopup() {
  if (selectionPopup) {
    selectionPopup.remove();
    selectionPopup = null;
  }
  selectionPopupPinned = false;
  clearSelectionPopupTimer();
  detachPopupDocClickHandler();
}

function createSelectionPopup(selectionMeta, zhText, rect, modelUsed = "", options = {}) {
  injectBilingualStyles();
  const enText = selectionMeta.text;
  const saveLabel = selectionMeta.kind === "term" ? "收藏词卡" : "收藏段落";
  const isLoading = options.state === "loading";
  const isError = options.state === "error";
  // 移除旧 popup
  removeSelectionPopup();

  const popup = document.createElement("div");
  popup.id = "bilingual-selection-popup";
  selectionPopup = popup;
  selectionPopupPinned = false;

  popup.style.position = "fixed";
  popup.style.zIndex = 999999;
  popup.style.background = "rgba(0,0,0,0.85)";
  popup.style.color = "#fff";
  popup.style.padding = "8px 10px 10px 10px";
  popup.style.borderRadius = "6px";
  popup.style.fontSize = `${Number(uiSettings.selectionPopupFontSize) || DEFAULT_UI_SETTINGS.selectionPopupFontSize}px`;
  popup.style.lineHeight = "1.55";
  popup.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";

  // 尺寸限制
  popup.style.maxWidth = "460px";
  popup.style.maxHeight = "300px"; // 限制高度
  popup.style.overflowY = "auto";  // 超出滚动

  // 计算位置：优先显示在选区下方，如果下方空间不足，则显示在上方
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const popupHeight = 200; // 估算高度
  const popupWidth = 460;  // 最大宽度

  let top = rect.bottom + 8;
  let left = Math.max(10, rect.left);

  // 1. 垂直方向调整
  // 如果下方空间不足 (rect.bottom + popupHeight > viewportHeight)
  // 且上方空间充足，则放上面
  if (top + popupHeight > viewportHeight && rect.top > popupHeight + 20) {
    top = rect.top - popupHeight - 10;
    // 如果计算出来是负数（选区太长，top 都在屏幕外），就固定在屏幕底部上方一点
    if (top < 10) top = 10;
  }

  // 2. 再次检查是否溢出底部（针对超长选区）
  if (top + popupHeight > viewportHeight) {
    top = Math.max(10, viewportHeight - popupHeight - 20);
  }

  // 3. 水平方向调整
  if (left + popupWidth > viewportWidth) {
    left = Math.max(10, viewportWidth - popupWidth - 20);
  }

  popup.style.top = top + "px";
  popup.style.left = left + "px";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "flex-end";
  header.style.gap = "6px";
  header.style.flexWrap = "wrap";
  header.style.marginBottom = "4px";

  // 复制中英按钮
  const copyBothBtn = document.createElement("button");
  copyBothBtn.textContent = "复制中英";
  copyBothBtn.style.background = "transparent";
  copyBothBtn.style.border = "1px solid rgba(255,255,255,0.4)";
  copyBothBtn.style.color = "#fff";
  copyBothBtn.style.borderRadius = "3px";
  copyBothBtn.style.fontSize = "12px";
  copyBothBtn.style.padding = "2px 6px";
  copyBothBtn.style.cursor = "pointer";
  copyBothBtn.disabled = isLoading || isError;
  copyBothBtn.style.opacity = copyBothBtn.disabled ? "0.5" : "1";
  copyBothBtn.onclick = (e) => {
    e.stopPropagation();
    if (copyBothBtn.disabled) return;
    const combined = `${enText}\n${zhText}`;
    copyToClipboard(combined);
  };

  // 复制中文按钮
  const copyBtn = document.createElement("button");
  copyBtn.textContent = "复制中文";
  copyBtn.style.background = "transparent";
  copyBtn.style.border = "1px solid rgba(255,255,255,0.4)";
  copyBtn.style.color = "#fff";
  copyBtn.style.borderRadius = "3px";
  copyBtn.style.fontSize = "12px";
  copyBtn.style.padding = "2px 6px";
  copyBtn.style.cursor = "pointer";
  copyBtn.disabled = isLoading || isError;
  copyBtn.style.opacity = copyBtn.disabled ? "0.5" : "1";
  copyBtn.onclick = (e) => {
    e.stopPropagation();
    if (copyBtn.disabled) return;
    copyToClipboard(zhText);
  };

  const copyCardBtn = document.createElement("button");
  copyCardBtn.textContent = "复制卡片";
  copyCardBtn.style.background = "transparent";
  copyCardBtn.style.border = "1px solid rgba(255,255,255,0.4)";
  copyCardBtn.style.color = "#fff";
  copyCardBtn.style.borderRadius = "3px";
  copyCardBtn.style.fontSize = "12px";
  copyCardBtn.style.padding = "2px 6px";
  copyCardBtn.style.cursor = "pointer";
  copyCardBtn.disabled = isLoading || isError;
  copyCardBtn.style.opacity = copyCardBtn.disabled ? "0.5" : "1";
  copyCardBtn.onclick = (e) => {
    e.stopPropagation();
    if (copyCardBtn.disabled) return;
    copyToClipboard(buildLearningCard(selectionMeta, zhText, modelUsed));
    copyCardBtn.textContent = "已复制";
    setTimeout(() => {
      if (copyCardBtn.isConnected) copyCardBtn.textContent = "复制卡片";
    }, 1600);
  };

  const saveBtn = document.createElement("button");
  saveBtn.textContent = saveLabel;
  saveBtn.style.background = "transparent";
  saveBtn.style.border = "1px solid rgba(255,255,255,0.4)";
  saveBtn.style.color = "#fff";
  saveBtn.style.borderRadius = "3px";
  saveBtn.style.fontSize = "12px";
  saveBtn.style.padding = "2px 6px";
  saveBtn.style.cursor = "pointer";
  saveBtn.disabled = isLoading || isError;
  saveBtn.style.opacity = saveBtn.disabled ? "0.5" : "1";
  saveBtn.onclick = async (e) => {
    e.stopPropagation();
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
    saveBtn.textContent = selectionMeta.kind === "term" ? "翻译上下文" : "保存中";
    try {
      const result = await captureSelectionForLearning(selectionMeta, zhText, modelUsed);
      const targets = result.savedTargets && result.savedTargets.length
        ? result.savedTargets.join(" + ")
        : "学习记录";
      saveBtn.textContent = `已存 ${targets}`;
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = "收藏失败";
      log("Capture selection failed:", err);
      setTimeout(() => {
        if (saveBtn.isConnected) saveBtn.textContent = saveLabel;
      }, 2500);
    }
  };

  // 固定按钮（Pin：固定到右下角）
  const pinBtn = document.createElement("button");
  pinBtn.textContent = "固定";
  pinBtn.style.background = "transparent";
  pinBtn.style.border = "1px solid rgba(255,255,255,0.4)";
  pinBtn.style.color = "#fff";
  pinBtn.style.borderRadius = "3px";
  pinBtn.style.fontSize = "12px";
  pinBtn.style.padding = "2px 6px";
  pinBtn.style.cursor = "pointer";
  pinBtn.onclick = (e) => {
    e.stopPropagation();
    if (!selectionPopup) return;
    selectionPopupPinned = true;
    // 固定到右下角
    selectionPopup.style.left = "";
    selectionPopup.style.top = "";
    selectionPopup.style.right = "16px";
    selectionPopup.style.bottom = "16px";
    clearSelectionPopupTimer(); // 固定后不再自动隐藏
  };

  // 关闭按钮
  const closeBtn = document.createElement("span");
  closeBtn.textContent = "×";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontWeight = "bold";
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    removeSelectionPopup();
  };

  header.appendChild(copyBothBtn);
  header.appendChild(copyBtn);
  header.appendChild(copyCardBtn);
  header.appendChild(saveBtn);
  header.appendChild(pinBtn);
  header.appendChild(closeBtn);

  const enDiv = document.createElement("div");
  enDiv.textContent = enText;

  const hr = document.createElement("div");
  hr.style.borderTop = "1px solid rgba(255,255,255,0.2)";
  hr.style.margin = "4px 0";

  const zhDiv = document.createElement("div");
  if (isLoading) {
    zhDiv.style.display = "flex";
    zhDiv.style.alignItems = "center";
    zhDiv.style.gap = "8px";

    const spinner = document.createElement("span");
    spinner.className = "bilingual-spinner";

    const label = document.createElement("span");
    label.textContent = zhText || "翻译中…";

    zhDiv.appendChild(spinner);
    zhDiv.appendChild(label);
  } else {
    zhDiv.textContent = zhText;
    if (isError) {
      zhDiv.style.color = "#fecaca";
    }
  }

  popup.appendChild(header);
  popup.appendChild(enDiv);
  popup.appendChild(hr);
  popup.appendChild(zhDiv);

  document.body.appendChild(popup);

  // 点击页面其他地方自动关闭（未固定时）
  selectionPopupDocClickHandler = (ev) => {
    if (!selectionPopup) return;
    if (selectionPopupPinned) return; // 固定后，点击页面不再自动关闭
    if (!selectionPopup.contains(ev.target)) {
      removeSelectionPopup();
    }
  };
  document.addEventListener("mousedown", selectionPopupDocClickHandler, true);

  // 自动隐藏（例如 30 秒，未固定时生效）
  selectionPopupHideTimer = setTimeout(() => {
    if (!selectionPopupPinned) {
      removeSelectionPopup();
    }
  }, 30000);
}

async function handleSelectionTranslate() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    log("No selection to translate.");
    return;
  }

  const text = selection.toString().trim();
  if (!text || text.length < 3) {
    log("Selection too short, skip.");
    return;
  }

  const selectionMeta = analyzeSelection(selection);

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const cacheKey = getSelectionCacheKey(text);
  const cached = getCachedSelectionTranslation(cacheKey);

  log("Translating selection, length:", text.length);
  hideSelectionButton();

  if (cached) {
    createSelectionPopup(selectionMeta, cached.translation, rect, cached.modelUsed || "");
    return;
  }

  createSelectionPopup(selectionMeta, "翻译中…", rect, "", { state: "loading" });

  try {
    const { translations, modelUsed } = await translateBatch([text], "selection");
    const zh = (translations[0] || "").trim();
    if (!zh) {
      log("Empty translation for selection.");
      createSelectionPopup(selectionMeta, "翻译结果为空，请切换模型后重试", rect, "", { state: "error" });
      return;
    }
    setCachedSelectionTranslation(cacheKey, { translation: zh, modelUsed });
    createSelectionPopup(selectionMeta, zh, rect, modelUsed);
  } catch (err) {
    log("Error translating selection:", err);
    createSelectionPopup(selectionMeta, `翻译失败：${err.message || err}`, rect, "", { state: "error" });
  }
}

// ========== 选区悬浮“译”按钮 + 快捷键 Alt+T ==========

function hideSelectionButton() {
  if (selectionButton) {
    selectionButton.remove();
    selectionButton = null;
  }
}

function showSelectionButtonNearSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    hideSelectionButton();
    return;
  }

  const text = selection.toString().trim();
  // 基本过滤：太短、不含英文、含中文就不显示按钮
  if (!text || text.length < 3 || !/[A-Za-z]/.test(text) || /[\u4e00-\u9fff]/.test(text)) {
    hideSelectionButton();
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // 选区在不可见区域时不显示
  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    hideSelectionButton();
    return;
  }

  if (!selectionButton) {
    const btn = document.createElement("div");
    btn.id = "bilingual-selection-button";
    btn.textContent = "译";
    btn.style.position = "fixed";
    btn.style.zIndex = 999999;
    btn.style.width = "22px";
    btn.style.height = "22px";
    btn.style.lineHeight = "22px";
    btn.style.textAlign = "center";
    btn.style.borderRadius = "50%";
    btn.style.background = "#1a73e8";
    btn.style.color = "#fff";
    btn.style.fontSize = "13px";
    btn.style.cursor = "pointer";
    btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    btn.style.userSelect = "none";

    btn.onclick = (e) => {
      e.stopPropagation();
      handleSelectionTranslate();
    };

    document.body.appendChild(btn);
    selectionButton = btn;
  }

  selectionButton.style.left = Math.min(
    window.innerWidth - 30,
    Math.max(10, rect.right + 6)
  ) + "px";
  selectionButton.style.top = Math.min(
    window.innerHeight - 30,
    Math.max(10, rect.top - 10)
  ) + "px";
}

function setupSelectionButtonListeners() {
  // 鼠标抬起后稍微延迟一下再读 selection
  document.addEventListener("mouseup", () => {
    setTimeout(() => {
      showSelectionButtonNearSelection();
    }, 50);
  });

  // 滚动或窗口大小变化时，隐藏按钮
  window.addEventListener("scroll", () => {
    hideSelectionButton();
  }, { passive: true });

  window.addEventListener("resize", () => {
    hideSelectionButton();
  });

  // selection 清空时隐藏按钮
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel || !sel.toString().trim()) {
      hideSelectionButton();
    }
  });

  // 键盘快捷键：Alt+T 直接翻译当前选区
  document.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "t" || e.key === "T")) {
      const sel = window.getSelection();
      if (sel && sel.toString().trim()) {
        e.preventDefault();
        e.stopPropagation();
        handleSelectionTranslate();
      }
    }
  });
}

setupSelectionButtonListeners();

// ========== 消息入口：整页翻译 / 选区翻译（右键） ==========

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log("onMessage:", message?.type);
  if (message.type === "START_BILINGUAL_TRANSLATION") {
    makePageBilingual();
    sendResponse({ ok: true });
  } else if (message.type === "CONTEXT_TRANSLATE_SELECTION") {
    // 右键菜单触发：选区翻译
    handleSelectionTranslate();
    sendResponse({ ok: true });
  } else if (message.type === "TOGGLE_BILINGUAL_TRANSLATIONS") {
    const result = toggleBilingualTranslations();
    sendResponse({ ok: true, ...result });
  }
  return false;
});
