const DEFAULT_PROVIDER_ID = "local-openwebui";

const DEFAULT_PROVIDER = {
  id: DEFAULT_PROVIDER_ID,
  name: "Local Open WebUI",
  providerType: "openai",
  apiUrl: "http://127.0.0.1:3000/api/chat/completions",
  apiKey: "",
  modelName: "qwen/qwen3-vl-8b",
  models: []
};

const DEFAULT_CAPTURE = {
  enableObsidian: false,
  obsidianMode: "uri",
  obsidianVault: "",
  obsidianFile: "Language Learning/Browser Selections.md",
  obsidianApiUrl: "https://127.0.0.1:27124",
  obsidianApiKey: "",
  translateTermContext: true,
  returnFocusAfterObsidianSave: true,
  enableEudic: false,
  eudicToken: "",
  eudicCategoryName: "browser-selection",
  eudicLanguage: "en"
};

const DEFAULT_UI = {
  selectionPopupFontSize: 15,
  optionsLanguage: "auto",
  pronunciationEnabled: true,
  pronunciationAccent: "auto",
  floatingBallEnabled: true,
  floatingBallPosition: "right",
  floatingBallOpacity: 82,
  floatingBallHoverOnly: false
};

const DEFAULT_TRANSLATION = {
  promptProfile: "news"
};

const I18N = {
  en: {
    appTitle: "Bilingual Reading Companion",
    languageLabel: "Language",
    languageAuto: "Auto",
    languageEnglish: "English",
    languageChinese: "中文",
    providerProfiles: "Translation Services",
    providerSelectPlaceholder: "Select a saved service",
    newProvider: "New Service",
    saveProvider: "Save Service",
    deleteProvider: "Delete",
    profileName: "Service Name",
    profileNamePlaceholder: "Gemini API",
    providerType: "Service Type",
    apiUrl: "API URL",
    apiUrlHintOpenai: "Supports Open WebUI, LM Studio, and most OpenAI-compatible chat completion APIs.",
    apiUrlHintGemini: "Use the Gemini API base URL. The extension will call /models and /models/{model}:generateContent for you.",
    apiKey: "API Key",
    apiKeyHint: "Stored in browser local storage. Leave empty for unauthenticated local endpoints.",
    model: "Model",
    loadModels: "Load Models",
    customModelName: "Custom model name",
    modelHint: "Load models to pick from a list, or type a custom model name.",
    modelSelectEmpty: "Load models, or type below",
    customModelSuffix: "(custom)",
    translationRouting: "Use Services For",
    fullPage: "Full Page Uses",
    selection: "Selection Uses",
    translationStyle: "Translation Style",
    styleNews: "News / faithful reporting",
    styleGeneral: "General / natural Chinese",
    styleLiterary: "Literary / essay & fiction",
    styleAcademic: "Academic / technical precision",
    translationStyleHint: "Default is news: neutral, faithful, and no added interpretation. Use literary for essays, fiction, and The New Yorker style pieces.",
    learningCapture: "Learning Capture",
    saveToObsidian: "Save selections to Obsidian",
    obsidianSync: "Obsidian Sync",
    obsidianUri: "Obsidian URI Scheme",
    obsidianRest: "Local REST API (optional)",
    obsidianSyncHint: "URI sync uses Obsidian's built-in app link and may show a browser confirmation. REST is kept as an optional quiet mode.",
    obsidianVault: "Obsidian Vault",
    obsidianVaultPlaceholder: "My Vault",
    obsidianRestUrl: "Obsidian REST API URL",
    obsidianRestKey: "Obsidian REST API Key",
    obsidianRestKeyPlaceholder: "Paste Local REST API key",
    obsidianNote: "Obsidian Note",
    obsidianNoteHint: "Path inside your vault. REST mode will create it if needed.",
    translateTermContext: "Translate context when saving term cards",
    translateTermContextHint: "Adds one extra LLM request for words and short phrases, then writes the paragraph translation into Obsidian. Passage cards keep using the selected translation.",
    returnFocus: "Return focus to browser after Obsidian save",
    returnFocusHint: "After triggering the Obsidian app link, the extension will bring the current browser window back so you can keep reading.",
    addToEudic: "Add short selections to Eudic",
    eudicAuthorization: "Eudic Authorization",
    eudicAuthorizationPlaceholder: "Paste OpenAPI authorization text",
    eudicAuthorizationHint: "Get it from my.eudic.net/OpenAPI/Authorization after logging in. You can paste the copied authorization value directly.",
    wordBook: "Word Book",
    eudicLanguage: "Language",
    eudicHint: "Eudic is best for words and short phrases. Longer sentences should go to Obsidian.",
    selectionPopup: "Selection Popup",
    fontSize: "Font Size",
    fontSmall: "Small",
    fontMedium: "Medium",
    fontLarge: "Large",
    fontExtraLarge: "Extra Large",
    pronunciation: "Pronunciation",
    enablePronunciation: "Show pronunciation and audio for selected words",
    pronunciationHint: "Single words use dictionary IPA and original audio when available. Phrases and fallback playback use your browser or system voice.",
    pronunciationAccent: "Preferred Accent",
    accentAuto: "Auto",
    accentUS: "American English",
    accentUK: "British English",
    floatingBall: "Floating Ball",
    enableFloatingBall: "Show page floating ball",
    floatingBallHint: "Shows a small page control for full-page translation, toggling translations, and quick model/style switching.",
    floatingBallPosition: "Position",
    positionRight: "Right",
    positionLeft: "Left",
    floatingBallOpacity: "Opacity",
    floatingBallHoverOnly: "Dim until hover",
    saveSettings: "Save Settings",
    reset: "Reset",
    debugLog: "Debug Log",
    unnamedProvider: "Unnamed Service",
    newProviderProfileName: "New Service",
    draftProviderName: "Unsaved service draft",
    defaultGeminiServiceName: "Gemini API",
    defaultLocalServiceName: "Local LLM",
    migratedLocalProvider: "Migrated Local Service",
    apiUrlRequired: "Error: API URL cannot be empty.",
    modelNameRequired: "Error: model name cannot be empty.",
    settingsSaved: "Settings saved.",
    restoredDefaults: "Restored defaults. Click Save to apply.",
    newProviderCreated: "New service draft created. Fill it in, then click Save Service.",
    atLeastOneProvider: "At least one service is required.",
    providerDeleted: "Service deleted. Click Save Settings to apply.",
    providerSaved: "Service saved.",
    setApiUrlFirst: "Please set API URL first.",
    fetchingModels: "Fetching models...",
    failed: "Failed: {error}",
    runtimeError: "Runtime Error: {error}",
    backgroundFetchFailed: "Background fetch failed: {error}",
    loadedModels: "Loaded {count} model(s).",
    loadedProfiles: "Loaded {count} service(s).",
    debugFetchingModels: "Fetching models for {name}: {url}"
  },
  "zh-CN": {
    appTitle: "双语阅读伴侣",
    languageLabel: "语言",
    languageAuto: "自动",
    languageEnglish: "English",
    languageChinese: "中文",
    providerProfiles: "翻译服务",
    providerSelectPlaceholder: "选择已保存服务",
    newProvider: "新建服务",
    saveProvider: "保存服务",
    deleteProvider: "删除",
    profileName: "服务名称",
    profileNamePlaceholder: "Gemini API",
    providerType: "服务类型",
    apiUrl: "API 地址",
    apiUrlHintOpenai: "支持 Open WebUI、LM Studio，以及大多数 OpenAI-compatible chat completion API。",
    apiUrlHintGemini: "使用 Gemini API base URL。扩展会自动调用 /models 和 /models/{model}:generateContent。",
    apiKey: "API Key",
    apiKeyHint: "保存在浏览器扩展本地存储中。本地接口不需要鉴权时可以留空。",
    model: "模型",
    loadModels: "加载模型",
    customModelName: "自定义模型名称",
    modelHint: "可以先加载模型列表选择，也可以手动输入模型名称。",
    modelSelectEmpty: "加载模型，或在下方手动填写",
    customModelSuffix: "（自定义）",
    translationRouting: "不同场景使用的服务",
    fullPage: "全文翻译使用",
    selection: "划词翻译使用",
    translationStyle: "翻译风格",
    styleNews: "新闻 / 忠实报道",
    styleGeneral: "通用 / 自然中文",
    styleLiterary: "文学 / 散文与小说",
    styleAcademic: "学术 / 专业精确",
    translationStyleHint: "默认新闻风格：中性、忠实、不添加解释。散文、小说和 The New Yorker 风格文章可选择文学风格。",
    learningCapture: "学习记录",
    saveToObsidian: "保存选中内容到 Obsidian",
    obsidianSync: "Obsidian 同步",
    obsidianUri: "Obsidian URI Scheme",
    obsidianRest: "Local REST API（可选）",
    obsidianSyncHint: "URI 同步使用 Obsidian 内置 app link，浏览器可能弹出确认。REST 作为可选静默模式保留。",
    obsidianVault: "Obsidian Vault",
    obsidianVaultPlaceholder: "我的 Vault",
    obsidianRestUrl: "Obsidian REST API 地址",
    obsidianRestKey: "Obsidian REST API Key",
    obsidianRestKeyPlaceholder: "粘贴 Local REST API key",
    obsidianNote: "Obsidian 笔记",
    obsidianNoteHint: "Vault 内的笔记路径。REST 模式会在需要时创建文件。",
    translateTermContext: "收藏词卡时翻译上下文",
    translateTermContextHint: "会额外发送一次 LLM 请求，把词/短语所在上下文翻译后写入 Obsidian。段落卡继续使用选中文本的翻译。",
    returnFocus: "保存到 Obsidian 后返回浏览器焦点",
    returnFocusHint: "触发 Obsidian app link 后，扩展会尝试把当前浏览器窗口拉回前台，方便继续阅读。",
    addToEudic: "短词和短语同步到欧路",
    eudicAuthorization: "欧路 Authorization",
    eudicAuthorizationPlaceholder: "粘贴 OpenAPI authorization 内容",
    eudicAuthorizationHint: "登录 my.eudic.net 后，到 OpenAPI/Authorization 页面获取。可以直接粘贴复制出的 authorization 值。",
    wordBook: "生词本",
    eudicLanguage: "语言",
    eudicHint: "欧路适合保存单词和短语。较长句子和段落建议保存到 Obsidian。",
    selectionPopup: "划词弹窗",
    fontSize: "字体大小",
    fontSmall: "小",
    fontMedium: "中",
    fontLarge: "大",
    fontExtraLarge: "超大",
    pronunciation: "发音",
    enablePronunciation: "为划词单词显示音标和发音",
    pronunciationHint: "单词优先使用词典 IPA 和原始音频；短语和兜底播放会使用浏览器或系统语音。",
    pronunciationAccent: "偏好口音",
    accentAuto: "自动",
    accentUS: "美音",
    accentUK: "英音",
    floatingBall: "页面悬浮球",
    enableFloatingBall: "显示页面悬浮球",
    floatingBallHint: "在网页侧边显示一个小控制入口，用于全文翻译、隐藏/显示译文，以及快速切换模型和风格。",
    floatingBallPosition: "位置",
    positionRight: "右侧",
    positionLeft: "左侧",
    floatingBallOpacity: "透明度",
    floatingBallHoverOnly: "鼠标悬停前弱化显示",
    saveSettings: "保存设置",
    reset: "重置",
    debugLog: "调试日志",
    unnamedProvider: "未命名服务",
    newProviderProfileName: "新服务",
    draftProviderName: "未保存服务草稿",
    defaultGeminiServiceName: "Gemini API",
    defaultLocalServiceName: "本地 LLM",
    migratedLocalProvider: "迁移的本地服务",
    apiUrlRequired: "错误：API 地址不能为空。",
    modelNameRequired: "错误：模型名称不能为空。",
    settingsSaved: "设置已保存。",
    restoredDefaults: "已恢复默认值。点击保存后生效。",
    newProviderCreated: "已创建新服务草稿。填写后点击“保存服务”。",
    atLeastOneProvider: "至少需要保留一个服务。",
    providerDeleted: "服务已删除。点击“保存设置”后生效。",
    providerSaved: "服务已保存。",
    setApiUrlFirst: "请先设置 API 地址。",
    fetchingModels: "正在加载模型...",
    failed: "失败：{error}",
    runtimeError: "运行时错误：{error}",
    backgroundFetchFailed: "后台加载失败：{error}",
    loadedModels: "已加载 {count} 个模型。",
    loadedProfiles: "已加载 {count} 个服务。",
    debugFetchingModels: "正在为 {name} 加载模型：{url}"
  }
};

let settings = {
  providerProfiles: [clone(DEFAULT_PROVIDER)],
  activeProviderId: DEFAULT_PROVIDER_ID,
  pageProviderId: DEFAULT_PROVIDER_ID,
  selectionProviderId: DEFAULT_PROVIDER_ID,
  capture: clone(DEFAULT_CAPTURE),
  ui: clone(DEFAULT_UI),
  translation: clone(DEFAULT_TRANSLATION)
};

let currentProviderId = DEFAULT_PROVIDER_ID;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function $(id) {
  return document.getElementById(id);
}

function getActiveLanguage() {
  const savedLanguage = settings.ui?.optionsLanguage || DEFAULT_UI.optionsLanguage;
  if (savedLanguage === "zh-CN" || savedLanguage === "en") {
    return savedLanguage;
  }

  return /^zh\b/i.test(navigator.language || "") ? "zh-CN" : "en";
}

function t(key, vars = {}) {
  const lang = getActiveLanguage();
  const text = I18N[lang]?.[key] || I18N.en[key] || key;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}

function applyI18n() {
  const lang = getActiveLanguage();
  document.documentElement.lang = lang;
  document.title = t("appTitle");

  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  updateProviderTypeHint();
  renderModelSelect(getCurrentProvider());
}

function log(msg) {
  const debugEl = $("debugLog");
  if (debugEl) {
    const time = new Date().toLocaleTimeString();
    debugEl.value += `[${time}] ${msg}\n`;
    debugEl.scrollTop = debugEl.scrollHeight;
  }
  console.log(msg);
}

function error(msg) {
  const debugEl = $("debugLog");
  if (debugEl) {
    const time = new Date().toLocaleTimeString();
    debugEl.value += `[${time}] [ERROR] ${msg}\n`;
    debugEl.scrollTop = debugEl.scrollHeight;
  }
  console.error(msg);
}

function normalizeProvider(raw, index = 0) {
  const fallbackId = index === 0 ? DEFAULT_PROVIDER_ID : `provider-${Date.now()}-${index}`;
  return {
    ...DEFAULT_PROVIDER,
    ...(raw || {}),
    id: String(raw?.id || fallbackId),
    name: String(raw?.name || raw?.modelName || `Provider ${index + 1}`),
    providerType: raw?.providerType === "gemini" ? "gemini" : "openai",
    apiUrl: String(raw?.apiUrl || DEFAULT_PROVIDER.apiUrl),
    apiKey: String(raw?.apiKey || ""),
    modelName: String(raw?.modelName || DEFAULT_PROVIDER.modelName),
    models: Array.isArray(raw?.models) ? raw.models : []
  };
}

function normalizeSettings(items) {
  const legacyProvider = normalizeProvider({
    id: DEFAULT_PROVIDER_ID,
    name: t("migratedLocalProvider"),
    apiUrl: items.apiUrl || DEFAULT_PROVIDER.apiUrl,
    apiKey: items.apiKey || "",
    modelName: items.modelName || DEFAULT_PROVIDER.modelName
  });

  let providerProfiles = Array.isArray(items.providerProfiles) && items.providerProfiles.length
    ? items.providerProfiles.map(normalizeProvider)
    : [legacyProvider];

  if (!providerProfiles.length) {
    providerProfiles = [clone(DEFAULT_PROVIDER)];
  }

  const knownIds = new Set(providerProfiles.map(p => p.id));
  const activeProviderId = knownIds.has(items.activeProviderId)
    ? items.activeProviderId
    : providerProfiles[0].id;

  const rawCapture = items.capture || {};
  const capture = {
    ...DEFAULT_CAPTURE,
    ...rawCapture
  };

  if (rawCapture.enableObsidian && !rawCapture.obsidianMode) {
    capture.obsidianMode = "uri";
  }

  return {
    providerProfiles,
    activeProviderId,
    pageProviderId: knownIds.has(items.pageProviderId) ? items.pageProviderId : activeProviderId,
    selectionProviderId: knownIds.has(items.selectionProviderId) ? items.selectionProviderId : activeProviderId,
    capture,
    ui: {
      ...DEFAULT_UI,
      ...(items.ui || {})
    },
    translation: {
      ...DEFAULT_TRANSLATION,
      ...(items.translation || {})
    }
  };
}

function getCurrentProvider() {
  return settings.providerProfiles.find(p => p.id === currentProviderId) || settings.providerProfiles[0];
}

function getProviderById(providerId) {
  if (!providerId) return null;
  return settings.providerProfiles.find(p => p.id === providerId) || null;
}

function saveCurrentProviderFromForm() {
  const provider = getCurrentProvider();
  if (!provider) return;

  provider.name = $("providerName").value.trim();
  provider.providerType = $("providerType").value === "gemini" ? "gemini" : "openai";
  if (provider.providerType === "gemini" && !$("apiUrl").value.trim()) {
    $("apiUrl").value = "https://generativelanguage.googleapis.com/v1beta";
  }
  provider.apiUrl = $("apiUrl").value.trim();
  provider.apiKey = $("apiKey").value.trim();
  provider.modelName = $("modelName").value.trim();
}

function isDraftProviderName(name) {
  const value = String(name || "").trim();
  return !value || value === t("newProviderProfileName") || value === t("unnamedProvider");
}

function getDefaultProviderName(provider) {
  return provider?.providerType === "gemini" ? t("defaultGeminiServiceName") : t("defaultLocalServiceName");
}

function ensureProviderName(provider) {
  if (!provider) return;
  if (isDraftProviderName(provider.name)) {
    provider.name = getDefaultProviderName(provider);
    if (provider.id === currentProviderId) {
      $("providerName").value = provider.name;
    }
  }
}

function formatProviderLabel(provider) {
  return provider.name || t("draftProviderName");
}

function populateProviderForm(provider) {
  $("providerName").value = provider.name || "";
  $("providerType").value = provider.providerType || "openai";
  $("apiUrl").value = provider.apiUrl || "";
  $("apiKey").value = provider.apiKey || "";
  $("modelName").value = provider.modelName || "";
  renderModelSelect(provider);
  updateProviderTypeHint();
}

function renderModelSelect(provider) {
  const modelSelect = $("modelSelect");
  const currentModel = provider.modelName || "";
  const models = provider.models || [];

  modelSelect.innerHTML = "";

  if (!models.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = t("modelSelectEmpty");
    option.selected = true;
    modelSelect.appendChild(option);
    return;
  }

  models.forEach(modelId => {
    const option = document.createElement("option");
    option.value = modelId;
    option.textContent = modelId;
    if (modelId === currentModel) option.selected = true;
    modelSelect.appendChild(option);
  });

  if (currentModel && !models.includes(currentModel)) {
    const customOption = document.createElement("option");
    customOption.value = currentModel;
    customOption.textContent = `${currentModel} ${t("customModelSuffix")}`;
    customOption.selected = true;
    modelSelect.appendChild(customOption);
  }
}

function updateProviderTypeHint() {
  const providerType = $("providerType").value;
  const apiUrl = $("apiUrl");
  const apiUrlGroup = $("apiUrlGroup");
  const hint = $("apiUrlHint");

  if (providerType === "gemini") {
    apiUrlGroup.classList.add("hidden");
    apiUrl.placeholder = "https://generativelanguage.googleapis.com/v1beta";
    hint.textContent = t("apiUrlHintGemini");
    if (!apiUrl.value.trim()) {
      apiUrl.value = "https://generativelanguage.googleapis.com/v1beta";
    }
  } else {
    apiUrlGroup.classList.remove("hidden");
    apiUrl.placeholder = "http://127.0.0.1:3000/api/chat/completions";
    hint.textContent = t("apiUrlHintOpenai");
  }
}

function maybeApplyProviderTypeDefaults() {
  const provider = getCurrentProvider();
  if (!provider) return;

  const nextType = $("providerType").value === "gemini" ? "gemini" : "openai";
  const previousType = provider.providerType || "openai";

  provider.providerType = nextType;

  if (nextType === "gemini" && (previousType !== "gemini" || !$("apiUrl").value.trim())) {
    if (!$("providerName").value.trim() || $("providerName").value.trim() === t("newProviderProfileName")) {
      $("providerName").value = t("defaultGeminiServiceName");
    }
    $("apiUrl").value = "https://generativelanguage.googleapis.com/v1beta";
    if (!provider.modelName || provider.modelName === DEFAULT_PROVIDER.modelName) {
      $("modelName").value = "gemini-2.5-flash";
    }
  } else if (nextType === "openai" && !$("providerName").value.trim()) {
    $("providerName").value = t("defaultLocalServiceName");
  }

  updateProviderTypeHint();
  renderModelSelect(provider);
}

function renderProviderSelect(selectEl, selectedId, options = {}) {
  selectEl.innerHTML = "";

  if (options.placeholder) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = t("providerSelectPlaceholder");
    placeholder.disabled = true;
    placeholder.selected = !selectedId;
    selectEl.appendChild(placeholder);
  }

  settings.providerProfiles.forEach(provider => {
    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = formatProviderLabel(provider);
    if (provider.id === selectedId) option.selected = true;
    selectEl.appendChild(option);
  });
}

function renderAllSelects() {
  renderProviderSelect($("providerSelect"), currentProviderId, { placeholder: true });
  renderProviderSelect($("pageProviderSelect"), settings.pageProviderId);
  renderProviderSelect($("selectionProviderSelect"), settings.selectionProviderId);
  $("deleteProvider").disabled = settings.providerProfiles.length <= 1;
}

function populateCaptureForm() {
  const capture = settings.capture;
  $("enableObsidian").checked = !!capture.enableObsidian;
  $("obsidianMode").value = capture.obsidianMode || DEFAULT_CAPTURE.obsidianMode;
  $("obsidianVault").value = capture.obsidianVault || "";
  $("obsidianFile").value = capture.obsidianFile || DEFAULT_CAPTURE.obsidianFile;
  $("obsidianApiUrl").value = capture.obsidianApiUrl || DEFAULT_CAPTURE.obsidianApiUrl;
  $("obsidianApiKey").value = capture.obsidianApiKey || "";
  $("translateTermContext").checked = capture.translateTermContext !== false;
  $("returnFocusAfterObsidianSave").checked = capture.returnFocusAfterObsidianSave !== false;
  $("enableEudic").checked = !!capture.enableEudic;
  $("eudicToken").value = capture.eudicToken || "";
  $("eudicCategoryName").value = capture.eudicCategoryName || DEFAULT_CAPTURE.eudicCategoryName;
  $("eudicLanguage").value = capture.eudicLanguage || DEFAULT_CAPTURE.eudicLanguage;
  updateObsidianModeVisibility();
}

function readCaptureFromForm() {
  return {
    enableObsidian: $("enableObsidian").checked,
    obsidianMode: $("obsidianMode").value === "uri" ? "uri" : "rest",
    obsidianVault: $("obsidianVault").value.trim(),
    obsidianFile: $("obsidianFile").value.trim() || DEFAULT_CAPTURE.obsidianFile,
    obsidianApiUrl: $("obsidianApiUrl").value.trim() || DEFAULT_CAPTURE.obsidianApiUrl,
    obsidianApiKey: $("obsidianApiKey").value.trim(),
    translateTermContext: $("translateTermContext").checked,
    returnFocusAfterObsidianSave: $("returnFocusAfterObsidianSave").checked,
    enableEudic: $("enableEudic").checked,
    eudicToken: $("eudicToken").value.trim(),
    eudicCategoryName: $("eudicCategoryName").value.trim() || DEFAULT_CAPTURE.eudicCategoryName,
    eudicLanguage: $("eudicLanguage").value.trim() || DEFAULT_CAPTURE.eudicLanguage
  };
}

function populateUiForm() {
  $("selectionPopupFontSize").value = String(settings.ui.selectionPopupFontSize || DEFAULT_UI.selectionPopupFontSize);
  $("optionsLanguage").value = settings.ui.optionsLanguage || DEFAULT_UI.optionsLanguage;
  $("pronunciationEnabled").checked = settings.ui.pronunciationEnabled !== false;
  $("pronunciationAccent").value = settings.ui.pronunciationAccent || DEFAULT_UI.pronunciationAccent;
  $("floatingBallEnabled").checked = Boolean(settings.ui.floatingBallEnabled ?? DEFAULT_UI.floatingBallEnabled);
  $("floatingBallPosition").value = settings.ui.floatingBallPosition || DEFAULT_UI.floatingBallPosition;
  $("floatingBallOpacity").value = String(settings.ui.floatingBallOpacity ?? DEFAULT_UI.floatingBallOpacity);
  $("floatingBallHoverOnly").checked = Boolean(settings.ui.floatingBallHoverOnly ?? DEFAULT_UI.floatingBallHoverOnly);
}

function readUiFromForm() {
  return {
    selectionPopupFontSize: Number($("selectionPopupFontSize").value) || DEFAULT_UI.selectionPopupFontSize,
    optionsLanguage: $("optionsLanguage").value || DEFAULT_UI.optionsLanguage,
    pronunciationEnabled: $("pronunciationEnabled").checked,
    pronunciationAccent: ["auto", "us", "uk"].includes($("pronunciationAccent").value) ? $("pronunciationAccent").value : DEFAULT_UI.pronunciationAccent,
    floatingBallEnabled: $("floatingBallEnabled").checked,
    floatingBallPosition: $("floatingBallPosition").value === "left" ? "left" : "right",
    floatingBallOpacity: Math.max(20, Math.min(100, Number($("floatingBallOpacity").value) || DEFAULT_UI.floatingBallOpacity)),
    floatingBallHoverOnly: $("floatingBallHoverOnly").checked
  };
}

function populateTranslationForm() {
  $("promptProfileSelect").value = settings.translation.promptProfile || DEFAULT_TRANSLATION.promptProfile;
}

function readTranslationFromForm() {
  return {
    promptProfile: $("promptProfileSelect").value || DEFAULT_TRANSLATION.promptProfile
  };
}

function updateObsidianModeVisibility() {
  const isRest = $("obsidianMode").value !== "uri";
  $("obsidianRestGroup").classList.toggle("hidden", !isRest);
  $("obsidianUriGroup").classList.toggle("hidden", isRest);
}

function restoreOptions() {
  chrome.storage.local.get({
    providerProfiles: null,
    activeProviderId: null,
    pageProviderId: null,
    selectionProviderId: null,
    capture: null,
    ui: null,
    translation: null,
    apiUrl: null,
    apiKey: null,
    modelName: null
  }, (items) => {
    settings = normalizeSettings(items);
    currentProviderId = settings.activeProviderId;
    renderAllSelects();
    populateProviderForm(getCurrentProvider());
    populateCaptureForm();
    populateUiForm();
    populateTranslationForm();
    applyI18n();
    log(t("loadedProfiles", { count: settings.providerProfiles.length }));
  });
}

function saveOptions() {
  saveCurrentProviderFromForm();

  settings.pageProviderId = $("pageProviderSelect").value || currentProviderId;
  settings.selectionProviderId = $("selectionProviderSelect").value || currentProviderId;
  settings.activeProviderId = currentProviderId;
  settings.capture = readCaptureFromForm();
  settings.ui = readUiFromForm();
  settings.translation = readTranslationFromForm();

  const activeProvider = getProviderById(currentProviderId) || getCurrentProvider();

  if (!activeProvider || !activeProvider.apiUrl) {
    showStatus(t("apiUrlRequired"), false);
    return;
  }

  if (!activeProvider.modelName) {
    showStatus(t("modelNameRequired"), false);
    return;
  }

  ensureProviderName(activeProvider);
  settings.activeProviderId = activeProvider.id;

  chrome.storage.local.set({
    providerProfiles: settings.providerProfiles,
    activeProviderId: settings.activeProviderId,
    pageProviderId: settings.pageProviderId,
    selectionProviderId: settings.selectionProviderId,
    capture: settings.capture,
    ui: settings.ui,
    translation: settings.translation,
    // Keep legacy values for older versions and easier debugging.
    apiUrl: activeProvider.apiUrl,
    apiKey: activeProvider.apiKey,
    modelName: activeProvider.modelName
  }, () => {
    showStatus(t("settingsSaved"), true);
    chrome.runtime.sendMessage({ type: "CONFIG_UPDATED" });
    renderAllSelects();
  });
}

function saveProviderQuick() {
  saveCurrentProviderFromForm();

  const provider = getCurrentProvider();
  if (!provider) return;

  if (!provider.apiUrl) {
    showStatus(t("apiUrlRequired"), false);
    return;
  }

  if (!provider.modelName) {
    showStatus(t("modelNameRequired"), false);
    return;
  }

  ensureProviderName(provider);

  if (!settings.pageProviderId || !getProviderById(settings.pageProviderId)) {
    settings.pageProviderId = provider.id;
  }

  if (!settings.selectionProviderId || !getProviderById(settings.selectionProviderId)) {
    settings.selectionProviderId = provider.id;
  }

  settings.activeProviderId = provider.id;
  settings.capture = readCaptureFromForm();
  settings.ui = readUiFromForm();
  settings.translation = readTranslationFromForm();

  chrome.storage.local.set({
    providerProfiles: settings.providerProfiles,
    activeProviderId: settings.activeProviderId,
    pageProviderId: settings.pageProviderId,
    selectionProviderId: settings.selectionProviderId,
    capture: settings.capture,
    ui: settings.ui,
    translation: settings.translation,
    apiUrl: provider.apiUrl,
    apiKey: provider.apiKey,
    modelName: provider.modelName
  }, () => {
    chrome.runtime.sendMessage({ type: "CONFIG_UPDATED" });
    renderAllSelects();
    populateProviderForm(provider);
    showStatus(t("providerSaved"), true);
  });
}

function resetOptions() {
  settings = {
    providerProfiles: [clone(DEFAULT_PROVIDER)],
    activeProviderId: DEFAULT_PROVIDER_ID,
    pageProviderId: DEFAULT_PROVIDER_ID,
    selectionProviderId: DEFAULT_PROVIDER_ID,
    capture: clone(DEFAULT_CAPTURE),
    ui: clone(DEFAULT_UI),
    translation: clone(DEFAULT_TRANSLATION)
  };
  currentProviderId = DEFAULT_PROVIDER_ID;
  renderAllSelects();
  populateProviderForm(getCurrentProvider());
  populateCaptureForm();
  populateUiForm();
  populateTranslationForm();
  applyI18n();
  showStatus(t("restoredDefaults"), true);
}

function addProvider() {
  saveCurrentProviderFromForm();

  const provider = {
    id: `provider-${Date.now()}`,
    name: "",
    providerType: "gemini",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "",
    modelName: "",
    models: []
  };

  settings.providerProfiles.push(provider);
  currentProviderId = provider.id;
  settings.activeProviderId = provider.id;
  renderAllSelects();
  populateProviderForm(provider);
  $("providerName").select();
  showStatus(t("newProviderCreated"), true);
}

function deleteProvider() {
  if (settings.providerProfiles.length <= 1) {
    showStatus(t("atLeastOneProvider"), false);
    return;
  }

  const provider = getCurrentProvider();
  settings.providerProfiles = settings.providerProfiles.filter(p => p.id !== provider.id);

  if (settings.pageProviderId === provider.id) settings.pageProviderId = settings.providerProfiles[0].id;
  if (settings.selectionProviderId === provider.id) settings.selectionProviderId = settings.providerProfiles[0].id;
  if (settings.activeProviderId === provider.id) settings.activeProviderId = settings.providerProfiles[0].id;

  currentProviderId = settings.activeProviderId;
  renderAllSelects();
  populateProviderForm(getCurrentProvider());
  showStatus(t("providerDeleted"), true);
}

function showStatus(text, success) {
  const status = $("status");
  status.textContent = text;
  status.className = success ? "success" : "error";
  setTimeout(() => {
    status.textContent = "";
    status.className = "";
  }, 3500);
}

async function fetchModels() {
  saveCurrentProviderFromForm();
  const provider = getCurrentProvider();

  if (!provider.apiUrl) {
    showStatus(t("setApiUrlFirst"), false);
    return;
  }

  showStatus(t("fetchingModels"), true);
  log(t("debugFetchingModels", { name: provider.name, url: provider.apiUrl }));

  chrome.runtime.sendMessage({
    type: "FETCH_MODELS",
    payload: {
      apiUrl: provider.apiUrl,
      apiKey: provider.apiKey,
      providerType: provider.providerType || "openai"
    }
  }, (response) => {
    if (chrome.runtime.lastError) {
      error(t("runtimeError", { error: chrome.runtime.lastError.message }));
      showStatus(t("runtimeError", { error: chrome.runtime.lastError.message }), false);
      return;
    }

    if (!response || !response.ok) {
      const errMsg = response ? response.error : "Unknown error";
      error(t("backgroundFetchFailed", { error: errMsg }));
      showStatus(t("failed", { error: errMsg }), false);
      return;
    }

    const models = extractModelIds(response.data);
    provider.models = models;

    if (models.length && !models.includes(provider.modelName)) {
      provider.modelName = models[0];
      $("modelName").value = models[0];
    }

    renderModelSelect(provider);

    log(t("loadedModels", { count: models.length }));
    showStatus(t("loadedModels", { count: models.length }), true);
  });
}

function extractModelIds(data) {
  const provider = getCurrentProvider();
  const rawModels = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
        ? data.models
        : [];

  return rawModels
    .filter(model => {
      if ((provider?.providerType || "openai") !== "gemini") return true;
      const actions = model?.supportedGenerationMethods || model?.supportedActions || [];
      return actions.includes("generateContent");
    })
    .map(model => typeof model === "string" ? model : model?.id || model?.name)
    .map(modelId => String(modelId).replace(/^models\//, ""))
    .filter(Boolean);
}

document.addEventListener("DOMContentLoaded", restoreOptions);

$("providerSelect").addEventListener("change", () => {
  saveCurrentProviderFromForm();
  currentProviderId = $("providerSelect").value;
  settings.activeProviderId = currentProviderId;
  renderAllSelects();
  populateProviderForm(getCurrentProvider());
});

$("pageProviderSelect").addEventListener("change", () => {
  settings.pageProviderId = $("pageProviderSelect").value;
});

$("selectionProviderSelect").addEventListener("change", () => {
  settings.selectionProviderId = $("selectionProviderSelect").value;
});

$("promptProfileSelect").addEventListener("change", () => {
  settings.translation = readTranslationFromForm();
});

$("optionsLanguage").addEventListener("change", () => {
  settings.ui = readUiFromForm();
  applyI18n();
});

$("obsidianMode").addEventListener("change", () => {
  updateObsidianModeVisibility();
});

$("providerName").addEventListener("input", () => {
  saveCurrentProviderFromForm();
  renderAllSelects();
});

$("modelSelect").addEventListener("change", () => {
  if ($("modelSelect").value) {
    $("modelName").value = $("modelSelect").value;
    saveCurrentProviderFromForm();
  }
});

$("modelName").addEventListener("input", () => {
  saveCurrentProviderFromForm();
  renderModelSelect(getCurrentProvider());
});

$("providerType").addEventListener("change", () => {
  maybeApplyProviderTypeDefaults();
  saveCurrentProviderFromForm();
});

$("addProvider").addEventListener("click", addProvider);
$("saveProvider").addEventListener("click", saveProviderQuick);
$("deleteProvider").addEventListener("click", deleteProvider);
$("fetchModels").addEventListener("click", fetchModels);
$("save").addEventListener("click", saveOptions);
$("reset").addEventListener("click", resetOptions);
